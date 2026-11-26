import { MODE, API_BASE, createTransport } from "./config.js";
import { createClient } from "./api.js";
import { localizationReady, pageLanguage, translateCopy } from "../language.js";

const route = "/tikdonate/iphone";
const byId = id => document.getElementById(id);
let message;
function renderStatus() {
  if (!message) return;
  byId("state").textContent = pageLanguage() === "en" ? message.english : translateCopy(message.ru);
}
function say(ru, english) {
  message = { ru, english };
  renderStatus();
}
document.addEventListener("tikteam-language-changed", renderStatus);
localizationReady.then(renderStatus);
const ids = ["make-qr", "unlink"];
let client;
let generation = 0;
let expiryTimer;
let pending = false;

function clearQr() {
  clearTimeout(expiryTimer);
  byId("qr-result").hidden = true;
  byId("qr-image").removeAttribute("src");
}
function clearSecrets() {
  clearQr();
  byId("key-result").hidden = true;
  byId("key").value = "";
}
function showSignIn() {
  clearSecrets();
  byId("sign-in").hidden = false;
  byId("setup").hidden = byId("unlink").hidden = true;
  say("Войдите в TikTeam и подтвердите почту.", "Sign in to TikTeam and confirm your email.");
}
function showError(error) {
  if (error.status === 401 || error.code === "email_unconfirmed") {
    showSignIn();
  } else if (error.status === 409) {
    byId("setup").hidden = true;
    byId("unlink").hidden = false;
    say("Сначала отвяжите текущий iPhone.", "Unlink your current iPhone first.");
  } else if (error.status === 403) {
    say("Подтвердите почту и проверьте доступ к TikDonate.", "Confirm your email and check access to TikDonate.");
  } else {
    say("Не удалось связаться с TikTeam. Попробуйте ещё раз.", "Could not reach TikTeam. Try again.");
  }
}

async function load() {
  const current = ++generation;
  clearSecrets();
  byId("setup").hidden = byId("unlink").hidden = byId("sign-in").hidden = true;
  if (!client) {
    say("Откройте страницу в личном кабинете TikTeam.", "Open this page in your TikTeam account.");
    byId("sign-in").hidden = false;
    return;
  }
  try {
    if (!(await client.bootstrap()).authenticated) return showSignIn();
    if ((await client.get("/account")).body?.emailConfirmed !== true) return showSignIn();
    const { body } = await client.get(route);
    if (current !== generation) return;
    if (body?.phoneLinked) {
      byId("unlink").hidden = false;
      say("Чтобы подключить другой iPhone, сперва отвяжите старый iPhone.", "To connect another iPhone, unlink your current iPhone first.");
    } else if (!body?.canConfigure) {
      say("Для подключения нужен доступ к TikDonate.", "TikDonate access is required.");
    } else {
      byId("setup").hidden = false;
      say("Подключите iPhone к своему аккаунту TikTeam.", "Connect your iPhone to your TikTeam account.");
    }
  } catch (error) {
    if (current === generation) showError(error);
  }
}

async function change(mode) {
  if (!client || pending) return;
  const current = generation;
  pending = true;
  for (const id of ids) byId(id).disabled = true;
  try {
    if (mode === "unlink") {
      await client.post(route, { mode });
      if (current === generation) await load();
      return;
    }
    const { body } = await client.post(route, { mode: "connect" });
    if (current !== generation) return;
    clearSecrets();
    const expiry = Date.parse(body?.expiresAt);
    if (!/^ttsc1\.[0-9a-f]{64}\.[0-9a-f]{64}$/.test(body?.key) ||
        !/^iVBORw0KGgo[A-Za-z0-9+/=]{16,88000}$/.test(body?.qrPng) ||
        !Number.isFinite(expiry)) throw new Error();
    byId("setup").hidden = true;
    byId("qr-image").src = "data:image/png;base64," + body.qrPng;
    byId("key").value = "Bearer " + body.key;
    byId("qr-result").hidden = byId("key-result").hidden = byId("unlink").hidden = false;
    expiryTimer = setTimeout(clearQr, Math.max(0, Math.min(expiry - Date.now(), 300000)));
    say("Ключ создан для вашего аккаунта.", "Your account key is ready.");
  } catch (error) {
    if (current === generation) showError(error);
  } finally {
    pending = false;
    for (const id of ids) byId(id).disabled = false;
  }
}

async function copy(value, field) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    say("Скопировано.", "Copied.");
  } catch {
    field?.select();
    say("Скопируйте значение вручную или откройте ссылку.", "Copy it manually or open the link.");
  }
}

if (MODE === "real") client = createClient({ transport: createTransport(), base: API_BASE });
byId("make-qr").addEventListener("click", () => change("connect"));
byId("unlink").addEventListener("click", () => change("unlink"));
byId("copy-key").addEventListener("click", () => copy(byId("key").value, byId("key")));
addEventListener("pagehide", () => { generation++; clearSecrets(); client?.forget(); });
addEventListener("pageshow", event => { if (event.persisted) load(); });
load();
