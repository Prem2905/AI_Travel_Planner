(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function getParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      q: params.get("q") || "",
      check_in_date: params.get("check_in_date") || "",
      check_out_date: params.get("check_out_date") || "",
      adults: parseInt(params.get("adults") || "2", 10) || 2,
      children: parseInt(params.get("children") || "0", 10) || 0,
      sort_by: parseInt(params.get("sort_by") || "3", 10) || 3,
      currency: params.get("currency") || "INR",
      api_url: params.get("api_url") || window.HOTEL_API_URL || "/api/hotels",
    };
  }

  function showError(msg) {
    var alert = byId("hotelResultsAlert");
    if (!alert) return;
    alert.textContent = msg;
    alert.classList.remove("d-none");
  }

  function hideLoading() {
    var loading = byId("hotelResultsLoading");
    if (loading) loading.classList.add("d-none");
  }

  function renderSummary(body, search) {
    var summary = byId("hotelResultsSummary");
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

  function showResults(hotels, currency) {
    var list = byId("hotelResultsList");
    var empty = byId("hotelResultsEmpty");
    var filters = byId("hotelResultsFilters");
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

  function run() {
    var body = getParams();
    if (!body.q || !body.check_in_date || !body.check_out_date) {
      hideLoading();
      showError("Missing search details. Please return and submit the hotel form again.");
      return;
    }

    fetch(body.api_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: body.q,
        check_in_date: body.check_in_date,
        check_out_date: body.check_out_date,
        adults: body.adults,
        children: body.children,
        sort_by: body.sort_by,
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
        hideLoading();
        if (!result.ok || !result.data || result.data.ok === false) {
          showError((result.data && result.data.error) || "Unable to fetch hotels.");
          return;
        }
        renderSummary(body, result.data.search || {});
        var cur = (result.data.search && result.data.search.currency) || body.currency || "INR";
        showResults(result.data.hotels || [], cur);
      })
      .catch(function () {
        hideLoading();
        showError("Could not connect to hotel API. Run `python app.py` and try again.");
      });
  }

  run();
})();
