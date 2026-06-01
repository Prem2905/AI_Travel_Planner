from __future__ import annotations

import os
from urllib.parse import quote_plus

import requests
from flask import Blueprint, jsonify, request

SERPAPI_URL = "https://serpapi.com/search.json"

hotel_bp = Blueprint("hotel", __name__)

HOTEL_RESULT_LIMIT = 40
HOTEL_MAX_PAGES = 2  # extra SerpAPI page for more budget options
HOTEL_MIN_PRICE = 500
HOTEL_MAX_PRICE = 5000


def _price_value(hotel: dict) -> float | None:
    for key in ("rate_per_night_value", "total_rate_value"):
        val = hotel.get(key)
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                continue
    for key in ("rate_per_night", "total_rate"):
        raw = hotel.get(key)
        if not raw:
            continue
        digits = "".join(c for c in str(raw) if c.isdigit() or c == ".")
        if digits:
            try:
                return float(digits)
            except ValueError:
                continue
    return None


def _sort_by_lowest_price(hotels: list[dict]) -> list[dict]:
    """Cheapest first; properties without a parseable price go last."""

    def sort_key(h: dict) -> tuple:
        price = _price_value(h)
        if price is None:
            return (1, float("inf"), (h.get("name") or "").lower())
        return (0, price, (h.get("name") or "").lower())

    return sorted(hotels, key=sort_key)


def _filter_price_range(
    hotels: list[dict],
    min_price: float = HOTEL_MIN_PRICE,
    max_price: float = HOTEL_MAX_PRICE,
) -> list[dict]:
    """Keep only hotels with a nightly rate between min_price and max_price (INR)."""
    out: list[dict] = []
    for h in hotels:
        price = _price_value(h)
        if price is None:
            continue
        if min_price <= price <= max_price:
            out.append(h)
    return out


def _hotel_link(
    prop: dict,
    *,
    name: str,
    query: str,
    check_in: str,
    check_out: str,
) -> str | None:
    link = (prop.get("link") or "").strip()
    if link.startswith("http"):
        return link
    if name:
        term = quote_plus(f"{name} {query}".strip())
        return (
            f"https://www.google.com/travel/search?q={term}"
            f"&dates={check_in},{check_out}"
        )
    return None


