(function () {
  "use strict";

  var DATA_URL = "data/airports-iata.json";
  var MAX_RESULTS = 14;
  var DEBOUNCE_MS = 160;
  var records = null;
  var loadPromise = null;

  function ensureLoaded() {
    if (records) return Promise.resolve(records);
    if (loadPromise) return loadPromise;
    loadPromise = fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load airport list");
        return res.json();
      })
      .then(function (rows) {
        records = rows.map(function (a) {
          var iata = (a.iata || "").toUpperCase();
          var name = a.name || "";
          var city = a.city || "";
          var country = a.country || "";
          var blob = (iata + " " + name + " " + city + " " + country).toLowerCase();
          return { iata: iata, name: name, city: city, country: country, blob: blob };
        });
        return records;
      })
      .catch(function (err) {
        console.warn("[airports]", err);
        records = [];
        return records;
      });
    return loadPromise;
  }

  function filterAirports(query) {
    var t = query.trim().toLowerCase();
    if (t.length < 1) return [];
    var parts = t.split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < records.length; i++) {
      var a = records[i];
      var ok = true;
      for (var p = 0; p < parts.length; p++) {
        if (a.blob.indexOf(parts[p]) === -1) {
          ok = false;
          break;
        }
      }
      if (ok) {
        out.push(a);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }

  function formatSelection(a) {
    return a.iata + " — " + a.name + ", " + a.city + " (" + a.country + ")";
  }

  function attach(input, panelId) {
    if (!input || !input.parentNode) return;

    var wrap = input.parentNode;
    var panel = document.createElement("div");
    panel.id = panelId;
    panel.className = "airport-suggestions list-group";
    panel.setAttribute("role", "listbox");
    panel.hidden = true;
    var afterInput = input.nextSibling;
    if (afterInput) {
      wrap.insertBefore(panel, afterInput);
    } else {
      wrap.appendChild(panel);
    }

    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", panelId);
    input.setAttribute("aria-autocomplete", "list");

    var activeIndex = -1;
    var buttons = [];
    var debounceTimer = null;

    function closeList() {
      panel.hidden = true;
      panel.innerHTML = "";
      activeIndex = -1;
      buttons = [];
      input.setAttribute("aria-expanded", "false");
    }

    function highlight() {
      buttons.forEach(function (btn, i) {
        var on = i === activeIndex;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (activeIndex >= 0 && buttons[activeIndex]) {
        buttons[activeIndex].scrollIntoView({ block: "nearest" });
      }
    }

    function openList(matches) {
      panel.innerHTML = "";
      activeIndex = -1;
      buttons = [];
      if (!matches.length) {
        panel.hidden = true;
        input.setAttribute("aria-expanded", "false");
        return;
      }

      matches.forEach(function (a) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "list-group-item list-group-item-action airport-suggestion-item";
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", "false");

        var row = document.createElement("div");
        row.className = "d-flex flex-wrap align-items-baseline gap-2";

        var code = document.createElement("span");
        code.className = "airport-code";
        code.textContent = a.iata;

        var meta = document.createElement("span");
        meta.className = "airport-meta small text-secondary";
        meta.textContent = a.name + " · " + a.city + ", " + a.country;

        row.appendChild(code);
        row.appendChild(meta);
        btn.appendChild(row);

        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
        });
        btn.addEventListener("click", function () {
          input.value = formatSelection(a);
          closeList();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });

        panel.appendChild(btn);
        buttons.push(btn);
      });

      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function runSearch() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        ensureLoaded().then(function () {
          var q = input.value;
          if (!q.trim()) {
            closeList();
            return;
          }
          openList(filterAirports(q));
        });
      }, DEBOUNCE_MS);
    }

    input.addEventListener("input", runSearch);
    input.addEventListener("focus", function () {
      if (input.value.trim()) runSearch();
    });

    input.addEventListener("keydown", function (e) {
      if (panel.hidden || !buttons.length) {
        if (e.key === "Escape") closeList();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, buttons.length - 1);
        highlight();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        highlight();
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        buttons[activeIndex].click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeList();
      }
    });

    document.addEventListener("click", function (e) {
      if (e.target !== input && !panel.contains(e.target)) closeList();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var from = document.getElementById("flightFrom");
    var to = document.getElementById("flightTo");
    if (from) attach(from, "flightFromSuggestions");
    if (to) attach(to, "flightToSuggestions");
  });
})();
