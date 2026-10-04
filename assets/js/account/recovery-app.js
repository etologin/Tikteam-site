// Recovery page: /account/recovery/#purpose=reset|confirm&code=…
// guard.js already moved the fragment into memory and cleared it from the address bar.
// Opening the link changes nothing: only an explicit button press redeems the code,
// so mail scanners that fetch links cannot use it up.

import { MODE, API_BASE, createTransport } from "./config.js";
import { createClient } from "./api.js";
import { recoveryLink } from "./urls.js";
import { t, errorText } from "./i18n.js";
import { byId, el, showOnly, notice, busy, clearPasswords, wireRevealButtons, isPasswordLength } from "./dom.js";

const VIEWS = ["rec-loading", "rec-disabled", "rec-unavailable", "rec-missing", "rec-confirm", "rec-reset", "rec-done"];
const take = typeof window.tikteamTakeRecovery === "function" ? window.tikteamTakeRecovery : () => "";
// The only copy of the code. Cleared as soon as it has been used or rejected.
let link = recoveryLink(take());
let client = null;

start();

function start() {
  wireRevealButtons();
  if (MODE === "mock") byId("mode-note").replaceChildren(el("span", t("mode.mock"), "mode-badge"));
  if (MODE !== "mock" && MODE !== "real") { link = null; showOnly(VIEWS, "rec-disabled"); return; }
  if (!link) { showOnly(VIEWS, "rec-missing"); return; }
  client = createClient({ transport: createTransport(), base: API_BASE });
  addEventListener("pagehide", () => { link = null; clearPasswords(); client?.forget(); });
  // Back from another page: the code was dropped on leaving, so ask for the link again.
  addEventListener("pageshow", (event) => { if (event.persisted) showOnly(VIEWS, "rec-missing"); });
  byId("retry").addEventListener("click", () => { showOnly(VIEWS, "rec-loading"); prepare(); });
  byId("confirm-email").addEventListener("click", (event) => redeem(event.currentTarget, "/auth/confirm-email", () => ({ code: link.code })));
  byId("rec-reset").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const newPassword = byId("reset-password").value;
    if (!isPasswordLength(newPassword)) return notice(t("check.length"), "error");
    if (newPassword !== byId("reset-repeat").value) return notice(t("check.repeat"), "error");
    redeem(form, "/auth/reset-password", () => ({ code: link.code, newPassword }));
  });
  prepare();
}

/** Fetches the CSRF token; the link itself is not sent anywhere yet. */
async function prepare() {
  try {
    await client.bootstrap();
    showOnly(VIEWS, link.purpose === "reset" ? "rec-reset" : "rec-confirm");
    notice("");
  } catch (error) {
    showOnly(VIEWS, "rec-unavailable");
    notice(errorText(error), "error");
  }
}

async function redeem(target, path, body) {
  if (!link) return;
  const restore = busy(target);
  try {
    await client.post(path, body());
    finish();
  } catch (error) {
    if (error.code === "csrf_invalid") { try { await client.bootstrap(); } catch { /* reported on next press */ } }
    if (error.code === "link_invalid") {
      // Expired, wrong or already used: drop the code, offer a new request.
      link = null;
      showOnly(VIEWS, "rec-missing");
    }
    notice(errorText(error), "error");
  } finally {
    clearPasswords();
    restore();
  }
}

function finish() {
  const reset = link.purpose === "reset";
  link = null;
  client.forget();
  byId("done-title").textContent = t(reset ? "recovery.resetDone.title" : "recovery.confirmDone.title");
  byId("done-text").textContent = t(reset ? "recovery.resetDone.text" : "recovery.confirmDone.text");
  showOnly(VIEWS, "rec-done");
  notice("");
}
