import { MODE, API_BASE, createTransport } from "./config.js";
import { createClient } from "./api.js";

const route = "/tikdonate/iphone";
const byId = id => document.getElementById(id);
const en = document.documentElement.lang === "en";
const say = (ru, english) => { byId("state").textContent = en ? english : ru; };
const ids = ["make-qr", "make-key", "unlink"];
let client;
let generation = 0;
let expiryTimer;
let pending = false;

function clearQr() {
  clearTimeout(expiryTimer);
  byId("qr-result").hidden = true;
  byId("qr-image").removeAttribute("src");
  byId("open-link").removeAttribute("href");
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
    say("Подтвердите почту и проверьте доступ к TikDonate и выбранному компьютеру.", "Confirm your email and check access to TikDonate and the selected computer.");
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
    const devices = Array.isArray(body?.devices) ? body.devices.filter(d => /^[0-9a-f]{32}$/.test(d?.id)) : [];
    byId("devices").replaceChildren(...devices.map(device => {
      const option = document.createElement("option");
      option.value = device.id;
      option.textContent = device.name || (en ? "TikTeam computer" : "Компьютер TikTeam");
      return option;
    }));
    if (body?.phoneLinked) {
      byId("unlink").hidden = false;
      say("iPhone привязан. Ключ бессрочный.", "An iPhone is linked. Its key does not expire.");
    } else if (!body?.canConfigure) {
      say("Для подключения нужен доступ к TikDonate.", "TikDonate access is required.");
    } else if (devices.length === 0) {
      say("Сначала войдите в этот аккаунт в TikTeam на компьютере.", "First sign in to this account in TikTeam on your computer.");
    } else {
      byId("setup").hidden = false;
      say("Выберите компьютер, на котором работает TikDonate.", "Choose the computer running TikDonate.");
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
    const { body } = await client.post(route, { mode, deviceId: byId("devices").value });
    if (current !== generation) return;
    clearSecrets();
    if (mode === "setup") {
      const expiry = Date.parse(body?.expiresAt);
      if (!/^ttsp1\.[0-9a-f]{64}\.[0-9a-f]{64}$/.test(body?.code) ||
          !/^iVBORw0KGgo[A-Za-z0-9+/=]{16,88000}$/.test(body?.qrPng) ||
          !Number.isFinite(expiry) || expiry <= Date.now()) throw new Error();
      byId("qr-image").src = "data:image/png;base64," + body.qrPng;
      byId("open-link").href = "https://tikteam.live/iphone/#" + body.code;
      byId("qr-result").hidden = false;
      expiryTimer = setTimeout(() => {
        clearQr();
        say("Срок ссылки истёк. Создайте новый QR-код.", "The link expired. Create a new QR code.");
      }, Math.min(expiry - Date.now(), 300000));
      say("Ссылка готова.", "Your link is ready.");
    } else {
      if (!/^ttsc1\.[0-9a-f]{64}\.[0-9a-f]{64}$/.test(body?.key)) throw new Error();
      byId("key").value = "Bearer " + body.key;
      byId("key-result").hidden = false;
      byId("setup").hidden = true;
      byId("unlink").hidden = false;
      say("Ключ создан.", "Your key is ready.");
    }
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
byId("make-qr").addEventListener("click", () => change("setup"));
byId("make-key").addEventListener("click", () => change("key"));
byId("unlink").addEventListener("click", () => change("unlink"));
byId("copy-key").addEventListener("click", () => copy(byId("key").value, byId("key")));
byId("copy-link").addEventListener("click", () => copy(byId("open-link").getAttribute("href")));
addEventListener("pagehide", () => { generation++; clearSecrets(); client?.forget(); });
addEventListener("pageshow", event => { if (event.persisted) load(); });
load();
