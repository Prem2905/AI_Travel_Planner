from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data" / "airports-iata.json"

_IATA_RE = re.compile(r"\b([A-Z]{3})\b")


def extract_iata(text: str) -> str | None:
    if not text or not str(text).strip():
        return None
    raw = str(text).strip().upper()
    for sep in ("\u2014", "\u2013", "-"):
        if sep in raw:
            raw = raw.split(sep, 1)[0].strip()
            break
    if len(raw) >= 3 and raw[:3].isalpha():
        return raw[:3]
    m = _IATA_RE.search(raw)
    return m.group(1) if m else None


def city_from_flight_input(text: str) -> str | None:
    if not text or not str(text).strip():
        return None
    s = str(text).strip()
    m = re.search(r",\s*([^,(]+)\s*\([A-Za-z]{2}\)\s*$", s)
    if m:
        return m.group(1).strip()
    return None


@lru_cache(maxsize=1)
def _iata_index() -> dict[str, str]:
    try:
        rows = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    out: dict[str, str] = {}
    for row in rows:
        code = (row.get("iata") or "").strip().upper()
        city = (row.get("city") or "").strip()
        if code and city and code not in out:
            out[code] = city
    return out


def iata_to_city(iata: str | None) -> str | None:
    if not iata:
        return None
    return _iata_index().get(str(iata).strip().upper())


def hotel_query_for_destination(destination: str, *, arrival_iata: str | None = None) -> str:
    city = city_from_flight_input(destination)
    if not city:
        code = arrival_iata or extract_iata(destination)
        city = iata_to_city(code)
    if city:
        return f"{city} hotels"
    q = (destination or "").strip()
    if not q:
        return "hotels"
    if "hotel" not in q.lower():
        return f"{q} hotels"
    return q
