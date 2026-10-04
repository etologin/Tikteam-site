// Demo-only control panel for mock builds. Lets a tester issue recovery links, simulate the
// provider confirming a payment, end the session, break the server or hit the rate limit.

import { mockServer } from "./mock-server.js";

const controls = mockServer.controls;
const en = document.documentElement.lang === "en";
const L = (ru, english) => (en ? english : ru);

function button(label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.className = "mock-panel__button";
  b.addEventListener("click", onClick);
  return b;
}

function mount() {
  // Collapsed by default so it never hides the page being tested.
  const panel = document.createElement("details");
  panel.className = "mock-panel";
  const title = document.createElement("summary");
  title.textContent = L("Демо-панель (нет в настоящей сборке)", "Demo panel (not in real builds)");
  const creds = document.createElement("p");
  creds.textContent = `${controls.demo.email} / ${controls.demo.password}`;
  const output = document.createElement("p");
  output.className = "mock-panel__output";
  output.setAttribute("aria-live", "polite");

  // Site root of this demo build: everything before "account/" or "en/account/".
  const root = location.pathname.replace(/(en\/)?account\/.*$/, "");
  function showLink(fragment) {
    output.replaceChildren();
    const a = document.createElement("a");
    // Same-origin link into this demo build; the recovery page has its own demo server.
    a.href = root + (en ? "en/" : "") + "account/recovery/#" + fragment;
    a.textContent = L("Открыть ссылку из письма", "Open the emailed link");
    output.append(a);
  }

  const fill = button(L("Заполнить вход", "Fill sign-in"), () => {
    const email = document.getElementById("login-email");
    const password = document.getElementById("login-password");
    if (email && password) { email.value = controls.demo.email; password.value = controls.demo.password; }
  });
  const reset = button(L("Письмо: новый пароль", "Email: new password"), () => showLink(controls.issueLink("reset")));
  const confirm = button(L("Письмо: подтвердить почту", "Email: confirm address"), () => showLink(controls.issueLink("confirm")));
  const paid = button(L("Оплата прошла (как у Paddle)", "Payment succeeded (as Paddle)"), () => {
    output.textContent = controls.completePayment()
      ? L("Провайдер подтвердил оплату. Права появятся после «Проверить оплату».", "Provider confirmed. Rights appear after “Check payment”.")
      : L("Нет открытой оплаты.", "No open payment.");
  });
  const expire = button(L("Завершить сеанс", "End session"), () => {
    controls.expireSession();
    output.textContent = L("Сеанс истёк. Следующее действие попросит войти.", "Session expired. The next action asks to sign in.");
  });
  const outage = button(L("Сервер: сломать / починить", "Server: break / fix"), () => {
    controls.setOutage(controls.outage ? null : "502");
    output.textContent = controls.outage ? L("Сервер отвечает 502.", "The server answers 502.") : L("Сервер снова работает.", "The server works again.");
  });
  const limit = button(L("Следующий запрос: лимит 30 с", "Next request: 30 s limit"), () => {
    controls.rateLimitNext(30);
    output.textContent = L("Следующий запрос получит 429.", "The next request gets 429.");
  });

  const grid = document.createElement("div");
  grid.className = "mock-panel__grid";
  grid.append(fill, reset, confirm, paid, expire, outage, limit);
  panel.append(title, creds, grid, output);
  document.body.append(panel);
}

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = new URL("./mock-panel.css", import.meta.url).href;
document.head.append(style);
mount();
