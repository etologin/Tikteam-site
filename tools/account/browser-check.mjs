#!/usr/bin/env node
// Optional end-to-end check of the account page's own code in a real browser engine.
// Builds the mock site into .preview/browser-check, serves it on 127.0.0.1 and drives headless
// Edge or Chrome through the DevTools protocol. The page code runs unchanged; only the demo
// server stands in for the API. Nothing leaves 127.0.0.1.
//
//   node tools/account/browser-check.mjs
//   TIKTEAM_BROWSER="C:/path/to/chrome.exe" node tools/account/browser-check.mjs
//
// Exit code: 0 all checks passed, 1 a check failed, 2 no Chromium-based browser was found.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";
import { GOOGLE_DEMO_EMAIL } from "./mock/mock-server.js";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(SITE, ".preview", "browser-check");
const BROWSERS = [
  process.env.TIKTEAM_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge",
].filter(Boolean);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = BROWSERS.find((path) => existsSync(path));
if (!browser) { console.log("browser-check skipped: no Edge or Chrome found (set TIKTEAM_BROWSER)"); process.exit(2); }

build({ mode: "mock", out: OUT });
const server = createServer((req, res) => {
  let file = join(OUT, decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  if (!file.startsWith(OUT)) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "tikteam-browser-check-"));
const child = spawn(browser, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--disable-sync", "about:blank"], { stdio: "ignore" });
let port = null;
for (let i = 0; i < 100 && !port; i++) {
  try { port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]) || null; } catch { /* starting */ }
  if (!port) await sleep(100);
}
let failures = 0;
const check = (ok, message) => { console.log((ok ? "PASS " : "FAIL ") + message); if (!ok) failures++; };

