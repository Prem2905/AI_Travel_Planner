(function () {
  "use strict";

  var navbar = document.getElementById("mainNav");
  var backToTop = document.getElementById("backToTop");
  var yearEl = document.getElementById("year");

  /* Current year in footer */
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* Smooth scrolling for anchor links */
  document.querySelectorAll('a.smooth-link, a.nav-link[href^="#"]').forEach(function (anchor) {
    var href = anchor.getAttribute("href");
    if (!href || href === "#") return;

    anchor.addEventListener("click", function (e) {
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        var prefersReduced =
          typeof window.matchMedia !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
        var navCollapse = document.getElementById("navMenu");
        if (navCollapse && typeof bootstrap !== "undefined" && bootstrap.Collapse) {
          var bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
          if (bsCollapse) bsCollapse.hide();
        }
      }
    });
  });

  /* Navbar background on scroll */
  function updateNav() {
    if (!navbar) return;
    if (window.scrollY > 40) {
      navbar.classList.add("nav-scrolled");
    } else {
      navbar.classList.remove("nav-scrolled");
    }
  }

  window.addEventListener("scroll", updateNav, { passive: true });
  updateNav();

  /* Back to top visibility */
  function updateBackToTop() {
    if (!backToTop) return;
    if (window.scrollY > 400) {
      backToTop.classList.add("visible");
    } else {
      backToTop.classList.remove("visible");
    }
  }

  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      var prefersReduced =
        typeof window.matchMedia !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    });
  }

  /* Scroll reveal */
  var fadeSections = document.querySelectorAll(".section-fade");

  function revealSections() {
    var trigger = window.innerHeight * 0.88;
    fadeSections.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < trigger) {
        el.classList.add("is-visible");
      }
    });
  }

  window.addEventListener("scroll", revealSections, { passive: true });
  window.addEventListener("resize", revealSections, { passive: true });
  revealSections();

  /* Interactive hover enhancement (tilt-lite on cards via JS + mousemove) */
  function tiltCard(ev) {
    var reduced =
      typeof window.matchMedia !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    var card = ev.currentTarget;
    var rect = card.getBoundingClientRect();
    var x = ((ev.clientX - rect.left) / rect.width - 0.5) * 8;
    var y = ((ev.clientY - rect.top) / rect.height - 0.5) * -8;
    card.style.transform = "translateY(-8px) scale(1.02) perspective(800px) rotateY(" + x + "deg) rotateX(" + y + "deg)";
  }

  function resetTilt(ev) {
    var card = ev.currentTarget;
    card.style.transform = "";
  }

  document.querySelectorAll(".service-card, .dest-card").forEach(function (card) {
    card.style.transition = "transform 0.2s ease, box-shadow 0.3s ease";
    card.addEventListener("mousemove", tiltCard);
    card.addEventListener("mouseleave", resetTilt);
  });

  /* Toast for demo form submit */
  var toastEl = document.getElementById("formToast");
  var toastBody = document.getElementById("toastBody");
  var toast =
    toastEl && typeof bootstrap !== "undefined" && bootstrap.Toast
      ? new bootstrap.Toast(toastEl, { delay: 4000 })
      : null;

  function showToast(message) {
    if (toastBody) toastBody.textContent = message;
    if (toast) toast.show();
  }

  function handleFormSubmit(formId, message) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
      }
      form.classList.remove("was-validated");
      form.reset();
      showToast(message);
    });
  }

  handleFormSubmit("contactFormMain", "Thank you—we received your message and will reply shortly.");
  handleFormSubmit("subscribeForm", "You are subscribed. Watch your inbox for the next Wanderlust digest.");
  handleFormSubmit("footerContactForm", "Quick message sent! We will follow up from hello@wanderlust.tours.");

  /* Flight booking: trip type, dates, submit */
  var flightForm = document.getElementById("flightBookingForm");
  var flightReturn = document.getElementById("flightReturn");
  var flightReturnGroup = document.getElementById("flightReturnGroup");
  var flightDepart = document.getElementById("flightDepart");
  var tripRound = document.getElementById("tripRound");
  var tripOneWay = document.getElementById("tripOneWay");

  function syncFlightReturnRules() {
    if (!flightReturn || !flightDepart) return;
    var round = tripRound && tripRound.checked;
    if (round) {
      if (flightReturnGroup) {
        flightReturnGroup.classList.remove("d-none");
        flightReturnGroup.removeAttribute("aria-hidden");
      }
      flightReturn.disabled = false;
      flightReturn.required = true;
      if (flightDepart.value) {
        flightReturn.min = flightDepart.value;
      }
    } else {
      if (flightReturnGroup) {
        flightReturnGroup.classList.add("d-none");
        flightReturnGroup.setAttribute("aria-hidden", "true");
      }
      flightReturn.required = false;
      flightReturn.disabled = true;
      flightReturn.value = "";
      flightReturn.removeAttribute("min");
      flightReturn.classList.remove("is-invalid");
      flightReturn.setCustomValidity("");
    }
  }

  function validateFlightDates() {
    if (!flightReturn || !flightDepart || !tripRound) return true;
    if (!tripRound.checked) return true;
    if (!flightDepart.value || !flightReturn.value) return true;
    if (flightReturn.value < flightDepart.value) {
      flightReturn.setCustomValidity("Return must be on or after departure.");
      return false;
    }
    flightReturn.setCustomValidity("");
    return true;
  }

  if (tripRound && tripOneWay) {
    tripRound.addEventListener("change", syncFlightReturnRules);
    tripOneWay.addEventListener("change", syncFlightReturnRules);
  }
  if (flightDepart) {
    flightDepart.addEventListener("change", function () {
      syncFlightReturnRules();
      if (flightReturn && flightReturn.value && flightReturn.value < flightDepart.value) {
        flightReturn.value = flightDepart.value;
      }
    });
  }
  if (flightReturn) {
    flightReturn.addEventListener("change", function () {
      validateFlightDates();
    });
  }
  syncFlightReturnRules();

  var flightSubmitBtn = document.getElementById("flightSubmitBtn");
  var flightPassengers = document.getElementById("flightPassengers");
  var flightCabin = document.getElementById("flightCabin");
  var flightFrom = document.getElementById("flightFrom");
  var flightTo = document.getElementById("flightTo");

  function setFlightLoading(loading) {
    if (!flightSubmitBtn) return;
    flightSubmitBtn.disabled = loading;
    var sp = flightSubmitBtn.querySelector(".flight-btn-spinner");
    var lb = flightSubmitBtn.querySelector(".flight-btn-label");
    if (sp) sp.classList.toggle("d-none", !loading);
    if (lb) lb.textContent = loading ? "Searching…" : "Search flights";
  }

  if (flightForm) {
    flightForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      syncFlightReturnRules();
      if (!validateFlightDates()) {
        flightForm.classList.add("was-validated");
        return;
      }
      if (!flightForm.checkValidity()) {
        flightForm.classList.add("was-validated");
        return;
      }
      flightForm.classList.remove("was-validated");

      var apiUrl = window.FLIGHT_API_URL || "/api/flights";
      var roundTrip = tripRound && tripRound.checked;
      var toValue = flightTo ? flightTo.value : "";
      var destCity =
        window.TravelAirports && window.TravelAirports.cityFromFlightInput
          ? window.TravelAirports.cityFromFlightInput(toValue)
          : null;

      var body = {
        from: flightFrom ? flightFrom.value : "",
        to: toValue,
        outbound_date: flightDepart ? flightDepart.value : "",
        return_date: roundTrip && flightReturn ? flightReturn.value : null,
        round_trip: roundTrip,
        trip_type: roundTrip ? "round" : "oneway",
        adults: flightPassengers ? parseInt(flightPassengers.value, 10) || 1 : 1,
        cabin: flightCabin ? flightCabin.value : "economy",
        currency: "INR",
      };
      if (destCity) body.destination_city = destCity;

      setFlightLoading(true);
      var query = new URLSearchParams();
      Object.keys(body).forEach(function (key) {
        var val = body[key];
        if (val != null && val !== "") query.set(key, String(val));
      });
      window.location.href = "results.html?" + query.toString() + "&api_url=" + encodeURIComponent(apiUrl);
    });
  }

  /* Hotel booking: dates, submit */
  var hotelForm = document.getElementById("hotelBookingForm");
  var hotelCheckIn = document.getElementById("hotelCheckIn");
  var hotelCheckOut = document.getElementById("hotelCheckOut");

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

  function syncHotelCheckoutMin() {
    if (!hotelCheckIn || !hotelCheckOut) return;
    var v = hotelCheckIn.value;
    if (v) {
      var minOut = nextDateString(v);
      hotelCheckOut.min = minOut;
      if (hotelCheckOut.value && hotelCheckOut.value <= v) {
        hotelCheckOut.value = minOut;
      }
    } else {
      hotelCheckOut.removeAttribute("min");
    }
  }

  function validateHotelDates() {
    if (!hotelCheckIn || !hotelCheckOut) return true;
    if (!hotelCheckIn.value || !hotelCheckOut.value) return true;
    if (hotelCheckOut.value <= hotelCheckIn.value) {
      hotelCheckOut.setCustomValidity("Check-out must be after check-in.");
      return false;
    }
    hotelCheckOut.setCustomValidity("");
    return true;
  }

  if (hotelCheckIn) {
    hotelCheckIn.addEventListener("change", function () {
      syncHotelCheckoutMin();
      validateHotelDates();
    });
  }
  if (hotelCheckOut) {
    hotelCheckOut.addEventListener("change", validateHotelDates);
  }
  syncHotelCheckoutMin();

  var hotelSubmitBtn = document.getElementById("hotelSubmitBtn");
  var hotelQuery = document.getElementById("hotelQuery");
  var hotelAdults = document.getElementById("hotelAdults");
  var hotelChildren = document.getElementById("hotelChildren");
  var hotelSort = document.getElementById("hotelSort");
  var hotelCurrency = document.getElementById("hotelCurrency");

  function setHotelLoading(loading) {
    if (!hotelSubmitBtn) return;
    hotelSubmitBtn.disabled = loading;
    var sp = hotelSubmitBtn.querySelector(".hotel-btn-spinner");
    var lb = hotelSubmitBtn.querySelector(".hotel-btn-label");
    if (sp) sp.classList.toggle("d-none", !loading);
    if (lb) lb.textContent = loading ? "Searching…" : "Search hotels";
  }

  if (hotelForm) {
    hotelForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      syncHotelCheckoutMin();
      if (!validateHotelDates()) {
        hotelForm.classList.add("was-validated");
        return;
      }
      if (!hotelForm.checkValidity()) {
        hotelForm.classList.add("was-validated");
        return;
      }
      hotelForm.classList.remove("was-validated");

      var apiUrl = window.HOTEL_API_URL || "/api/hotels";
      var body = {
        q: hotelQuery ? hotelQuery.value.trim() : "",
        check_in_date: hotelCheckIn ? hotelCheckIn.value : "",
        check_out_date: hotelCheckOut ? hotelCheckOut.value : "",
        adults: hotelAdults ? parseInt(hotelAdults.value, 10) || 2 : 2,
        children: hotelChildren ? parseInt(hotelChildren.value, 10) || 0 : 0,
        sort_by: hotelSort ? parseInt(hotelSort.value, 10) || 3 : 3,
        currency: hotelCurrency ? hotelCurrency.value : "INR",
      };

      setHotelLoading(true);
      var query = new URLSearchParams(body).toString();
      window.location.href = "hotel-results.html?" + query + "&api_url=" + encodeURIComponent(apiUrl);
    });
  }
})();
