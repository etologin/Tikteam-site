// Demo-only control panel for mock builds. Lets a tester issue recovery links, simulate the
// provider confirming a payment, play the API's Google pages, switch Google or the email
// confirmation off, end the session, break the server or hit the rate limit.

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
  // Letters go to the signed-in account when there is one, otherwise to the demo account.
  const target = () => controls.currentEmail() ?? controls.demo.email;
  const reset = button(L("Письмо: новый пароль", "Email: new password"), () => showLink(controls.issueLink("reset", target())));
  const confirm = button(L("Письмо: подтвердить почту", "Email: confirm address"), () => showLink(controls.issueLink("confirm", target())));
  // The account page reads the server again on pageshow, as when the browser returns from Google.
  const reload = () => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  const GOOGLE_RESULTS = {
    created: L("Google вернул новый адрес: создан аккаунт без пароля, вход выполнен.", "Google returned a new address: an account without a password was created and signed in."),
    signed_in: L("Вход через привязанный Google выполнен.", "Signed in with the linked Google account."),
    linked: L("Google привязан, сеанс сайта обновлён.", "Google is linked; the website session was renewed."),
    google_link_required: L("Адрес уже зарегистрирован с паролем: сервер показал бы на своей странице «войдите с паролем и привяжите Google». На сайте ничего не изменилось.",
      "The address is registered with a password: the server's own page would say “sign in with the password and link Google”. Nothing changed on the website."),
    google_link_conflict: L("Google с другим адресом или чужой: сервер отказал бы в привязке.", "A Google account with another address or someone else's: the server would refuse to link."),
    google_flow_expired: L("Нет начатого входа через Google — сначала нажмите кнопку Google на странице.", "No Google sign-in started — press the Google button on the page first."),
    logout_required: L("В браузере уже открыт другой аккаунт: сервер не заменил бы его молча.", "Another account is open in this browser: the server would not replace it silently."),
    session_expired: L("Сеанс сменился во время привязки: сервер отказал бы.", "The session changed during linking: the server would refuse."),
  };
  function finishGoogle(options) {
    const result = controls.completeGoogle(options);
    output.textContent = GOOGLE_RESULTS[result] ?? result;
    if (["created", "signed_in", "linked"].includes(result)) reload();
  }
  const google = button(L("Google: подтвердить вход", "Google: approve sign-in"), () => finishGoogle());
  const googleDemo = button(L("Google: адрес демо-аккаунта", "Google: demo account's address"), () => finishGoogle({ email: controls.demo.email }));
  const googleSwitch = button(L("Google: выключить / включить", "Google: turn off / on"), () => {
    controls.setGoogleEnabled(!controls.googleEnabled);
    output.textContent = controls.googleEnabled ? L("Сервер: Google настроен.", "Server: Google is configured.") : L("Сервер: Google не настроен (enabled=false).", "Server: Google is not configured (enabled=false).");
    reload();
  });
  const unconfirm = button(L("Почта: снять / вернуть подтверждение", "Email: unconfirm / confirm"), () => {
    const email = target();
    const user = controls.users.get(email);
    controls.setConfirmed(!user.confirmed, email);
    output.textContent = (user.confirmed ? L("Почта подтверждена: ", "Email confirmed: ") : L("Почта не подтверждена: ", "Email not confirmed: ")) + email;
    reload();
  });
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
  grid.append(fill, google, googleDemo, googleSwitch, unconfirm, reset, confirm, paid, expire, outage, limit);
  panel.append(title, creds, grid, output);
  document.body.append(panel);
}

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = new URL("./mock-panel.css", import.meta.url).href;
document.head.append(style);
mount();
