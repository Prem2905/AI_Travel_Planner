(function () {
  "use strict";

  var PS = window.PlannerShared;
  if (!PS) return;

  var session = PS.loadSession();
  if (!session || !session.messages || !session.messages.length) {
    window.location.href = "index.html#hero";
    return;
  }

  var chatEl = document.getElementById("plannerResultsChat");
  var hash = (window.location.hash || "").replace("#", "");

  PS.renderChatMessages(chatEl, session.messages);
  PS.setItinerary(session.reply || "");

  if (hash === "flights") {
    var tabF = document.getElementById("tab-planner-flights");
    if (tabF && window.bootstrap && window.bootstrap.Tab) {
      window.bootstrap.Tab.getOrCreateInstance(tabF).show();
    }
  } else if (hash === "hotels") {
    var tabH = document.getElementById("tab-planner-hotels");
    if (tabH && window.bootstrap && window.bootstrap.Tab) {
      window.bootstrap.Tab.getOrCreateInstance(tabH).show();
    }
  }

  PS.runSearches(session.searches);
})();
