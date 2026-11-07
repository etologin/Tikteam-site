#!/usr/bin/env node
// Optional check of the header, the mobile menu and the account links in a real browser engine.
// Serves the site folder on 127.0.0.1 and drives headless Edge or Chrome through the DevTools
// protocol at desktop, tablet and phone widths. Nothing leaves 127.0.0.1; the account area
// itself is not opened.
//
//   node tools/site/browser-check.mjs [screenshot-folder]
//   TIKTEAM_BROWSER="C:/path/to/chrome.exe" node tools/site/browser-check.mjs
//
// Exit code: 0 all checks passed, 1 a check failed, 2 no Chromium-based browser was found.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOTS = process.argv[2] ? resolve(process.argv[2]) : null;
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
const ACCOUNT = { ru: "https://account.tikteam.live/account/", en: "https://account.tikteam.live/en/account/" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = BROWSERS.find((path) => existsSync(path));
if (!browser) { console.log("browser-check skipped: no Edge or Chrome found (set TIKTEAM_BROWSER)"); process.exit(2); }
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = createServer((req, res) => {
  let file = join(SITE, decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  if (!file.startsWith(SITE) || file.includes(".git")) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "tikteam-site-check-"));
const child = spawn(browser, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--disable-sync", "about:blank"], { stdio: "ignore" });
let failures = 0;
const check = (ok, message) => { console.log((ok ? "PASS " : "FAIL ") + message); if (!ok) failures++; };

try {
  let port = null;
  for (let i = 0; i < 100 && !port; i++) {
    try { port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]) || null; } catch { /* starting */ }
    if (!port) await sleep(100);
  }
  if (!port) throw new Error("the browser did not open its DevTools port");
  let page = null;
  for (let i = 0; i < 50 && !page; i++) {
    page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
    if (!page) await sleep(100);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r, { once: true }); ws.addEventListener("error", j, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const run = async (body) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const shown = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0; ${body} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const open = async (path, width) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
    const address=new URL(base+path);
    if(!address.searchParams.has('lang'))address.searchParams.set('lang',address.pathname.startsWith('/en/')?'en':'ru');
    await send("Page.navigate", { url: address.href });
    await sleep(700);
    await run(`await document.fonts.ready; return true;`);
  };
  const shot = async (name) => {
    if (!SHOTS) return;
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(SHOTS, name + ".png"), Buffer.from(data, "base64"));
  };
  await send("Page.enable");

  for (const [path, lang] of [["/", "ru"], ["/en/", "en"], ["/terms/", "ru"], ["/en/privacy/", "en"]]) {
    const url = ACCOUNT[lang];
    for (const width of [1280, 1024, 800, 700, 375]) {
      await open(path, width);
      const r = await run(`return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        row: (() => { const row = document.querySelector('.top__row'); return row.scrollWidth > row.clientWidth + 1; })(),
        nav: shown(document.querySelector('.nav')), menu: shown(document.querySelector('.menu__toggle')),
        account: shown(document.querySelector('.top__account')), discord: shown(document.querySelector('.top__discord')),
        accountHref: document.querySelector('.top__account').href, footHref: [...document.querySelectorAll('.foot__links a')].find((a) => a.href.includes('account.'))?.href };`);
      const tag = `${path} @${width}`;
      check(!r.overflow && !r.row, `${tag}: no horizontal overflow, header row fits`);
      check(r.accountHref === url && r.footHref === url, `${tag}: header and footer link ${url}`);
      const desktop = width > 1024, phone = width <= 640, discord = width > 760;
      check(r.nav === desktop && r.menu === !desktop, `${tag}: ${desktop ? "section links in the header" : "menu button instead of section links"}`);
      check(r.account === !phone && r.discord === discord, `${tag}: account button ${phone ? "in the menu" : "in the header"}, Discord ${discord ? "in the header" : "in the menu"}`);
      if (width === 1280 || width === 375) await shot(`${lang}${path.replace(/\//g, "_")}${width}`);
    }

    // Phone: the menu opens, offers the account and closes after a choice, Escape or a tap outside.
    await open(path, 375);
    let r = await run(`document.querySelector('.menu__toggle').click(); await wait(250);
      const panel = document.querySelector('.menu__panel'), account = panel.querySelector('.menu__account');
      const box = account.getBoundingClientRect();
      return { open: document.querySelector('details.menu').open, panel: shown(panel), href: account.href,
        inView: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth,
        links: [...panel.querySelectorAll('a')].map((a) => a.textContent.trim()) };`);
    check(r.open && r.panel && r.href === url && r.inView, `${path} @375: menu opens with the account link in view (${r.links.join(", ")})`);
    await shot(`${lang}${path.replace(/\//g, "_")}375-menu`);
    // On the legal pages the section links lead to the home page, so the click may leave this page.
    const choice = await run(`const link = document.querySelector('.menu__nav > a:not(.btn)');
      const expected = new URL(link.getAttribute('href'), location.href).href;
      setTimeout(() => link.click(), 0); return { href: link.getAttribute('href'), expected };`);
    await sleep(900);
    r = await run(`return { open: document.querySelector('details.menu').open, at: location.href };`);
    check(!r.open && r.at === choice.expected, `${path} @375: choosing ${choice.href} closes the menu and goes there`);
    await open(path, 375);
    r = await run(`const menu = document.querySelector('details.menu'); menu.querySelector('summary').click(); await wait(150);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(100);
      const afterEscape = menu.open, focus = document.activeElement === menu.querySelector('summary');
      menu.querySelector('summary').click(); await wait(150);
      document.querySelector('main').dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(100);
      return { afterEscape, focus, afterOutside: menu.open };`);
    check(!r.afterEscape && r.focus, `${path} @375: Escape closes the menu and returns focus to its button`);
    check(!r.afterOutside, `${path} @375: a tap outside closes the menu`);
  }
  // Longer translations and RTL must fit the same header and preserve the portal language.
  for(const language of ['de','fr','kk','ar']){
    for(const width of [1280,700,375]){
      await open('/?lang='+language,width);
      const r=await run(`return {code:document.documentElement.lang,dir:document.documentElement.dir,
        overflow:document.documentElement.scrollWidth>innerWidth,
        row:(()=>{const e=document.querySelector('.top__row');return e.scrollWidth>e.clientWidth+1;})(),
        choices:document.querySelector('.language-picker select').options.length,
        heading:document.querySelector('.hero h1').textContent,
        expectedHeading:globalThis.TikTeamSiteDictionaries[${JSON.stringify(language)}]['TikTeam — зрители играют в ваш эфир'].replace(/^TikTeam\\s*[—–-]\\s*/u,''),
        account:new URL(document.querySelector('.top__account').href).searchParams.get('lang')};`);
      check(r.code===language && r.choices===32 && r.account===language,language+' @'+width+': selected language and portal link agree');
      check(!r.overflow && !r.row,language+' @'+width+': localized header fits');
      check(r.dir===(language==='ar'?'rtl':'ltr'),language+' @'+width+': correct reading direction');
      check(r.heading===r.expectedHeading,language+' @'+width+': heading is translated as a complete sentence');
      if(width===375 || width===1280)await shot('localized-'+language+'-'+width);
    }
  }
  ws.close();
} catch (error) {
  failures++;
  console.log("FAIL " + error.message);
} finally {
  child.kill();
  server.close();
  await sleep(300);
  const resolvedProfile=resolve(profile),tempRoot=resolve(tmpdir());
  if(dirname(resolvedProfile)!==tempRoot || !resolvedProfile.startsWith(join(tempRoot,'tikteam-site-check-')))throw Error('Unexpected browser profile path');
  try { rmSync(resolvedProfile, { recursive: true, force: true }); } catch { /* the browser may still hold files */ }
}
console.log(failures ? `browser-check: ${failures} failed` : "browser-check: all passed");
process.exit(failures ? 1 : 0);
