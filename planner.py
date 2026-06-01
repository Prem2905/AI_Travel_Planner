from __future__ import annotations

import json
import os
from datetime import date

from flask import Blueprint, jsonify, request
from google import genai
from google.genai import types

planner_bp = Blueprint("planner", __name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

SYSTEM_INSTRUCTION = """You are an expert travel planner for Wanderlust Tours.
- Provide clear day-by-day itineraries when asked about destinations and duration.
- Use any flight or hotel booking details provided in context to personalize advice.
- Only answer travel-related questions; politely decline unrelated topics.
- Be concise, practical, and beginner-friendly.
- When the user wants to find flights or hotels, mention what you understood (routes, dates, city).
- Invert live prices for flights and hotels; suggest they check the Flights and Hotels tabs for live results.
- at last mention the total cost of the trip and the total duration of the trip."""

EXTRACT_INSTRUCTION = """Analyze the latest user message and assistant reply.
Return ONLY valid JSON (no markdown) with this shape:
{
  "flight": null or {
    "from": "IATA or airport text",
    "to": "IATA or airport text",
    "outbound_date": "YYYY-MM-DD",
    "return_date": "YYYY-MM-DD or null",
    "round_trip": true/false,
    "adults": 1,
    "cabin": "economy"
  },
  "hotel": null or {
    "q": "city or hotel search query",
    "check_in_date": "YYYY-MM-DD",
    "check_out_date": "YYYY-MM-DD",
    "adults": 2,
    "children": 0
  }
}
Set flight or hotel only when the user clearly wants to search or book that category.
Use booking context to fill missing dates or destinations when reasonable.
Today's date for reference: {today}."""


def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY missing in .env")
    return genai.Client(api_key=api_key)


def _format_booking_context(ctx: dict | None) -> str:
    if not ctx:
        return "No active flight or hotel booking yet."
    parts: list[str] = []
    flight = ctx.get("flight") or {}
    if any(flight.get(k) for k in ("from", "to", "outbound_date", "depart")):
        parts.append(
            "Flight booking: "
            f"{flight.get('from', '?')} → {flight.get('to', '?')}, "
            f"depart {flight.get('outbound_date') or flight.get('depart', '?')}, "
            f"return {flight.get('return_date') or flight.get('return') or 'one-way'}, "
            f"{flight.get('adults', 1)} passenger(s), cabin {flight.get('cabin', 'economy')}."
        )
    hotel = ctx.get("hotel") or {}
    if any(hotel.get(k) for k in ("q", "query", "check_in", "check_in_date")):
        parts.append(
            "Hotel booking: "
            f"{hotel.get('q') or hotel.get('query', '?')}, "
            f"check-in {hotel.get('check_in_date') or hotel.get('check_in', '?')}, "
            f"check-out {hotel.get('check_out_date') or hotel.get('check_out', '?')}, "
            f"{hotel.get('adults', 2)} adult(s)."
        )
    dest = ctx.get("destination") or ctx.get("last_destination")
    if dest:
        parts.append(f"Trip focus destination: {dest}.")
    return "\n".join(parts) if parts else "No active flight or hotel booking yet."


def _history_to_contents(messages: list[dict]) -> list[types.Content]:
    contents: list[types.Content] = []
    for msg in messages[-20:]:
        role = msg.get("role", "user")
        text = (msg.get("content") or msg.get("text") or "").strip()
        if not text:
            continue
        gemini_role = "model" if role in ("assistant", "model", "ai") else "user"
        contents.append(
            types.Content(role=gemini_role, parts=[types.Part.from_text(text=text)])
        )
    return contents


def generate_chat_reply(messages: list[dict], booking_context: dict | None = None) -> str:
    client = _client()
    ctx_text = _format_booking_context(booking_context)
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION + f"\n\nCurrent booking context:\n{ctx_text}",
        temperature=0.7,
    )
    contents = _history_to_contents(messages)
    if not contents:
        raise ValueError("No messages provided")
    response = client.models.generate_content(
        model=MODEL,
        config=config,
        contents=contents,
    )
    return (response.text or "").strip()


