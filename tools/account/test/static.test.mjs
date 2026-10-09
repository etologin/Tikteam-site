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
  assert.deepEqual(shipped.sort(), ["account-app.js", "api.js", "config.js", "dashboard.js", "dom.js", "guard.js", "i18n.js", "recovery-app.js", "urls.js"]);
  const config = readFileSync(join(JS_DIR, "config.js"), "utf8");
  assert.match(config, /export const MODE = "disabled";/, "the committed site is in disabled mode");
  assert.match(config, /export const API_ORIGIN = "";/, "no API origin in the committed site");
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

test("Google, checkout and portal links are only followed after validation", () => {
  const app = readFileSync(join(JS_DIR, "account-app.js"), "utf8");
  const assigns = [...app.matchAll(/location\.assign\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(assigns, ["url.href", "url.href", "url.href"]);
  assert.match(app, /const url = googleStartUrl\(answer\.url, API_ORIGIN, locale\);/);
  // The bridge language is the page's own, sent with every start (sign-in and linking).
  assert.match(app, /const locale = pageLang\(\);\s+const answer = \(await client\.post\("\/auth\/google\/start", \{ \.\.\.body, locale \}\)\)/);
  assert.doesNotMatch(app, /navigator\.(language|languages)/, "never the browser's language");
  assert.match(app, /const url = checkoutUrl\(/);
  assert.match(app, /const url = portalUrl\(/);
  assert.doesNotMatch(app, /window\.open|\/api\/auth\/|DPoP/i, "no native sign-in, no popups");
});

test("Google: the website start only, no poll loop, no Google SDK, hidden until the server enables it", () => {
  const app = readFileSync(join(JS_DIR, "account-app.js"), "utf8");
  assert.doesNotMatch(app, /google\/poll|setInterval|deviceName/, "polling and devices belong to the app, not the website");
  assert.match(app, /answer\.pollToken !== undefined && answer\.pollToken !== null/, "a poll token in a website answer is refused");
  assert.match(app, /\(await client\.get\("\/auth\/google\/config"\)\)\.body\?\.enabled === true/);
  for (const file of shipped) {
    const source = readFileSync(join(JS_DIR, file), "utf8");
    assert.doesNotMatch(source, /accounts\.google\.com|apis\.google\.com|\/gsi\/|google\.accounts|client_?secret/i, file);
  }
  for (const page of PAGES.filter((p) => !p.includes("recovery"))) {
    const html = readFileSync(join(SITE, page), "utf8");
    assert.match(html, /<div id="google-signin" hidden>/, page + ": sign-in button hidden until config says enabled");
    assert.match(html, /<article class="card card--wide" id="card-google" hidden>/, page + ": link card hidden by default");
    assert.match(html, /id="google-link-password" type="password" autocomplete="current-password"/, page);
    assert.doesNotMatch(html, /accounts\.google\.com|apis\.google\.com|\/gsi\//, page + ": no Google script");
  }
});

test("Google buttons follow Google's branding: official G, light pill, Google Sans, allowed texts", () => {
  // The "G" exactly as Google's Sign in with Google configurator renders it; never recoloured or redrawn.
  const G = [
    ["#EA4335", "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"],
    ["#4285F4", "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"],
    ["#FBBC05", "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"],
    ["#34A853", "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"],
  ];
  for (const [page, texts] of [["account/index.html", ["Войти через Google", "Продолжить с Google"]], ["en/account/index.html", ["Sign in with Google", "Continue with Google"]]]) {
    const html = readFileSync(join(SITE, page), "utf8");
    const buttons = [...html.matchAll(/<button class="gsi-material-button light-mode pill"[\s\S]*?<\/button>/g)].map((m) => m[0]);
    assert.equal(buttons.length, 2, page + ": sign-in and link buttons");
    assert.match(buttons[0], /id="google-login"/, page);
    assert.match(buttons[1], /type="submit"/, page + ": the link form submits through the Google button");
    buttons.forEach((button, i) => {
      for (const [fill, d] of G) assert.ok(button.includes(`<path fill="${fill}" d="${d}"></path>`), `${page}: ${fill} path of the G`);
      assert.match(button, /<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">/, page);
      assert.ok(button.includes(`<span class="gsi-material-button-contents">${texts[i]}</span>`), `${page}: ${texts[i]}`);
    });
    assert.match(html, /fonts\.googleapis\.com\/css2\?family=Google\+Sans:wght@500&/, page + ": Google Sans Medium for the button text");
  }
  const css = readFileSync(join(SITE, "assets", "css", "account.css"), "utf8");
  for (const rule of ["border: 1px solid #747775", "color: #1f1f1f", "height: 40px", ".gsi-material-button.pill { border-radius: 20px; }",
    "margin-right: 12px; min-width: 20px; width: 20px", "font-family: \"Google Sans\""])
    assert.ok(css.includes(rule), "official button CSS: " + rule);
});

test("confirmation first: the profile is read alone, a refusal keeps the session", () => {
  const app = readFileSync(join(JS_DIR, "account-app.js"), "utf8");
  const load = app.slice(app.indexOf("async function loadDashboard"), app.indexOf("async function loadGoogleConfig"));
  assert.ok(load.indexOf('client.get("/account")') >= 0 && load.indexOf('client.get("/account")') < load.indexOf('client.get("/account/devices")'));
  assert.match(load, /if \(!dashboardPlan\(account, googleEnabled\)\.loadFeatures\) \{ renderDashboard\(\); return; \}/);
  assert.match(load, /e\?\.code === "email_unconfirmed"/, "a feature refusal shows the confirmation screen, not an outage");
  assert.match(app, /if \(error\.code === "email_unconfirmed"\) \{ await refresh\(errorText\(error\), "error"\); return; \}/);
  assert.equal([...app.matchAll(/"\/auth\/logout"/g)].length, 1, "only the sign-out button signs out");
});

test("demo files live outside the published asset folder", () => {
  for (const file of ["mock-server.js", "mock-panel.js", "mock-panel.css"]) {
    assert.ok(existsSync(join(SITE, "tools", "account", "mock", file)), file);
    assert.ok(!existsSync(join(JS_DIR, file)), file + " is not in assets");
  }
});
