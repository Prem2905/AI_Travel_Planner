(function (global) {
  "use strict";

  var STORAGE_KEY = "wanderlust_planner_session";

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  function formatMarkdownLite(text) {
    var html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function saveSession(data) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function formatDurationMinutes(min) {
    if (min == null || isNaN(Number(min))) return "";
    var total = Math.round(Number(min));
    var h = Math.floor(total / 60);
    var m = total % 60;
    return (h ? h + "h " : "") + m + "m";
  }

  function renderChatMessages(container, messages) {
    if (!container) return;
    container.innerHTML = "";
    if (!messages || !messages.length) return;
    messages.forEach(function (m) {
      var bubble = document.createElement("div");
      bubble.className =
        "planner-chat-bubble " + (m.role === "user" ? "planner-chat-bubble-user" : "planner-chat-bubble-ai");
      bubble.innerHTML =
        '<span class="planner-chat-role">' +
        (m.role === "user" ? "You" : "Planner") +
        "</span>" +
        '<div class="planner-chat-text">' +
        formatMarkdownLite(m.content) +
        "</div>";
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  }

  function setItinerary(reply) {
    var summary = document.getElementById("plannerItinerarySummary");
    var body = document.getElementById("plannerItineraryBody");
    if (summary) {
      summary.textContent = "AI travel plan — updated " + new Date().toLocaleString();
    }
    if (body) {
      body.innerHTML = formatMarkdownLite(reply || "");
    }
  }

  function renderFlightList(payload, body) {
    var list = document.getElementById("plannerFlightList");
    var empty = document.getElementById("plannerFlightEmpty");
    var loading = document.getElementById("plannerFlightLoading");
    var summary = document.getElementById("plannerFlightSummary");
    var alert = document.getElementById("plannerFlightAlert");

    if (loading) loading.classList.add("d-none");
    if (!list || !empty) return;
    if (alert) alert.classList.add("d-none");
    list.innerHTML = "";

    if (summary && body) {
      summary.textContent =
        (body.from || "?") +
        " → " +
        (body.to || "?") +
        " · " +
        (body.outbound_date || "") +
        (body.round_trip && body.return_date ? " – " + body.return_date : "");
    }

    if (!payload.flights || !payload.flights.length) {
      empty.classList.remove("d-none");
      return;
    }
    empty.classList.add("d-none");
    var currency = (payload.search && payload.search.currency) || body.currency || "INR";

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
        '</h3><p class="small text-secondary mb-1">' +
        escapeHtml(f.departure_time || "") +
        " → " +
        escapeHtml(f.arrival_time || "") +
        '</p><p class="small text-muted mb-0">' +
        escapeHtml(f.from_id || "") +
        " → " +
        escapeHtml(f.to_id || "") +
        " · " +
        stops +
        (dur ? " · " + dur : "") +
        '</p></div><div class="text-end"><div class="fs-5 fw-bold text-accent">' +
        escapeHtml(price) +
        '</div><div class="small text-secondary">' +
        escapeHtml(currency) +
        "</div></div></div>";
      list.appendChild(item);
    });
  }

  function showFlightError(msg) {
    var alert = document.getElementById("plannerFlightAlert");
    var loading = document.getElementById("plannerFlightLoading");
    if (loading) loading.classList.add("d-none");
    if (alert) {
      alert.textContent = msg;
      alert.classList.remove("d-none");
    }
  }

  function fetchFlights(body, options) {
    options = options || {};
    var loading = document.getElementById("plannerFlightLoading");
    var tab = document.getElementById("tab-planner-flights");
    if (loading) loading.classList.remove("d-none");
    if (options.switchTab !== false && tab && global.bootstrap && global.bootstrap.Tab) {
      global.bootstrap.Tab.getOrCreateInstance(tab).show();
    }

    var apiUrl = global.FLIGHT_API_URL || "/api/flights";
    return fetch(apiUrl, {
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
        currency: body.currency || "INR",
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data || result.data.ok === false) {
          showFlightError((result.data && result.data.error) || "Unable to fetch flights.");
          return result;
        }
        renderFlightList(result.data, body);
        return result;
      })
      .catch(function () {
        showFlightError("Could not connect to flight API. Run python app.py.");
      });
  }

  function showHotelError(msg) {
    var alert = document.getElementById("plannerHotelAlert");
    var loading = document.getElementById("plannerHotelLoading");
    if (loading) loading.classList.add("d-none");
    if (alert) {
      alert.textContent = msg;
      alert.classList.remove("d-none");
    }
  }

  function fetchHotels(body, options) {
    options = options || {};
    var tab = document.getElementById("tab-planner-hotels");
    if (options.switchTab !== false && tab && global.bootstrap && global.bootstrap.Tab) {
      global.bootstrap.Tab.getOrCreateInstance(tab).show();
    }

    var loading = document.getElementById("plannerHotelLoading");
    var summary = document.getElementById("plannerHotelSummary");
    var alert = document.getElementById("plannerHotelAlert");
    if (loading) loading.classList.remove("d-none");
    if (alert) alert.classList.add("d-none");

    if (summary) {
      summary.textContent =
        body.q +
        " · " +
        body.check_in_date +
        " – " +
        body.check_out_date +
        " · " +
        (body.adults || 2) +
        " adult(s)";
    }

    var apiUrl = global.HOTEL_API_URL || "/api/hotels";
    return fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: body.q,
        check_in_date: body.check_in_date,
        check_out_date: body.check_out_date,
        adults: body.adults,
        children: body.children || 0,
        sort_by: 3,
        currency: body.currency || "INR",
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (loading) loading.classList.add("d-none");
        var list = document.getElementById("plannerHotelList");
        var empty = document.getElementById("plannerHotelEmpty");
        var filters = document.getElementById("plannerHotelFilters");

        if (!result.ok || !result.data || result.data.ok === false) {
          showHotelError((result.data && result.data.error) || "Unable to fetch hotels.");
          return result;
        }

        var hotels = result.data.hotels || [];
        var cur = (result.data.search && result.data.search.currency) || body.currency || "INR";
        if (global.HotelList && list && empty) {
          if (filters) filters.classList.add("d-none");
          global.HotelList.setupFilters(filters, list, empty, hotels, cur);
          if (filters && hotels.length) filters.classList.remove("d-none");
        }
        return result;
      })
      .catch(function () {
        showHotelError("Could not connect to hotel API. Run python app.py.");
      });
  }

  function runSearches(searches) {
    if (!searches) return;
    var flightPromise = searches.flight
      ? fetchFlights(searches.flight, { switchTab: false })
      : Promise.resolve();
    flightPromise.then(function (flightResult) {
      if (searches.hotel) {
        fetchHotels(searches.hotel, { switchTab: !searches.flight });
        return;
      }
      if (searches.flight && flightResult && flightResult.data && global.TravelAirports) {
        global.TravelAirports.ensureLoaded().then(function () {
          var hotelBody = global.TravelAirports.buildHotelSearchFromFlight(
            searches.flight,
            flightResult.data.search || {}
          );
          if (hotelBody && hotelBody.q) {
            fetchHotels(hotelBody, { switchTab: false });
          }
        });
      }
    });
  }

  global.PlannerShared = {
    STORAGE_KEY: STORAGE_KEY,
    escapeHtml: escapeHtml,
    formatMarkdownLite: formatMarkdownLite,
    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession,
    renderChatMessages: renderChatMessages,
    setItinerary: setItinerary,
    runSearches: runSearches,
  };
})(typeof window !== "undefined" ? window : this);
