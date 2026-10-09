// Account page: sign-in, registration, password reminder, Google and the dashboard.
// Flow: GET /session → sign in → GET /session again (new CSRF) → the profile alone; computers
// and billing only once the email is confirmed (the server refuses them with email_unconfirmed).

import { MODE, API_ORIGIN, API_BASE, CHECKOUT_ORIGIN, createTransport } from "./config.js";
import { ApiError, createClient } from "./api.js";
import { checkoutUrl, portalUrl, googleStartUrl } from "./urls.js";
import { dashboardPlan } from "./dashboard.js";
import { t, errorText, billingState, moduleName, packName, formatDate, pageLang } from "./i18n.js";
import { byId, el, showOnly, notice, busy, clearPasswords, wireRevealButtons, isEmail, isPasswordLength } from "./dom.js";

const VIEWS = ["view-loading", "view-disabled", "view-unavailable", "view-auth", "view-dashboard"];
const CARDS = { billing: "card-billing", modules: "card-modules", devices: "card-devices", google: "card-google", security: "card-security" };
let client = null;
// Dashboard data lives only here and is dropped on sign-out, expiry and page hide.
let data = null;
let checkoutOpened = false;
// Answer of GET /auth/google/config: true, false, or null while unknown. Only true shows Google.
let googleEnabled = null;

start();

function start() {
  wireRevealButtons();
  wireTabs();
  if (MODE === "mock") byId("mode-note").replaceChildren(el("span", t("mode.mock"), "mode-badge"));
  if (MODE !== "mock" && MODE !== "real") { showOnly(VIEWS, "view-disabled"); return; }
  client = createClient({ transport: createTransport(), base: API_BASE });
  wireForms();
  // Leaving the page (or bfcache) must not keep passwords, tokens or account data around.
  addEventListener("pagehide", () => { clearPasswords(); data = null; client?.forget(); });
  addEventListener("pageshow", (event) => { if (event.persisted) refresh(); });
  refresh();
}

/**
 * Reloads the session and shows the sign-in forms or the dashboard. This is also where the
 * browser lands after Google: the redirect proves nothing, only the server's answer here does.
 */
async function refresh(message, tone = "ok", retried = false) {
  try {
    const session = await client.bootstrap();
    if (session.authenticated) await loadDashboard();
    else showSignIn();
    notice(message ?? "", tone);
  } catch (error) {
    // The session ended between the two requests: start once more, as a visitor.
    if (error.code === "session_expired" && !retried) { await refresh(t("err.session_expired"), "error", true); return; }
    dropDashboard();
    byId("unavailable-text").textContent = errorText(error);
    showOnly(VIEWS, "view-unavailable");
  }
}

function showSignIn() {
  dropDashboard();
  showOnly(VIEWS, "view-auth");
  loadGoogleConfig();
}

async function loadDashboard() {
  // The profile comes first and alone: it is all an unconfirmed account may read.
  const account = (await client.get("/account")).body ?? {};
  data = { account, devices: null, billing: null, failed: {} };
  if (!dashboardPlan(account, googleEnabled).loadFeatures) { renderDashboard(); return; }
  const [devices, billing] = await Promise.allSettled([client.get("/account/devices"), client.get("/billing/status")]);
  const errors = [devices, billing].filter((r) => r.status === "rejected").map((r) => r.reason);
  const expired = errors.find((e) => e?.code === "session_expired");
  if (expired) throw expired;
  // Confirmation withdrawn in the meantime: the server's refusal wins over the profile just read.
  if (errors.some((e) => e?.code === "email_unconfirmed")) { data.account = { ...account, emailConfirmed: false }; renderDashboard(); return; }
  // Any other failure stays inside its own card; the profile and sign-out keep working.
  data.devices = devices.status === "fulfilled" ? devices.value.body ?? {} : null;
  data.billing = billing.status === "fulfilled" ? billing.value.body ?? {} : null;
  data.failed = { devices: devices.reason ?? null, billing: billing.reason ?? null };
  renderDashboard();
  loadGoogleConfig();
}

/** Google is shown only after the server itself says it is configured: no guess, no fallback. */
async function loadGoogleConfig() {
  try { googleEnabled = (await client.get("/auth/google/config")).body?.enabled === true; }
  catch { googleEnabled = null; }
  byId("google-signin").hidden = googleEnabled !== true;
  if (data) renderGoogle(currentPlan());
}

