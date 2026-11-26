import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("changing language updates the iPhone status and preserves the active pairing", async () => {
  const elements = new Map(), handlers = new Map(), requests = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      addEventListener: (event, callback) => handlers.set(id + ":" + event, callback),
      removeAttribute(name) { delete this[name]; }
    });
    return elements.get(id);
  };
  const context = {};
  runInNewContext(read("../../../assets/i18n/de.js"), context);
  const dictionary = context.TikTeamSiteDictionaries.de;
  let language = "en";
  const key = "ttsc1." + "a".repeat(64) + "." + "b".repeat(64);
  Object.assign(context, {
    MODE: "real", API_BASE: "", localizationReady: Promise.resolve(),
    pageLanguage: () => language, translateCopy: source => dictionary[source],
    document: { getElementById: element, addEventListener: (name, fn) => handlers.set(name, fn) },
    addEventListener() {}, setTimeout() {}, clearTimeout() {}, createTransport() {},
    createClient: () => ({
      bootstrap: async () => ({ authenticated: true }),
      get: async route => { requests.push(route); return { body: { emailConfirmed: true, canConfigure: true } }; },
      post: async route => {
        requests.push(route);
        return { body: { key, qrPng: "iVBORw0KGgo" + "A".repeat(20), expiresAt: new Date(Date.now()+60000).toISOString() } };
      }
    })
  });
  runInNewContext(read("../../../assets/js/account/tikdonate-iphone.js").replace(/^import .*;$/gm, ""), context);
  await new Promise(resolve => setImmediate(resolve));
  await handlers.get("make-qr:click")();
  assert.equal(element("state").textContent, "Your account key is ready.");
  const qr = element("qr-image").src, before = [...requests];
  language = "de";
  handlers.get("tikteam-language-changed")();
  const translated = dictionary["Ключ создан для вашего аккаунта."];
  assert.ok(translated?.length);
  assert.equal(element("state").textContent, translated);
  assert.deepEqual(requests, before);
  assert.equal(element("key").value, "Bearer " + key);
  assert.equal(element("qr-image").src, qr);
});