def _dedupe_hotels(hotels: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for h in hotels:
        token = (h.get("property_token") or "").strip()
        name = (h.get("name") or "").strip().lower()
        key = token or name
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(h)
    return out


def _normalize_property(
    prop: dict,
    *,
    query: str = "",
    check_in: str = "",
    check_out: str = "",
) -> dict | None:
    name = (prop.get("name") or "").strip()
    if not name:
        return None
    rate = prop.get("rate_per_night") or {}
    total = prop.get("total_rate") or {}
    images = prop.get("images") or []
    thumb = None
    if images and isinstance(images[0], dict):
        thumb = images[0].get("thumbnail") or images[0].get("original_image")
    return {
        "name": name,
        "type": prop.get("type", "hotel"),
        "rate_per_night": rate.get("lowest"),
        "rate_per_night_value": rate.get("extracted_lowest"),
        "total_rate": total.get("lowest"),
        "total_rate_value": total.get("extracted_lowest"),
        "overall_rating": prop.get("overall_rating"),
        "reviews": prop.get("reviews"),
        "hotel_class": prop.get("hotel_class"),
        "thumbnail": thumb,
        "property_token": prop.get("property_token"),
        "link": _hotel_link(
            prop,
            name=name,
            query=query,
            check_in=check_in,
            check_out=check_out,
        ),
    }


def get_hotels(
    query: str,
    check_in_date: str,
    check_out_date: str,
    *,
    adults: int = 2,
    children: int = 0,
    currency: str = "INR",
    hl: str = "en",
    gl: str = "in",
    sort_by: int | None = 3,
) -> dict:
    """
    Call SerpAPI Google Hotels and return { "ok": bool, "hotels": [...] } or { "ok": False, "error": str }.
    sort_by: SerpAPI option, e.g. 3 = lowest price, 8 = highest rating.
    """
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return {"ok": False, "error": "SERPAPI_KEY missing. Add it to travel-tour/.env"}

    q = (query or "").strip()
    if not q:
        return {"ok": False, "error": "Enter a destination or hotel search (e.g. Mumbai, Goa resorts)."}

    if not check_in_date or not check_out_date:
        return {"ok": False, "error": "Check-in and check-out dates are required."}

    if check_out_date <= check_in_date:
        return {"ok": False, "error": "Check-out must be after check-in."}

    adults = max(1, min(int(adults or 2), 9))
    children = max(0, min(int(children or 0), 6))

    params: dict = {
        "engine": "google_hotels",
        "q": q,
        "check_in_date": check_in_date,
        "check_out_date": check_out_date,
        "adults": adults,
        "children": children,
        "currency": currency,
        "hl": hl,
        "gl": gl,
        "api_key": api_key,
    }
    # SerpAPI default is relevance; always request lowest price unless user chose otherwise.
    if sort_by is None:
        sort_by = 3
    params["sort_by"] = sort_by
    params["min_price"] = HOTEL_MIN_PRICE
    params["max_price"] = HOTEL_MAX_PRICE

    combined: list[dict] = []
    pages_fetched = 0
    next_token: str | None = None

    try:
        while pages_fetched < HOTEL_MAX_PAGES:
            page_params = dict(params)
            if next_token:
                page_params["next_page_token"] = next_token

            response = requests.get(SERPAPI_URL, params=page_params, timeout=90)
            try:
                data = response.json()
            except ValueError:
                return {"ok": False, "error": "Invalid response from hotel provider."}

            if response.status_code != 200:
                err = data.get("error") or data.get("message") or f"HTTP {response.status_code}"
                return {"ok": False, "error": str(err)}

            meta = data.get("search_metadata") or {}
            if meta.get("status") == "Error":
                return {"ok": False, "error": data.get("error") or "Hotel search failed."}

            if data.get("error"):
                return {"ok": False, "error": str(data["error"])}

            for item in data.get("properties") or []:
                norm = _normalize_property(
                    item,
                    query=q,
                    check_in=check_in_date,
                    check_out=check_out_date,
                )
                if norm:
                    combined.append(norm)

            pages_fetched += 1
            pagination = data.get("serpapi_pagination") or {}
            next_token = pagination.get("next_page_token")
            if not next_token:
                break
    except requests.RequestException as exc:
        return {"ok": False, "error": f"Network error: {exc}"}

    combined = _dedupe_hotels(combined)
    if sort_by == 8:
        combined.sort(
            key=lambda h: (
                h.get("overall_rating") is None,
                -(float(h["overall_rating"]) if h.get("overall_rating") is not None else 0),
            )
        )
    elif sort_by == 13:
        combined.sort(
            key=lambda h: (
                h.get("reviews") is None,
                -(int(h["reviews"]) if h.get("reviews") is not None else 0),
            )
        )
    else:
        combined = _sort_by_lowest_price(combined)

    combined = _filter_price_range(combined)

    search_info = {
        "query": q,
        "check_in": check_in_date,
        "check_out": check_out_date,
        "currency": currency,
        "adults": adults,
        "children": children,
        "min_price": HOTEL_MIN_PRICE,
        "max_price": HOTEL_MAX_PRICE,
    }

    if not combined:
        return {
            "ok": True,
            "hotels": [],
            "message": (
                f"No hotels found between {currency} {HOTEL_MIN_PRICE:,} and "
                f"{HOTEL_MAX_PRICE:,} per night. Try other dates or a broader location."
            ),
            "search": search_info,
        }

    return {
        "ok": True,
        "hotels": combined[:HOTEL_RESULT_LIMIT],
        "search": {**search_info, "sort_by": sort_by, "count": len(combined[:HOTEL_RESULT_LIMIT])},
    }


@hotel_bp.route("/api/hotels", methods=["OPTIONS"])
def hotels_preflight():
    return "", 204


@hotel_bp.route("/api/hotels", methods=["POST"])
def api_hotels():
    payload = request.get_json(silent=True) or {}
    q = payload.get("q") or payload.get("query") or payload.get("location") or payload.get("destination")
    check_in = payload.get("check_in_date") or payload.get("check_in")
    check_out = payload.get("check_out_date") or payload.get("check_out")

    try:
        adults = int(payload.get("adults", 2))
    except (TypeError, ValueError):
        adults = 2

    try:
        children = int(payload.get("children", 0))
    except (TypeError, ValueError):
        children = 0

    currency = payload.get("currency") or "INR"

    sort_by = payload.get("sort_by")
    if sort_by is not None:
        try:
            sort_by = int(sort_by)
        except (TypeError, ValueError):
            sort_by = 3
    else:
        sort_by = 3

    if not q or not check_in or not check_out:
        return jsonify({"ok": False, "error": "Missing destination (q), check-in, or check-out."}), 400

    result = get_hotels(
        str(q),
        str(check_in),
        str(check_out),
        adults=adults,
        children=children,
        currency=currency,
        sort_by=sort_by,
    )
    status = 200 if result.get("ok") else 400
    return jsonify(result), status


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        out = get_hotels("Mumbai hotels", "2026-06-10", "2026-06-12", adults=2)
        if out.get("ok"):
            for i, h in enumerate(out.get("hotels") or [], 1):
                print(f"\n{i}. {h['name']}  {h.get('rate_per_night') or h.get('total_rate')}  rating={h.get('overall_rating')}")
        else:
            print("Error:", out.get("error"))
    else:
        print("Start the site with: python app.py")
        print("Hotel CLI demo: python hotel.py demo")
