(function () {
  "use strict";

  var messages = [];
  var chatEl = document.getElementById("heroChatMessages");
  var form = document.getElementById("heroChatForm");
  var input = document.getElementById("heroChatInput");
  var sendBtn = document.getElementById("heroChatSend");
  var clearBtn = document.getElementById("heroChatClear");

  if (!form || !input || !chatEl || !window.PlannerShared) return;

  var PS = window.PlannerShared;

  function collectBookingContext() {
    var ctx = {};
    var from = document.getElementById("flightFrom");
    var to = document.getElementById("flightTo");
    var depart = document.getElementById("flightDepart");
    var ret = document.getElementById("flightReturn");
    var pax = document.getElementById("flightPassengers");
    var cabin = document.getElementById("flightCabin");
    var tripRound = document.getElementById("tripRound");

    if (from && from.value && to && to.value) {
      ctx.flight = {
        from: from.value,
        to: to.value,
        outbound_date: depart ? depart.value : "",
        return_date: ret && tripRound && tripRound.checked ? ret.value : null,
        round_trip: tripRound ? tripRound.checked : true,
        adults: pax ? parseInt(pax.value, 10) || 1 : 1,
        cabin: cabin ? cabin.value : "economy",
      };
    }

    var hq = document.getElementById("hotelQuery");
    var cin = document.getElementById("hotelCheckIn");
    var cout = document.getElementById("hotelCheckOut");
    var adults = document.getElementById("hotelAdults");
    var children = document.getElementById("hotelChildren");

    if (hq && hq.value.trim()) {
      ctx.hotel = {
        q: hq.value.trim(),
        check_in_date: cin ? cin.value : "",
        check_out_date: cout ? cout.value : "",
        adults: adults ? parseInt(adults.value, 10) || 2 : 2,
        children: children ? parseInt(children.value, 10) || 0 : 0,
      };
    }

    if (to && to.value) {
      ctx.destination =
        window.TravelAirports && window.TravelAirports.cityFromFlightInput
          ? window.TravelAirports.cityFromFlightInput(to.value) || to.value
          : to.value;
    } else if (hq && hq.value.trim()) {
      ctx.destination = hq.value.trim();
    }

    return ctx;
  }

  function renderChat() {
    if (!messages.length) {
      chatEl.innerHTML =
        '<p class="hero-chat-welcome small text-white-50 mb-0">Try: &ldquo;5-day trip to Goa&rdquo; or &ldquo;Flights Delhi to Mumbai June 15&rdquo;</p>';
      return;
    }
    chatEl.innerHTML = "";
    messages.forEach(function (m) {
      var bubble = document.createElement("div");
      bubble.className =
        "hero-chat-bubble " + (m.role === "user" ? "hero-chat-bubble-user" : "hero-chat-bubble-ai");
      bubble.innerHTML =
        '<span class="hero-chat-role">' +
        (m.role === "user" ? "You" : "Planner") +
        "</span>" +
        '<div class="hero-chat-text">' +
        PS.formatMarkdownLite(m.content) +
        "</div>";
      chatEl.appendChild(bubble);
    });
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function setLoading(on) {
    if (!sendBtn) return;
    sendBtn.disabled = on;
    input.disabled = on;
    var sp = sendBtn.querySelector(".hero-chat-spinner");
    var lb = sendBtn.querySelector(".hero-chat-send-label");
    if (sp) sp.classList.toggle("d-none", !on);
    if (lb) lb.textContent = on ? "…" : "Send";
  }

  function goToResults(reply, searches, bookingContext) {
    PS.saveSession({
      messages: messages,
      reply: reply,
      searches: searches || { flight: null, hotel: null },
      booking_context: bookingContext,
    });
    window.location.href = "planner-results.html";
  }

  function sendMessage(text) {
    var trimmed = (text || "").trim();
    if (!trimmed) return;

    messages.push({ role: "user", content: trimmed });
    renderChat();
    input.value = "";
    setLoading(true);

    var apiUrl = window.PLANNER_API_URL || "/api/planner/chat";
    var bookingContext = collectBookingContext();

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages,
        booking_context: bookingContext,
        extract_searches: true,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        setLoading(false);
        if (!result.ok || !result.data || !result.data.ok) {
          var err = (result.data && result.data.error) || "Planner unavailable.";
          messages.push({ role: "assistant", content: "Sorry — " + err });
          renderChat();
          return;
        }
        var reply = result.data.reply || "";
        messages.push({ role: "assistant", content: reply });
        goToResults(reply, result.data.searches, bookingContext);
      })
      .catch(function () {
        setLoading(false);
        messages.push({
          role: "assistant",
          content:
            "Could not reach the AI planner. Check GEMINI_API_KEY in .env and run python app.py.",
        });
        renderChat();
      });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    sendMessage(input.value);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      messages = [];
      PS.clearSession();
      renderChat();
    });
  }
})();