function dropDashboard() {
  data = null;
  checkoutOpened = false;
  for (const id of ["modules-list", "packs-list", "devices-list"]) byId(id).replaceChildren();
  byId("profile-email").textContent = "";
  clearPasswords(byId("view-dashboard"));
}

const currentPlan = () => dashboardPlan(data?.account, googleEnabled);

/**
 * Runs one user action. Errors are explained and never retried automatically:
 * 401 drops the dashboard, a rejected CSRF token is replaced for the next press.
 */
async function act(target, action) {
  const restore = busy(target);
  try { await action(); }
  catch (error) {
    if (error.code === "session_expired") { await refresh(t("err.session_expired"), "error"); return; }
    // Another account is already signed in here: show it, with the explanation.
    if (error.code === "logout_required") { await refresh(errorText(error), "error"); return; }
    // Not a lost session: the account stays signed in and shows what it may do before confirming.
    if (error.code === "email_unconfirmed") { await refresh(errorText(error), "error"); return; }
    if (error.code === "csrf_invalid") {
      let session = null;
      try { session = await client.bootstrap(); } catch { /* the next press reports it */ }
      // The token was refused because the session itself is gone: go to sign-in.
      if (session && !session.authenticated && data) { await refresh(t("err.session_expired"), "error"); return; }
    }
    if (error.code === "device_not_found" && data) await reloadDevices().catch(() => {});
    notice(errorText(error), "error");
  } finally {
    restore();
  }
}

/* ---------- Sign-in, registration, password reminder ---------- */

function wireTabs() {
  const tabs = ["login", "register", "forgot"];
  for (const name of tabs) {
    byId("tab-" + name).addEventListener("click", () => selectTab(name));
  }
  byId("view-auth").querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const current = tabs.findIndex((name) => byId("tab-" + name).getAttribute("aria-selected") === "true");
    const next = tabs[(current + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    byId("tab-" + next).focus();
  });
}

function selectTab(name) {
  for (const other of ["login", "register", "forgot"]) {
    const on = other === name;
    byId("tab-" + other).setAttribute("aria-selected", String(on));
    byId("tab-" + other).tabIndex = on ? 0 : -1;
    byId("form-" + other).hidden = !on;
  }
  notice("");
}

