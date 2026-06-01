(function (global) {
  "use strict";

  var SORT_PRICE = "price_asc";
  var SORT_RATING = "rating_desc";
  var SORT_REVIEWS = "reviews_desc";

  function priceValue(h) {
    if (!h) return null;
    if (h.rate_per_night_value != null && !isNaN(Number(h.rate_per_night_value))) {
      return Number(h.rate_per_night_value);
    }
    if (h.total_rate_value != null && !isNaN(Number(h.total_rate_value))) {
      return Number(h.total_rate_value);
    }
    var s = h.rate_per_night || h.total_rate || "";
    var digits = String(s).replace(/[^\d.]/g, "");
    return digits ? parseFloat(digits) : null;
  }

  function ratingValue(h) {
    if (!h || h.overall_rating == null || isNaN(Number(h.overall_rating))) return null;
    return Number(h.overall_rating);
  }

  function reviewCount(h) {
    if (!h || h.reviews == null || isNaN(Number(h.reviews))) return 0;
    return Number(h.reviews);
  }

  function priceBounds(hotels) {
    var min = Infinity;
    var max = -Infinity;
    (hotels || []).forEach(function (h) {
      var p = priceValue(h);
      if (p != null && !isNaN(p)) {
        if (p < min) min = p;
        if (p > max) max = p;
      }
    });
    if (!isFinite(min)) return { min: 0, max: 0 };
    return { min: Math.floor(min), max: Math.ceil(max) };
  }

  function apply(hotels, opts) {
    opts = opts || {};
    var out = (hotels || []).slice();
    var minP = opts.minPrice !== "" && opts.minPrice != null ? Number(opts.minPrice) : null;
    var maxP = opts.maxPrice !== "" && opts.maxPrice != null ? Number(opts.maxPrice) : null;
    var minR = opts.minRating !== "" && opts.minRating != null ? Number(opts.minRating) : null;

    out = out.filter(function (h) {
      var p = priceValue(h);
      var rt = ratingValue(h);
      if (minP != null && !isNaN(minP) && (p == null || p < minP)) return false;
      if (maxP != null && !isNaN(maxP) && (p == null || p > maxP)) return false;
      if (minR != null && !isNaN(minR) && (rt == null || rt < minR)) return false;
      return true;
    });

    var sort = opts.sortBy || SORT_PRICE;
    out.sort(function (a, b) {
      if (sort === SORT_RATING) {
        return (ratingValue(b) || 0) - (ratingValue(a) || 0);
      }
      if (sort === SORT_REVIEWS) {
        return reviewCount(b) - reviewCount(a);
      }
      var pa = priceValue(a);
      var pb = priceValue(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
    return out;
  }

  function readState(root) {
    if (!root) return {};
    var minEl = root.querySelector("[data-hf-min-price]");
    var maxEl = root.querySelector("[data-hf-max-price]");
    var ratingEl = root.querySelector("[data-hf-min-rating]");
    var sortEl = root.querySelector("[data-hf-sort]");
    return {
      minPrice: minEl ? minEl.value : "",
      maxPrice: maxEl ? maxEl.value : "",
      minRating: ratingEl ? ratingEl.value : "",
      sortBy: sortEl ? sortEl.value : SORT_PRICE,
    };
  }

  function renderBar(root, hotels, currency) {
    if (!root) return;
    var bounds = priceBounds(hotels);
    var cur = currency || "INR";
    var defaultMin = cur === "INR" ? "500" : bounds.min > 0 ? String(bounds.min) : "Min";
    var defaultMax = cur === "INR" ? "5000" : bounds.max > 0 ? String(bounds.max) : "Max";
    var minPh = bounds.max > 0 ? String(bounds.min) : "Min";
    var maxPh = bounds.max > 0 ? String(bounds.max) : "Max";

    root.innerHTML =
      '<div class="hotel-filters-bar">' +
      '<div class="row g-2 g-md-3 align-items-end">' +
      '<div class="col-6 col-md-2">' +
      '<label class="form-label small mb-1">Min price (' +
      escapeAttr(cur) +
      ")</label>" +
      '<input type="number" class="form-control form-control-sm" data-hf-min-price min="0" step="1" value="' +
      escapeAttr(defaultMin) +
      '" placeholder="' +
      escapeAttr(minPh) +
      '" />' +
      "</div>" +
      '<div class="col-6 col-md-2">' +
      '<label class="form-label small mb-1">Max price (' +
      escapeAttr(cur) +
      ")</label>" +
      '<input type="number" class="form-control form-control-sm" data-hf-max-price min="0" step="1" value="' +
      escapeAttr(defaultMax) +
      '" placeholder="' +
      escapeAttr(maxPh) +
      '" />' +
      "</div>" +
      '<div class="col-6 col-md-3">' +
      '<label class="form-label small mb-1">Minimum rating</label>' +
      '<select class="form-select form-select-sm" data-hf-min-rating>' +
      '<option value="">Any rating</option>' +
      '<option value="3">3.0+ stars</option>' +
      '<option value="3.5">3.5+ stars</option>' +
      '<option value="4">4.0+ stars</option>' +
      '<option value="4.5">4.5+ stars</option>' +
      "</select></div>" +
      '<div class="col-6 col-md-3">' +
      '<label class="form-label small mb-1">Sort by</label>' +
      '<select class="form-select form-select-sm" data-hf-sort>' +
      '<option value="' +
      SORT_PRICE +
      '">Lowest price</option>' +
      '<option value="' +
      SORT_RATING +
      '">Highest rating</option>' +
      '<option value="' +
      SORT_REVIEWS +
      '">Most reviewed</option>' +
      "</select></div>" +
      '<div class="col-12 col-md-2">' +
      '<button type="button" class="btn btn-outline-secondary btn-sm w-100" data-hf-reset>Reset</button>' +
      "</div></div>" +
      '<p class="small text-secondary mb-0 mt-2" data-hf-count></p>' +
      "</div>";
  }

  function updateCount(root, shown, total) {
    var el = root && root.querySelector("[data-hf-count]");
    if (!el) return;
    if (!total) {
      el.textContent = "";
      return;
    }
    el.textContent = "Showing " + shown + " of " + total + " hotels";
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function bind(root, onChange) {
    if (!root || typeof onChange !== "function") return;
    function fire() {
      onChange(readState(root));
    }
    root.addEventListener("input", function (e) {
      if (e.target && e.target.matches("[data-hf-min-price], [data-hf-max-price]")) fire();
    });
    root.addEventListener("change", function (e) {
      if (
        e.target &&
        e.target.matches("[data-hf-min-price], [data-hf-max-price], [data-hf-min-rating], [data-hf-sort]")
      ) {
        fire();
      }
    });
    var reset = root.querySelector("[data-hf-reset]");
    if (reset) {
      reset.addEventListener("click", function () {
        root.querySelectorAll("input").forEach(function (el) {
          el.value = "";
        });
        root.querySelectorAll("select").forEach(function (el) {
          el.selectedIndex = 0;
        });
        fire();
      });
    }
  }

  global.HotelFilters = {
    SORT_PRICE: SORT_PRICE,
    SORT_RATING: SORT_RATING,
    SORT_REVIEWS: SORT_REVIEWS,
    priceValue: priceValue,
    ratingValue: ratingValue,
    reviewCount: reviewCount,
    priceBounds: priceBounds,
    apply: apply,
    readState: readState,
    renderBar: renderBar,
    updateCount: updateCount,
    bind: bind,
  };
})(typeof window !== "undefined" ? window : this);
