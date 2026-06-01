(function (global) {
  "use strict";

  var DATA_URL = "data/airports-iata.json";
  var iataToCity = null;
  var loadPromise = null;

  function extractIata(text) {
    if (!text || !String(text).trim()) return null;
    var raw = String(text).trim().toUpperCase();
    var seps = ["\u2014", "\u2013", "-"];
    for (var i = 0; i < seps.length; i++) {
      if (raw.indexOf(seps[i]) !== -1) {
        raw = raw.split(seps[i], 1)[0].trim();
        break;
      }
    }
    if (raw.length >= 3 && /^[A-Z]{3}/.test(raw)) return raw.slice(0, 3);
    var m = raw.match(/\b([A-Z]{3})\b/);
    return m ? m[1] : null;
  }

  function cityFromFlightInput(text) {
    if (!text || !String(text).trim()) return null;
    var m = String(text).trim().match(/,\s*([^,(]+)\s*\([A-Za-z]{2}\)\s*$/);
    return m ? m[1].trim() : null;
  }

  function ensureLoaded() {
    if (iataToCity) return Promise.resolve(iataToCity);
    if (loadPromise) return loadPromise;
    loadPromise = fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load airport list");
        return res.json();
      })
      .then(function (rows) {
        var map = {};
        rows.forEach(function (a) {
          var code = (a.iata || "").toUpperCase();
          var city = (a.city || "").trim();
          if (code && city && !map[code]) map[code] = city;
        });
        iataToCity = map;
        return map;
      })
      .catch(function () {
        iataToCity = {};
        return iataToCity;
      });
    return loadPromise;
  }

  function iataToCityName(iata) {
    if (!iata || !iataToCity) return null;
    return iataToCity[String(iata).toUpperCase()] || null;
  }

  function hotelQueryForDestination(destination, arrivalIata) {
    var city = cityFromFlightInput(destination);
    if (!city) {
      var code = arrivalIata || extractIata(destination);
      city = code ? iataToCityName(code) : null;
    }
    if (city) return city + " hotels";
    var q = (destination || "").trim();
    if (!q) return "hotels";
    return /hotel/i.test(q) ? q : q + " hotels";
  }

  function nextDateString(yyyyMmDd) {
    if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return "";
    var p = yyyyMmDd.split("-").map(function (x) {
      return parseInt(x, 10);
    });
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + 1);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function buildHotelSearchFromFlight(flightParams, searchMeta) {
    var meta = searchMeta || {};
    var dest =
      flightParams.destination_city ||
      meta.destination_city ||
      cityFromFlightInput(flightParams.to) ||
      iataToCityName(meta.to || extractIata(flightParams.to));

    var hotelQ =
      flightParams.hotel_query ||
      meta.hotel_query ||
      (dest ? dest + " hotels" : hotelQueryForDestination(flightParams.to, meta.to || extractIata(flightParams.to)));

    var checkIn = flightParams.outbound_date || meta.outbound || "";
    var retDate = flightParams.return_date || meta.return || "";
    if (retDate === "null") retDate = "";
    var checkOut = "";
    if (flightParams.round_trip && retDate) {
      checkOut = retDate;
    } else {
      checkOut = nextDateString(checkIn);
    }

    return {
      q: hotelQ,
      check_in_date: checkIn,
      check_out_date: checkOut,
      adults: Math.max(1, parseInt(flightParams.adults, 10) || 2),
      children: 0,
      currency: flightParams.currency || "INR",
      sort_by: 3,
    };
  }

  global.TravelAirports = {
    ensureLoaded: ensureLoaded,
    extractIata: extractIata,
    cityFromFlightInput: cityFromFlightInput,
    iataToCityName: iataToCityName,
    hotelQueryForDestination: hotelQueryForDestination,
    nextDateString: nextDateString,
    buildHotelSearchFromFlight: buildHotelSearchFromFlight,
  };
})(typeof window !== "undefined" ? window : this);