def _normalize_flight_search(flight: dict | None, ctx: dict | None) -> dict | None:
    if not flight or not isinstance(flight, dict):
        return None
    fb = (ctx or {}).get("flight") or {}
    merged = {**fb, **{k: v for k, v in flight.items() if v}}
    dep = merged.get("from") or merged.get("departure_id")
    arr = merged.get("to") or merged.get("arrival_id")
    outbound = merged.get("outbound_date") or merged.get("depart")
    if not dep or not arr or not outbound:
        return None
    round_trip = bool(merged.get("round_trip", True))
    if merged.get("trip_type") == "oneway":
        round_trip = False
    ret = merged.get("return_date") or merged.get("return")
    return {
        "from": str(dep),
        "to": str(arr),
        "outbound_date": str(outbound),
        "return_date": str(ret) if round_trip and ret else None,
        "round_trip": round_trip,
        "trip_type": "round" if round_trip else "oneway",
        "adults": max(1, min(int(merged.get("adults") or 1), 9)),
        "cabin": merged.get("cabin") or "economy",
        "currency": merged.get("currency") or "INR",
    }


def _normalize_hotel_search(hotel: dict | None, ctx: dict | None) -> dict | None:
    if not hotel or not isinstance(hotel, dict):
        return None
    hb = (ctx or {}).get("hotel") or {}
    merged = {**hb, **{k: v for k, v in hotel.items() if v}}
    q = merged.get("q") or merged.get("query") or merged.get("location")
    check_in = merged.get("check_in_date") or merged.get("check_in")
    check_out = merged.get("check_out_date") or merged.get("check_out")
    if not q or not check_in or not check_out:
        return None
    return {
        "q": str(q).strip(),
        "check_in_date": str(check_in),
        "check_out_date": str(check_out),
        "adults": max(1, min(int(merged.get("adults") or 2), 9)),
        "children": max(0, min(int(merged.get("children") or 0), 6)),
        "sort_by": 3,
        "currency": merged.get("currency") or "INR",
    }


def extract_search_actions(
    messages: list[dict],
    reply: str,
    booking_context: dict | None = None,
) -> dict:
    client = _client()
    ctx_text = _format_booking_context(booking_context)
    recent = messages[-6:] if messages else []
    convo = "\n".join(
        f"{m.get('role', 'user')}: {m.get('content') or m.get('text', '')}"
        for m in recent
    )
    prompt = (
        f"Conversation:\n{convo}\n\nAssistant reply:\n{reply}\n\n"
        f"Booking context:\n{ctx_text}"
    )
    try:
        response = client.models.generate_content(
            model=MODEL,
            config=types.GenerateContentConfig(
                system_instruction=EXTRACT_INSTRUCTION.format(today=date.today().isoformat()),
                temperature=0.1,
                response_mime_type="application/json",
            ),
            contents=prompt,
        )
        data = json.loads((response.text or "").strip())
    except (json.JSONDecodeError, TypeError, ValueError, RuntimeError):
        return {"flight": None, "hotel": None}

    flight = data.get("flight") if isinstance(data, dict) else None
    hotel = data.get("hotel") if isinstance(data, dict) else None
    return {
        "flight": _normalize_flight_search(flight, booking_context),
        "hotel": _normalize_hotel_search(hotel, booking_context),
    }


@planner_bp.route("/api/planner/chat", methods=["OPTIONS"])
def planner_chat_preflight():
    return "", 204


@planner_bp.route("/api/planner/chat", methods=["POST"])
def api_planner_chat():
    payload = request.get_json(silent=True) or {}
    messages = payload.get("messages") or []
    booking_context = payload.get("booking_context") or payload.get("context")
    extract = bool(payload.get("extract_searches", True))

    if not messages:
        return jsonify({"ok": False, "error": "messages array is required."}), 400

    try:
        reply = generate_chat_reply(messages, booking_context)
    except RuntimeError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Planner error: {exc}"}), 500

    searches = {"flight": None, "hotel": None}
    if extract:
        try:
            searches = extract_search_actions(
                messages + [{"role": "assistant", "content": reply}],
                reply,
                booking_context,
            )
        except Exception:
            pass

    return jsonify({"ok": True, "reply": reply, "searches": searches})