function wireForms() {
  byId("retry").addEventListener("click", () => { showOnly(VIEWS, "view-loading"); refresh(); });

  byId("form-login").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = byId("login-email").value.trim();
    const password = byId("login-password").value;
    if (!isEmail(email)) return notice(t("check.email"), "error");
    if (!password) return notice(t("check.password"), "error");
    act(form, async () => {
      try { await client.post("/auth/login", { email, password }); }
      finally { clearPasswords(form); }
      // The old token belonged to the anonymous visitor: get a new one first.
      await refresh(t("login.done"));
    });
  });

  byId("form-register").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = byId("register-email").value.trim();
    const password = byId("register-password").value;
    if (!isEmail(email)) return notice(t("check.email"), "error");
    if (!isPasswordLength(password)) return notice(t("check.length"), "error");
    if (password !== byId("register-repeat").value) return notice(t("check.repeat"), "error");
    act(form, async () => {
      try { await client.post("/auth/register", { email, password }); }
      finally { clearPasswords(form); }
      // Same answer for new and existing addresses; no automatic sign-in.
      notice(t("register.done"));
    });
  });

  byId("form-forgot").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = byId("forgot-email").value.trim();
    if (!isEmail(email)) return notice(t("check.email"), "error");
    act(form, async () => {
      await client.post("/auth/forgot-password", { email });
      notice(t("forgot.done"));
    });
  });

  byId("google-login").addEventListener("click", (event) => act(event.currentTarget, () => openGoogle({})));

  byId("logout").addEventListener("click", (event) => act(event.currentTarget, async () => {
    await client.post("/auth/logout", {});
    await refresh(t("logout.done"));
  }));

  byId("resend-email").addEventListener("click", (event) => act(event.currentTarget, async () => {
    await client.post("/account/email/request", {});
    notice(t("email.sent"));
  }));

  // Confirmed in another tab or on the phone: read the profile again.
  byId("profile-recheck").addEventListener("click", (event) => act(event.currentTarget, () => refresh(t("status.updated"))));

  for (const id of ["profile-recovery", "set-password"])
    byId(id).addEventListener("click", (event) => act(event.currentTarget, sendPasswordLink));

  byId("form-google-link").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = byId("google-link-password").value;
    if (!currentPassword) return notice(t("check.current"), "error");
    act(form, async () => {
      try { await openGoogle({ currentPassword }); }
      catch (error) {
        // The start route answers a wrong password with invalid_credentials; here only the current one was asked.
        if (error.code === "invalid_credentials") throw new ApiError(error.status, "current_password_invalid", error.retryAfter);
        throw error;
      }
      finally { clearPasswords(form); }
    });
  });

  byId("form-password").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = byId("password-current").value;
    const newPassword = byId("password-new").value;
    if (!currentPassword) return notice(t("check.current"), "error");
    if (!isPasswordLength(newPassword)) return notice(t("check.length"), "error");
    if (newPassword !== byId("password-repeat").value) return notice(t("check.repeat"), "error");
    if (newPassword === currentPassword) return notice(t("check.same"), "error");
    if (!confirm(t("password.confirm"))) return;
    act(form, async () => {
      try { await client.post("/account/password", { currentPassword, newPassword }); }
      finally { clearPasswords(form); }
      await refresh(t("password.done"));
    });
  });

  byId("form-logout-all").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = byId("logout-all-password").value;
    if (!currentPassword) return notice(t("check.current"), "error");
    if (!confirm(t("logoutAll.confirm"))) return;
    act(form, async () => {
      try { await client.post("/auth/logout-all", { currentPassword }); }
      finally { clearPasswords(form); }
      await refresh(t("logoutAll.done"));
    });
  });

  byId("billing-checkout").addEventListener("click", (event) => act(event.currentTarget, openCheckout));
  byId("billing-portal").addEventListener("click", (event) => act(event.currentTarget, openPortal));
  byId("billing-check").addEventListener("click", (event) => act(event.currentTarget, async () => {
    const billing = await client.post("/billing/check", {});
    data.billing = billing.body ?? {};
    data.failed.billing = null;
    // Rights come from the server's own reconciliation, so the account is read again.
    data.account = (await client.get("/account")).body ?? {};
    checkoutOpened = false;
    renderDashboard();
    notice(t("billing.checked"));
  }));
}

/* ---------- Google and recovery ---------- */

/**
 * POST /auth/google/start, then the API's own bridge page in this tab — never a frame or popup.
 * Nothing about the flow is kept: the one-time ticket travels only in the URL fragment that the
 * bridge removes, and Google sends the browser back to this language's /account/, where the
 * page asks again. The language is this page's own (<html lang>), never the browser's.
 * @param {{currentPassword?: string}} body {} to sign in, {currentPassword} to link this account
 */
async function openGoogle(body) {
  const locale = pageLang();
  const answer = (await client.post("/auth/google/start", { ...body, locale })).body ?? {};
  const url = googleStartUrl(answer.url, API_ORIGIN, locale);
  // A website start never carries a poll token: that capability belongs to the app alone.
  if (!url || (answer.pollToken !== undefined && answer.pollToken !== null)) { notice(t("google.badLink"), "error"); return; }
  if (MODE === "mock") { notice(t("google.mockStart", { host: url.host })); return; }
  location.assign(url.href);
}

/** The same one-time email link as “Forgot password”, for the signed-in address. */
async function sendPasswordLink() {
  const email = typeof data?.account?.email === "string" ? data.account.email : "";
  if (!isEmail(email)) { notice(t("err.unexpected"), "error"); return; }
  await client.post("/auth/forgot-password", { email });
  notice(t("recovery.sent", { email }));
}

/* ---------- Billing ---------- */

async function openCheckout() {
  let response;
  try { response = await client.post("/billing/checkout", { moduleId: "avatar-overlay" }); }
  catch (error) {
    // The request may have reached the server: show the state instead of buying twice.
    if (error.code === "network") {
      checkoutOpened = true;
      renderBilling();
      notice(t("billing.unknownOutcome"), "error");
      return;
    }
    throw error;
  }
  const url = checkoutUrl(response.body?.url, CHECKOUT_ORIGIN);
  if (!url) { notice(t("billing.badLink"), "error"); return; }
  checkoutOpened = true;
  renderBilling();
  if (MODE === "mock") { notice(t("billing.mockCheckout", { host: url.host })); return; }
  // One-time link, valid for minutes: used right away, never stored.
  location.assign(url.href);
}

