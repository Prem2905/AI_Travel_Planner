(function () {
  "use strict";

  var flightParams = null;
  var flightSearchMeta = {};
  var hotelSearchBody = null;
  var hotelsFetched = false;
  var hotelsLoading = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatDurationMinutes(min) {
    if (min == null || isNaN(Number(min))) return "";
    var total = Math.round(Number(min));
    var h = Math.floor(total / 60);
    var m = total % 60;
    return (h ? h + "h " : "") + m + "m";
  }

  function getParams() {
    var params = new URLSearchParams(window.location.search);
    var roundTrip = params.get("round_trip") === "true";
    return {
      from: params.get("from") || "",
      to: params.get("to") || "",
      destination_city: params.get("destination_city") || "",
      outbound_date: params.get("outbound_date") || "",
      return_date: params.get("return_date") || "",
      round_trip: roundTrip,
      trip_type: roundTrip ? "round" : "oneway",
      adults: parseInt(params.get("adults") || "1", 10) || 1,
      cabin: params.get("cabin") || "economy",
      currency: params.get("currency") || "INR",
      api_url: params.get("api_url") || window.FLIGHT_API_URL || "/api/flights",
    };
  }

  function showFlightError(msg) {
    var alert = byId("resultsAlert");
    if (!alert) return;
    alert.textContent = msg;
    alert.classList.remove("d-none");
  }

  function showHotelError(msg) {
    var alert = byId("hotelTabAlert");
    if (!alert) return;
    alert.textContent = msg;
    alert.classList.remove("d-none");
  }

  function hideFlightLoading() {
    var loading = byId("resultsLoading");
    if (loading) loading.classList.add("d-none");
  }

  function setHotelLoading(loading) {
    var el = byId("hotelTabLoading");
    if (el) el.classList.toggle("d-none", !loading);
    hotelsLoading = loading;
  }

  function renderFlightSummary(body, search) {
    var summary = byId("resultsSummary");
    if (!summary) return;
    var from = (search && search.from) || body.from || "Origin";
    var to = (search && search.to) || body.to || "Destination";
    var text = from + " to " + to + " · " + (body.outbound_date || "date not set");
    if (body.round_trip && body.return_date) {
      text += " to " + body.return_date;
    }
    text += " · " + (body.adults || 1) + " passenger(s)";
    summary.textContent = text;
  }

  function renderHotelSummary(body, search) {
    var summary = byId("hotelTabSummary");
    if (!summary) return;
    var q = (search && search.query) || body.q || "Destination";
    var text =
      q +
      " · " +
      (body.check_in_date || "?") +
      " – " +
      (body.check_out_date || "?") +
      " · " +
      (body.adults || 2) +
      " adult(s)";
    if (body.children) text += ", " + body.children + " child(ren)";
    text += " · " + (body.currency || "INR");
    summary.textContent = text;
  }

  function renderFlightList(payload) {
    var list = byId("resultsList");
    var empty = byId("resultsEmpty");
    if (!list || !empty) return;
    list.innerHTML = "";
    if (!payload.flights || !payload.flights.length) {
      empty.classList.remove("d-none");
      return;
    }
    empty.classList.add("d-none");
    var currency = (payload.search && payload.search.currency) || "INR";

    payload.flights.forEach(function (f) {
      var dur = formatDurationMinutes(f.total_duration_min);
      var stops = f.stops === 0 ? "Nonstop" : String(f.stops) + " stop(s)";
      var price = f.price == null ? "—" : String(f.price);
      var item = document.createElement("div");
      item.className = "list-group-item border-0 border-bottom py-3 flight-result-row";
      item.innerHTML =
        '<div class="d-flex flex-wrap justify-content-between align-items-start gap-3">' +
        '<div><h3 class="h6 mb-1">' +
        escapeHtml(f.airline || "Airline") +
        "</h3>" +
        '<p class="small text-secondary mb-1">' +
        escapeHtml(f.departure_time || "") +
        " → " +
        escapeHtml(f.arrival_time || "") +
        "</p>" +
        '<p class="small text-muted mb-0">' +
        escapeHtml(f.from_id || "") +
        " → " +
        escapeHtml(f.to_id || "") +
        " · " +
        stops +
        (dur ? " · " + dur : "") +
        "</p></div>" +
        '<div class="text-end"><div class="fs-5 fw-bold text-accent">' +
        escapeHtml(price) +
        '</div><div class="small text-secondary">' +
        escapeHtml(currency) +
        "</div></div></div>";
      list.appendChild(item);
    });
  }

  function showHotelResults(hotels, currency) {
    var list = byId("hotelTabList");
    var empty = byId("hotelTabEmpty");
    var filters = byId("hotelTabFilters");
    if (!list || !empty) return;

    if (!hotels || !hotels.length) {
      if (filters) filters.classList.add("d-none");
      empty.classList.remove("d-none");
      list.innerHTML = "";
      return;
    }

    if (window.HotelList) {
      window.HotelList.setupFilters(filters, list, empty, hotels, currency || "INR");
    }
  }

  function prepareHotelSearch(body, searchMeta) {
    if (!window.TravelAirports) return Promise.resolve(null);
    return window.TravelAirports.ensureLoaded().then(function () {
      var hotelBody = window.TravelAirports.buildHotelSearchFromFlight(body, searchMeta || {});
      if (!hotelBody.q || !hotelBody.check_in_date || !hotelBody.check_out_date) return null;
      hotelSearchBody = hotelBody;
      renderHotelSummary(hotelBody, { query: hotelBody.q });
      return hotelBody;
    });
  }

  function fetchHotels() {
    if (hotelsFetched || hotelsLoading || !hotelSearchBody) return;
    hotelsLoading = true;
    setHotelLoading(true);
    var alert = byId("hotelTabAlert");
    if (alert) alert.classList.add("d-none");

    var apiUrl = window.HOTEL_API_URL || "/api/hotels";
    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: hotelSearchBody.q,
        check_in_date: hotelSearchBody.check_in_date,
        check_out_date: hotelSearchBody.check_out_date,
        adults: hotelSearchBody.adults,
        children: hotelSearchBody.children || 0,
        sort_by: hotelSearchBody.sort_by || 3,
        currency: hotelSearchBody.currency,
      }),
    })
      .then(function (res) {
        return res.json().then(
          function (data) {
            return { ok: res.ok, data: data };
          },
          function () {
            return { ok: false, data: { ok: false, error: "Invalid server response." } };
          }
        );
      })
      .then(function (result) {
        setHotelLoading(false);
        hotelsFetched = true;
        if (!result.ok || !result.data || result.data.ok === false) {
          showHotelError((result.data && result.data.error) || "Unable to fetch hotels.");
          return;
        }
        renderHotelSummary(hotelSearchBody, result.data.search || {});
        var cur =
          (result.data.search && result.data.search.currency) ||
          hotelSearchBody.currency ||
          "INR";
        showHotelResults(result.data.hotels || [], cur);
      })
      .catch(function () {
        setHotelLoading(false);
        hotelsFetched = false;
        showHotelError("Could not connect to hotel API. Run `python app.py` and try again.");
      });
  }

  function onHotelsTabShown() {
    if (hotelSearchBody) {
      fetchHotels();
      return;
    }
    if (!flightParams || !window.TravelAirports) return;
    prepareHotelSearch(flightParams, flightSearchMeta).then(function (body) {
      if (body) fetchHotels();
      else showHotelError("Could not determine hotel destination from this flight search.");
    });
  }

  function initTabs() {
    var tabHotels = byId("tab-hotels");
    if (!tabHotels) return;
    tabHotels.addEventListener("shown.bs.tab", onHotelsTabShown);
    if (window.location.hash === "#hotels") {
      if (typeof bootstrap !== "undefined" && bootstrap.Tab) {
        bootstrap.Tab.getOrCreateInstance(tabHotels).show();
      }
    }
  }

  function fetchFlights(body) {
    fetch(body.api_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: body.from,
        to: body.to,
        outbound_date: body.outbound_date,
        return_date: body.round_trip ? body.return_date : null,
        round_trip: body.round_trip,
        trip_type: body.trip_type,
        adults: body.adults,
        cabin: body.cabin,
        currency: body.currency,
      }),
    })
      .then(function (res) {
        return res.json().then(
          function (data) {
            return { ok: res.ok, data: data };
          },
          function () {
            return { ok: false, data: { ok: false, error: "Invalid server response." } };
          }
        );
      })
      .then(function (result) {
        hideFlightLoading();
        flightSearchMeta = (result.data && result.data.search) || {};
        prepareHotelSearch(body, flightSearchMeta);

        if (!result.ok || !result.data || result.data.ok === false) {
          showFlightError((result.data && result.data.error) || "Unable to fetch flights.");
          return;
        }
        renderFlightSummary(body, flightSearchMeta);
        renderFlightList(result.data);
      })
      .catch(function () {
        hideFlightLoading();
        showFlightError("Could not connect to flight API. Run `python app.py` and try again.");
        prepareHotelSearch(body, {});
      });
  }

  function run() {
    flightParams = getParams();
    if (!flightParams.from || !flightParams.to || !flightParams.outbound_date) {
      hideFlightLoading();
      showFlightError("Missing search details. Please return and submit the flight form again.");
      return;
    }

    initTabs();
    prepareHotelSearch(flightParams, {});
    fetchFlights(flightParams);
  }

  run();
})();
