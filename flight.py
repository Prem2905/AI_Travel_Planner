from __future__ import annotations

import os

import requests
from flask import Blueprint, jsonify, request

from airports import extract_iata, hotel_query_for_destination, iata_to_city

SERPAPI_URL = "https://serpapi.com/search.json"

# SerpAPI: 1 = Round trip, 2 = One way, 3 = Multi-city
TYPE_ROUND_TRIP = 1
TYPE_ONE_WAY = 2

# SerpAPI travel_class: 1 Economy … 4 First
TRAVEL_CLASS_BY_FORM = {
    "economy": 1,
    "premium": 2,
    "business": 3,
    "first": 4,
}

flight_bp = Blueprint("flight", __name__)


def _normalize_offer(flight: dict) -> dict | None:
    legs = flight.get("flights") or []
    if not legs:
        return None
    try:
        first = legs[0]
        last = legs[-1]
        dep = first.get("departure_airport") or {}
        arr = last.get("arrival_airport") or {}
        layovers = flight.get("layovers") or []
        stops = len(layovers) if layovers else max(0, len(legs) - 1)
        return {
            "airline": first.get("airline", "—"),
            "price": flight.get("price"),
            "currency_suffix": flight.get("currency") or "",
            "departure_time": dep.get("time", "—"),
            "arrival_time": arr.get("time", "—"),
            "from_id": dep.get("id", "—"),
            "to_id": arr.get("id", "—"),
            "total_duration_min": flight.get("total_duration"),
            "stops": stops,
        }
    except (TypeError, KeyError):
        return None


def get_flights(
    departure_id: str,
    arrival_id: str,
    outbound_date: str,
    *,
    return_date: str | None = None,
    round_trip: bool = True,
    adults: int = 1,
    travel_class: int = 1,
    currency: str = "INR",
    hl: str = "en",
    gl: str = "in",
) -> dict:
    """
    Call SerpAPI Google Flights and return { "ok": bool, "flights": [...] } or { "ok": False, "error": str }.
    """
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return {"ok": False, "error": "SERPAPI_KEY missing. Add it to travel-tour/.env"}

    dep = extract_iata(departure_id)
    arr = extract_iata(arrival_id)
    if not dep or not arr:
        return {
            "ok": False,
            "error": "Invalid airport. Pick from suggestions or type a 3-letter IATA code (e.g. DEL, BOM).",
        }
    if dep == arr:
        return {"ok": False, "error": "Departure and arrival airports must be different."}

    adults = max(1, min(int(adults or 1), 9))

    params: dict = {
        "engine": "google_flights",
        "departure_id": dep,
        "arrival_id": arr,
        "outbound_date": outbound_date,
        "type": TYPE_ROUND_TRIP if round_trip else TYPE_ONE_WAY,
        "adults": adults,
        "travel_class": travel_class,
        "currency": currency,
        "hl": hl,
        "gl": gl,
        "api_key": api_key,
    }
    if round_trip:
        if not return_date:
            return {"ok": False, "error": "Return date is required for a round trip."}
        params["return_date"] = return_date

    try:
        response = requests.get(SERPAPI_URL, params=params, timeout=90)
    except requests.RequestException as exc:
        return {"ok": False, "error": f"Network error: {exc}"}

    try:
        data = response.json()
    except ValueError:
        return {"ok": False, "error": "Invalid response from flight provider."}

    if response.status_code != 200:
        err = data.get("error") or data.get("message") or f"HTTP {response.status_code}"
        return {"ok": False, "error": str(err)}

    meta = data.get("search_metadata") or {}
    if meta.get("status") == "Error":
        return {"ok": False, "error": data.get("error") or "Flight search failed."}

    if data.get("error"):
        return {"ok": False, "error": str(data["error"])}

    combined: list[dict] = []
    for key in ("best_flights", "other_flights"):
        for item in data.get(key) or []:
            norm = _normalize_offer(item)
            if norm:
                combined.append(norm)

    dest_city = iata_to_city(arr)
    search_info = {
        "from": dep,
        "to": arr,
        "destination_city": dest_city,
        "hotel_query": hotel_query_for_destination(arrival_id, arrival_iata=arr),
        "outbound": outbound_date,
        "return": return_date if round_trip else None,
        "currency": currency,
    }

    if not combined:
        return {
            "ok": True,
            "flights": [],
            "message": "No flights returned for this search. Try other dates or airports.",
            "search": search_info,
        }

    return {
        "ok": True,
        "flights": combined[:25],
        "search": search_info,
    }


@flight_bp.route("/api/flights", methods=["OPTIONS"])
def flights_preflight():
    return "", 204


@flight_bp.route("/api/flights", methods=["POST"])
def api_flights():
    payload = request.get_json(silent=True) or {}
    dep = payload.get("from") or payload.get("departure_id")
    arr = payload.get("to") or payload.get("arrival_id")
    outbound = payload.get("outbound_date") or payload.get("depart")
    ret = payload.get("return_date") or payload.get("return")
    round_trip = bool(payload.get("round_trip", True))
    if payload.get("trip_type") == "oneway":
        round_trip = False

    try:
        adults = int(payload.get("adults", 1))
    except (TypeError, ValueError):
        adults = 1

    cabin_key = (payload.get("cabin") or payload.get("travel_class") or "economy").lower()
    if isinstance(cabin_key, str) and cabin_key.isdigit():
        travel_class = int(cabin_key)
    else:
        travel_class = TRAVEL_CLASS_BY_FORM.get(cabin_key, 1)

    currency = payload.get("currency") or "INR"

    if not dep or not arr or not outbound:
        return jsonify({"ok": False, "error": "Missing from, to, or departure date."}), 400

    result = get_flights(
        dep,
        arr,
        outbound,
        return_date=ret if round_trip else None,
        round_trip=round_trip,
        adults=adults,
        travel_class=travel_class,
        currency=currency,
    )
    status = 200 if result.get("ok") else 400
    return jsonify(result), status


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        demo_dep, demo_arr, demo_out = "IXR", "BOM", "2026-06-15"
        demo_ret = "2026-06-20"
        out = get_flights(demo_dep, demo_arr, demo_out, return_date=demo_ret, round_trip=True)
        if out.get("ok"):
            for i, f in enumerate(out.get("flights") or [], 1):
                print(f"\n{i}. {f['airline']}  {f.get('price')}  {f['departure_time']} → {f['arrival_time']}")
        else:
            print("Error:", out.get("error"))
    else:
        print("Start the site with: python app.py")
        print("Flight CLI demo: python flight.py demo")