try {
  if (!port) throw new Error("the browser did not open its DevTools port");
  let page = null;
  for (let i = 0; i < 50 && !page; i++) {
    page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
    if (!page) await sleep(100);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r, { once: true }); ws.addEventListener("error", j, { once: true }); });
  let id = 0, navigations = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
    if (msg.method === "Page.frameNavigated" && !msg.params.frame.parentId) navigations++;
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  // Helpers evaluated inside the page; `mock` is the very demo server instance the page uses.
  const HELPERS = `
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const $ = (id) => document.getElementById(id);
    const visible = (id) => !$(id).hidden;
    const mock = (await import('/assets/js/account/mock-server.js')).mockServer.controls;
    const submit = (formId) => $(formId).querySelector('button[type=submit]').click();
    const signIn = async () => { $('login-email').value = mock.demo.email; $('login-password').value = mock.demo.password; submit('form-login'); await wait(600); };
    const returned = async () => { dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); await wait(600); };
    const cards = () => ['card-billing','card-modules','card-devices','card-google','card-security'].filter(visible);
  `;
  const run = async (body) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { ${HELPERS} ${body} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const open = async (path) => { await send("Page.navigate", { url: base + path }); await sleep(900); };
  await send("Page.enable");

  // Visitor: Google appears because the server's config says enabled; starting never navigates in mock.
  // Each page starts the bridge in its own language, for sign-in and for linking alike.
  for (const [path, label, locale] of [["/account/", "Войти через Google", "ru"], ["/en/account/", "Sign in with Google", "en"]]) {
    await open(path);
    const r = await run(`return { signin: visible('google-signin'), label: $('google-login').querySelector('.gsi-material-button-contents').textContent, auth: visible('view-auth') };`);
    check(r.auth && r.signin && r.label === label, `${path}: Google sign-in shown from the server's config`);
    const start = await run(`$('google-login').click(); await wait(500); return { sent: mock.lastGoogleStart, notice: $('notice').textContent };`);
    check(start.sent?.locale === locale && start.sent?.link === false && start.notice.includes("api.mock.invalid"),
      `${path}: sign-in starts the bridge with locale ${locale} and the link passes the ${locale} check`);
    await open(path); // a fresh demo server: nobody signed in yet
    const link = await run(`await signIn(); $('google-link-password').value = mock.demo.password; submit('form-google-link'); await wait(500);
      return { sent: mock.lastGoogleStart, notice: $('notice').textContent, cleared: $('google-link-password').value === '' };`);
    check(link.sent?.locale === locale && link.sent?.link === true && link.notice.includes("api.mock.invalid") && link.cleared,
      `${path}: linking sends the password with locale ${locale}`);
  }
  await open("/account/");
  const before = navigations;
  let r = await run(`$('google-login').click(); await wait(500); return { notice: $('notice').textContent, signedIn: mock.currentEmail() };`);
  check(r.notice.includes("api.mock.invalid") && !/[0-9A-Fa-f]{64}/.test(r.notice), "Google start: only the host is shown, never the ticket");
  check(r.signedIn === null, "Google start alone signs nobody in");
  r = await run(`const result = mock.completeGoogle(); await returned();
    return { result, email: $('profile-email').textContent, cards: cards(), googleOnly: visible('google-only'), link: visible('form-google-link'),
      forms: visible('security-forms'), noPassword: visible('security-no-password'), needPassword: visible('devices-need-password'),
      remove: document.querySelectorAll('#devices-list .btn--danger').length };`);
  check(r.result === "created" && r.email === GOOGLE_DEMO_EMAIL, "back from Google: the page read the new session from the server");
  check(r.cards.length === 5 && r.googleOnly && !r.link, "Google-only account: Google card without a link form");
  check(!r.forms && r.noPassword && r.needPassword && r.remove === 0, "hasPassword=false: no current-password forms, recovery offered instead");
  r = await run(`mock.outbox.length = 0; $('set-password').click(); await wait(500); return mock.outbox.map((m) => m.to + ':' + m.purpose);`);
  check(r.length === 1 && r[0] === GOOGLE_DEMO_EMAIL + ":reset", "the first password comes from the one-use recovery link");
  check(navigations === before, "mock mode never navigates away");

  // Linking: current password required, a wrong one reads as such and keeps the session.
  await open("/account/");
  r = await run(`await signIn(); $('google-link-password').value = 'wrong-pass-1'; submit('form-google-link'); await wait(500);
    return { notice: $('notice').textContent, cleared: $('google-link-password').value === '', signedIn: mock.currentEmail() };`);
  check(r.notice === "Текущий пароль неверен." && r.cleared && r.signedIn === "demo@tikteam.test", "link: wrong password explained, field cleared, session kept");
  r = await run(`$('google-link-password').value = mock.demo.password; submit('form-google-link'); await wait(500);
    const result = mock.completeGoogle(); await returned();
    return { result, linked: mock.users.get(mock.demo.email).google, email: $('profile-email').textContent };`);
  check(r.result === "linked" && r.linked === "demo@tikteam.test" && r.email === "demo@tikteam.test", "link: right password, same address, dashboard read again");

  // Confirmation withdrawn while the dashboard is open: an action answers 403 email_unconfirmed.
  r = await run(`mock.setConfirmed(false, mock.demo.email); $('billing-check').click(); await wait(700);
    return { notice: $('notice').textContent, cards: cards(), unavailable: visible('view-unavailable'), resend: visible('resend-email'),
      recovery: visible('profile-recovery'), logout: visible('logout'), signedIn: mock.currentEmail(),
      rows: $('modules-list').children.length + $('devices-list').children.length };`);
  check(!r.unavailable && r.notice.startsWith("Подтвердите почту"), "email_unconfirmed is explained, not shown as an unavailable server");
  check(r.cards.length === 0 && r.rows === 0 && r.resend && r.recovery && r.logout, "unconfirmed: only confirmation, recovery and sign-out remain");
  check(r.signedIn === "demo@tikteam.test", "unconfirmed: no automatic sign-out");
  r = await run(`mock.log.length = 0; $('profile-recheck').click(); await wait(600); return [...mock.log];`);
  check(!r.some((l) => /devices|billing/.test(l)), "unconfirmed: only the profile is requested (" + r.join(", ") + ")");
  r = await run(`mock.setConfirmed(true, mock.demo.email); mock.log.length = 0; $('profile-recheck').click(); await wait(700); return { log: [...mock.log], cards: cards() };`);
  const firstFeature = r.log.findIndex((l) => /devices|billing/.test(l));
  check(r.log.indexOf("GET /account") >= 0 && r.log.indexOf("GET /account") < firstFeature && r.cards.length === 5, "confirmed: profile first, then computers and billing");

  // Google switched off on the server: no button, no card, the rest unchanged.
  await open("/account/");
  r = await run(`mock.setGoogleEnabled(false); await returned(); const visitor = visible('google-signin'); await signIn();
    return { visitor, card: visible('card-google'), cards: cards().length };`);
  check(!r.visitor && !r.card && r.cards === 4, "enabled=false: Google hidden for visitors and accounts");
  ws.close();
} catch (error) {
  failures++;
  console.log("FAIL " + error.message);
} finally {
  child.kill();
  server.close();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold files */ }
  rmSync(OUT, { recursive: true, force: true });
}
console.log(failures ? `browser-check: ${failures} failed` : "browser-check: all passed");
process.exit(failures ? 1 : 0);