async function openPortal() {
  const response = await client.post("/billing/portal", {});
  const url = portalUrl(response.body?.url);
  if (!url) { notice(t("billing.badLink"), "error"); return; }
  if (MODE === "mock") { notice(t("billing.mockPortal")); return; }
  location.assign(url.href);
}

/* ---------- Rendering ---------- */

function renderDashboard() {
  const plan = currentPlan();
  renderProfile(plan);
  for (const [key, id] of Object.entries(CARDS)) byId(id).hidden = !plan.cards[key];
  if (plan.confirmed) {
    renderModules();
    renderDevices(plan);
    renderBilling();
    renderSecurity(plan);
  } else {
    // Nothing from the paid or free features stays on the page before confirmation.
    for (const id of ["modules-list", "packs-list", "devices-list"]) byId(id).replaceChildren();
    clearPasswords(byId("view-dashboard"));
  }
  renderGoogle(plan);
  showOnly(VIEWS, "view-dashboard");
}

function renderProfile(plan) {
  const account = data.account;
  byId("profile-email").textContent = typeof account.email === "string" ? account.email : "";
  const badge = byId("profile-confirmed");
  badge.textContent = t(plan.confirmed ? "email.confirmed" : "email.unconfirmed");
  badge.className = "state " + (plan.confirmed ? "state--on" : "state--warn");
  byId("profile-unconfirmed").hidden = plan.confirmed;
  byId("resend-email").hidden = !plan.resendConfirmation;
  byId("profile-recheck").hidden = plan.confirmed;
  const recovery = byId("profile-recovery");
  recovery.hidden = !plan.recovery;
  recovery.textContent = t(plan.hasPassword ? "recovery.newPassword" : "recovery.firstPassword");
  // Before confirmation the profile is the whole dashboard.
  byId("card-profile").classList.toggle("card--wide", !plan.confirmed);
}

function renderSecurity(plan) {
  byId("security-forms").hidden = !plan.passwordForms;
  byId("security-no-password").hidden = !plan.setPassword;
  if (!plan.passwordForms) clearPasswords(byId("security-forms"));
}

function renderGoogle(plan) {
  byId("card-google").hidden = !plan.cards.google;
  byId("google-only").hidden = !plan.googleOnly;
  byId("form-google-link").hidden = !plan.googleLink;
  if (!plan.googleLink) clearPasswords(byId("form-google-link"));
}

function renderModules() {
  const modules = Array.isArray(data.account.modules) ? data.account.modules : [];
  byId("modules-list").replaceChildren(...modules.map((module) => {
    const row = el("li");
    const head = el("div", "", "row__head");
    head.append(el("span", moduleName(module), "row__title"));
    const active = module.active === true;
    const until = formatDate(module.paidUntil);
    head.append(el("span", active ? (until ? t("module.activeUntil", { date: until }) : t("module.active")) : t("module.inactive"),
      "state " + (active ? "state--on" : "")));
    row.append(head);
    return row;
  }));
  const packs = Array.isArray(data.account.packs) ? data.account.packs : [];
  const rows = packs.map((pack) => {
    const row = el("li");
    const head = el("div", "", "row__head");
    head.append(el("span", packName(pack), "row__title"));
    // Owning a pack and being allowed to play it are different things; the standard pack
    // is never bought, it comes with the Avatar Overlay subscription.
    const text = pack.owned === true
      ? (pack.canPlay === true ? t("pack.ownedPlaying") : t("pack.ownedNeedsSub"))
      : pack.canPlay === true ? t("pack.included")
      : pack.id === "standard" ? t("pack.includedNoSub") : t("pack.none");
    head.append(el("span", text, "state " + (pack.canPlay === true ? "state--on" : pack.owned === true ? "state--warn" : "")));
    row.append(head);
    return row;
  });
  byId("packs-list").replaceChildren(...(rows.length ? rows : [el("li", t("pack.empty"), "row__meta")]));
}

