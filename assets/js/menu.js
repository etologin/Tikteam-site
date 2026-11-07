// Mobile menu. The <details class="menu"> in the header opens and closes without this script;
// it only closes the menu after a link is chosen, on Escape and on a tap outside it, so the
// panel never stays open over the page. Nothing is stored and nothing is sent anywhere.
(function () {
  "use strict";
  var menus = document.querySelectorAll("details.menu");
  Array.prototype.forEach.call(menus, function (menu) {
    var toggle = menu.querySelector("summary");
    function close() { menu.open = false; }
    Array.prototype.forEach.call(menu.querySelectorAll("a"), function (link) {
      link.addEventListener("click", close);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menu.open) { close(); toggle.focus(); }
    });
    document.addEventListener("click", function (event) {
      if (menu.open && !menu.contains(event.target)) close();
    });
  });
})();
