// Runs synchronously in <head>, before anything else on account pages.
// 1. Static hosting cannot send frame-ancestors, so the page stays hidden when framed.
// 2. On the recovery page the link fragment is taken into memory and removed from the
//    address bar and history before any other resource or script runs.
(function () {
  "use strict";
  var root = document.documentElement;
  if (window.top === window.self) root.classList.remove("account-guard");

  var fragment = "";
  if (root.getAttribute("data-recovery") === "1") {
    if (location.hash.length > 1) {
      fragment = location.hash.slice(1);
      history.replaceState(null, "", location.pathname + location.search);
    }
    // Another emailed link opened in this tab changes only the fragment and does not
    // reload the page; reload so the new code is taken and cleared the same way.
    window.addEventListener("hashchange", function () { if (location.hash.length > 1) location.reload(); });
  }
  var taken = false;
  Object.defineProperty(window, "tikteamTakeRecovery", {
    value: function () {
      if (taken) return "";
      taken = true;
      var value = fragment;
      fragment = "";
      return value;
    },
    configurable: false, enumerable: false, writable: false
  });
})();
