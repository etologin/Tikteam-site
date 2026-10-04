// Checks on the files that ship: no Web Storage, no HTML injection, no third-party scripts,
// strict CSP on every account page, and no demo code in the committed state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const JS_DIR = join(SITE, "assets", "js", "account");
const PAGES = ["account/index.html", "account/recovery/index.html", "en/account/index.html", "en/account/recovery/index.html"];
const shipped = readdirSync(JS_DIR).filter((f) => f.endsWith(".js"));

test("committed account scripts are the production set only", () => {
  assert.deepEqual(shipped.sort(), ["account-app.js", "api.js", "config.js", "dom.js", "guard.js", "i18n.js", "recovery-app.js", "urls.js"]);
  const config = readFileSync(join(JS_DIR, "config.js"), "utf8");
  assert.match(config, /export const MODE = "disabled";/, "the committed site is in disabled mode");
  assert.doesNotMatch(config, /mock/i);
});

test("no Web Storage, IndexedDB, cookies from script, HTML injection or eval in shipped scripts", () => {
  const banned = /\b(localStorage|sessionStorage|indexedDB|document\.cookie|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\s*\(|new Function|serviceWorker|console\.(log|info|debug))\b/;
  for (const file of shipped) {
    const source = readFileSync(join(JS_DIR, file), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(source, banned, file);
    // Pages may behave differently in demo mode, but never load demo files themselves.
    assert.doesNotMatch(source, /mock-(server|panel)|tools\/account/i, file + " must not load demo code");
  }
});

test("account pages: strict CSP, no referrer, no indexing, framing guard, only own scripts", () => {
  for (const page of PAGES) {
    const html = readFileSync(join(SITE, page), "utf8");
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1];
    assert.ok(csp, page + " has a CSP");
    for (const part of ["default-src 'none'", "script-src 'self'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "object-src 'none'"])
      assert.ok(csp.includes(part), `${page}: ${part}`);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/, page);
    assert.match(html, /<meta name="referrer" content="no-referrer">/, page);
    assert.match(html, /<meta name="robots" content="noindex">/, page);
    assert.match(html, /<html lang="(ru|en)" class="account-guard"/, page);
    assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i, page + ": no inline styles or handlers");
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
    assert.ok(scripts.length >= 2, page);
    for (const attrs of scripts) assert.match(attrs, /src="(\.\.\/)+assets\/js\/account\/(guard|account-app|recovery-app)\.js"/, page + ": " + attrs);
    // The guard runs before anything else that could load or read the address.
    assert.ok(html.indexOf("guard.js") < html.indexOf("<link"), page + ": guard first");
  }
});

test("recovery pages clear the fragment through the guard before other scripts", () => {
  for (const page of PAGES.filter((p) => p.includes("recovery"))) {
    const html = readFileSync(join(SITE, page), "utf8");
    assert.match(html, /data-recovery="1"/, page);
  }
  const guard = readFileSync(join(JS_DIR, "guard.js"), "utf8");
  assert.match(guard, /history\.replaceState\(null, "", location\.pathname \+ location\.search\)/);
});

test("checkout and portal links are only followed after validation", () => {
  const app = readFileSync(join(JS_DIR, "account-app.js"), "utf8");
  const assigns = [...app.matchAll(/location\.assign\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(assigns, ["url.href", "url.href"]);
  assert.match(app, /const url = checkoutUrl\(/);
  assert.match(app, /const url = portalUrl\(/);
  assert.doesNotMatch(app, /window\.open|\/api\/auth\/login|DPoP/i, "no native sign-in, no popups");
});

test("demo files live outside the published asset folder", () => {
  for (const file of ["mock-server.js", "mock-panel.js", "mock-panel.css"]) {
    assert.ok(existsSync(join(SITE, "tools", "account", "mock", file)), file);
    assert.ok(!existsSync(join(JS_DIR, file)), file + " is not in assets");
  }
});
