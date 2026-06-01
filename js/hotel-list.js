(function (global) {
  "use strict";

  function escapeHtml(str) {
    var el = document.createElement("div");
    el.textContent = str == null ? "" : String(str);
    return el.innerHTML;
  }

  function formatRating(n) {
    if (n == null || isNaN(Number(n))) return "";
    return Number(n).toFixed(1);
  }

  function safeUrl(url) {
    var s = url == null ? "" : String(url).trim();
    if (!/^https?:\/\//i.test(s)) return "";
    return s;
  }

  function renderHotels(listEl, emptyEl, hotels) {
    if (!listEl || !emptyEl) return;
    listEl.innerHTML = "";
    if (!hotels || !hotels.length) {
      emptyEl.classList.remove("d-none");
      return;
    }
    emptyEl.classList.add("d-none");

    hotels.forEach(function (h) {
      var price = h.rate_per_night || h.total_rate || "—";
      var rating = formatRating(h.overall_rating);
      var reviews = h.reviews != null ? String(h.reviews) + " reviews" : "";
      var meta = [h.type, rating ? "Rating " + rating : "", reviews].filter(Boolean).join(" · ");
      var thumb = h.thumbnail ? escapeHtml(h.thumbnail) : "";
      var bookUrl = safeUrl(h.link);

      var item = document.createElement("div");
      item.className = "list-group-item border-0 border-bottom py-3 flight-result-row";
      var imgBlock = thumb
        ? '<div class="flex-shrink-0 rounded-2 overflow-hidden hotel-thumb-wrap"><img src="' +
          thumb +
          '" alt="" class="hotel-thumb-img" width="96" height="72" loading="lazy" /></div>'
        : '<div class="flex-shrink-0 rounded-2 bg-light hotel-thumb-placeholder" aria-hidden="true"></div>';

      item.innerHTML =
        '<div class="d-flex flex-wrap justify-content-between align-items-start gap-3">' +
        '<div class="d-flex gap-3 flex-grow-1 min-w-0">' +
        imgBlock +
        '<div class="min-w-0"><h3 class="h6 mb-1">' +
        escapeHtml(h.name || "Property") +
        "</h3>" +
        '<p class="small text-secondary mb-1">' +
        escapeHtml(meta) +
        "</p>" +
        (h.hotel_class
          ? '<p class="small text-muted mb-0">' + escapeHtml("Class " + String(h.hotel_class)) + "</p>"
          : '<p class="small text-muted mb-0">&nbsp;</p>') +
        "</div></div>" +
        '<div class="text-end d-flex flex-column align-items-end gap-2">' +
        '<div><div class="fs-5 fw-bold text-accent">' +
        escapeHtml(String(price)) +
        '</div><div class="small text-secondary">Per night</div></div>' +
        (bookUrl
          ? '<a href="' +
            escapeHtml(bookUrl) +
            '" class="btn btn-sm btn-accent" target="_blank" rel="noopener noreferrer">View hotel</a>'
          : "") +
        "</div></div>";
      listEl.appendChild(item);
    });
  }

  function setupFilters(filterRoot, listEl, emptyEl, allHotels, currency) {
    if (!global.HotelFilters || !filterRoot) {
      renderHotels(listEl, emptyEl, allHotels);
      return;
    }

    var HF = global.HotelFilters;
    HF.renderBar(filterRoot, allHotels, currency);
    filterRoot.classList.remove("d-none");

    function refresh(state) {
      var filtered = HF.apply(allHotels, state);
      HF.updateCount(filterRoot, filtered.length, allHotels.length);
      renderHotels(listEl, emptyEl, filtered);
    }

    HF.bind(filterRoot, refresh);
    refresh(HF.readState(filterRoot));
  }

  global.HotelList = {
    renderHotels: renderHotels,
    setupFilters: setupFilters,
  };
})(typeof window !== "undefined" ? window : this);