function renderBilling() {
  const badge = byId("billing-state");
  const billing = data.billing;
  if (!billing) {
    badge.textContent = t("load.failed");
    badge.className = "state state--warn";
    byId("billing-dates").textContent = errorText(data.failed.billing);
    for (const id of ["billing-checkout", "billing-portal", "billing-check", "billing-pending"]) byId(id).hidden = true;
    return;
  }
  const state = billingState(billing.state);
  badge.textContent = state.text;
  badge.className = "state" + (state.tone ? " state--" + state.tone : "");
  const dates = [];
  if (formatDate(billing.paidUntil)) dates.push(t("billing.until", { date: formatDate(billing.paidUntil) }));
  if (formatDate(billing.stopAt)) dates.push(t("billing.stops", { date: formatDate(billing.stopAt) }));
  byId("billing-dates").textContent = dates.join(" ");
  // Buttons follow the server's flags; the server still checks every request.
  byId("billing-checkout").hidden = !(billing.enabled === true && billing.canCheckout === true);
  byId("billing-portal").hidden = !(billing.enabled === true && billing.canManage === true);
  byId("billing-check").hidden = billing.enabled !== true;
  byId("billing-pending").hidden = !checkoutOpened;
}

function renderDevices(plan) {
  const list = byId("devices-list");
  // Removing a computer needs the current password; a Google-only account sets one first.
  byId("devices-need-password").hidden = plan.removeDevices;
  if (!data.devices) {
    byId("devices-limit").textContent = "";
    list.replaceChildren(el("li", t("load.failed") + " " + errorText(data.failed.devices), "row__meta"));
    return;
  }
  const devices = Array.isArray(data.devices.devices) ? data.devices.devices : [];
  const limit = Number.isInteger(data.devices.limit) ? data.devices.limit : 2;
  byId("devices-limit").textContent = t("devices.limit", { count: devices.length, limit });
  if (!devices.length) { list.replaceChildren(el("li", t("devices.empty"), "row__meta")); return; }
  list.replaceChildren(...devices.map((device) => deviceRow(device, plan.removeDevices)));
}

function deviceRow(device, canRemove) {
  const row = el("li");
  const head = el("div", "", "row__head");
  const name = el("div");
  name.append(el("div", typeof device.name === "string" && device.name ? device.name : "—", "row__title"));
  const meta = [];
  if (formatDate(device.addedAt)) meta.push(t("devices.added", { date: formatDate(device.addedAt) }));
  // The website never counts as a computer, so web answers carry no "this computer" flag.
  meta.push(t(device.hasActiveSession === true ? "devices.online" : "devices.offline"));
  name.append(el("div", meta.join(" · "), "row__meta"));
  head.append(name);
  row.append(head);
  if (!canRemove) return row;
  const remove = el("button", t("devices.remove"), "btn btn--small btn--danger");
  remove.type = "button";
  head.append(remove);

  remove.addEventListener("click", () => {
    if (row.querySelector("form")) return;
    const form = el("form", "", "row__form");
    form.noValidate = true;
    const fieldId = "device-password-" + String(device.id).replace(/[^A-Za-z0-9_-]/g, "");
    const label = el("label", t("devices.password"));
    label.htmlFor = fieldId;
    const input = el("input", "", "input");
    Object.assign(input, { id: fieldId, type: "password", autocomplete: "current-password", maxLength: 128, required: true });
    const confirmButton = el("button", t("devices.confirm"), "btn btn--small btn--danger");
    confirmButton.type = "submit";
    const cancel = el("button", t("devices.cancel"), "btn btn--small btn--ghost");
    cancel.type = "button";
    const buttons = el("div", "", "actions");
    buttons.append(confirmButton, cancel);
    form.append(el("p", t("devices.warning"), "warn"), label, input, buttons);
    row.append(form);
    input.focus();
    cancel.addEventListener("click", () => { input.value = ""; form.remove(); remove.focus(); });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const currentPassword = input.value;
      if (!currentPassword) return notice(t("check.current"), "error");
      act(form, async () => {
        try { await client.post("/account/devices/" + encodeURIComponent(String(device.id)) + "/remove", { currentPassword }); }
        finally { input.value = ""; }
        await reloadDevices();
        notice(t("devices.done"));
      });
    });
  });
  return row;
}

async function reloadDevices() {
  data.devices = (await client.get("/account/devices")).body ?? {};
  data.failed.devices = null;
  renderDevices(currentPlan());
}
