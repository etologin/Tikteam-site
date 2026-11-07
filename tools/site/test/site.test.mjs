// Checks of the static site: the account area is only linked (account.tikteam.live), never
// embedded or rebuilt here; every page offers it in the header, the mobile menu and the footer;
// every internal link and anchor resolves. Run: node --test tools/site/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ACCOUNT = { ru: "https://account.tikteam.live/account/", en: "https://account.tikteam.live/en/account/" };
const LABEL = { ru: "Личный кабинет", en: "My account" };
const PAGES = [
  ["index.html", "ru"], ["en/index.html", "en"],
  ["terms/index.html", "ru"], ["refunds/index.html", "ru"], ["privacy/index.html", "ru"],
  ["en/terms/index.html", "en"], ["en/refunds/index.html", "en"], ["en/privacy/index.html", "en"],
];
const read = (page) => readFileSync(join(SITE, page), "utf8").replace(/\r\n/g, "\n");
const hrefs = (html) => [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

test("every page links the account area in the header, the mobile menu and the footer", () => {
  for (const [page, lang] of PAGES) {
    const html = read(page);
    const url = ACCOUNT[lang], label = LABEL[lang];
    assert.ok(html.includes(`<a class="btn btn--small top__account" href="${url}">${label}</a>`), `${page}: header button`);
    const menu = /<details class="menu">[\s\S]*?<\/details>/.exec(html)?.[0];
    assert.ok(menu, page + ": mobile menu");
    assert.ok(menu.includes(`<a class="btn btn--small menu__account" href="${url}">${label}</a>`), `${page}: menu entry`);
    const foot = /<p class="foot__links">[\s\S]*?<\/p>/.exec(html)?.[0];
    assert.ok(foot?.includes(`<a href="${url}">${label}</a>`), `${page}: footer link`);
    // The menu repeats exactly the section links of the desktop header.
    const nav = /<nav class="nav" aria-label="[^"]+">([\s\S]*?)<\/nav>/.exec(html)[1];
    const sections = (block) => [...block.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => m[1] + " " + m[2]);
    assert.deepEqual(sections(menu), sections(nav), page + ": menu has the header's sections");
    assert.match(menu, /<summary class="menu__toggle">[\s\S]*<span class="sr-only">(Меню|Menu)<\/span><\/summary>/, page + ": named toggle");
  }
});

test("account links go only to the hosted account area, in the page's language", () => {
  for (const [page, lang] of PAGES) {
    const html = read(page);
    const accountLinks = hrefs(html).filter((h) => /account/i.test(h) && /^https?:/.test(h));
    assert.ok(accountLinks.length >= 3, page);
    const billing='https://account.tikteam.live/billing/';
    for (const href of accountLinks) assert.ok([ACCOUNT[lang],billing].includes(href), `${page}: ${href}`);
    // No embedding and no sign-in forms on the main site; no test or local hosts.
    assert.doesNotMatch(html, /<iframe|<form|<input/i, page + ": no embedded account or forms");
    assert.doesNotMatch(html, /localhost|127\.0\.0\.1|web-test|api-test|api\.tikteam\.live|(?<!account\.)tikteam\.live\/(en\/)?account/i, page + ": no old or test hosts");
    // Public downloads already exist; localization must keep their trusted destinations.
    for(const href of hrefs(html).filter(h=>/\/download|\.exe$|\.zip$|\.msi$/i.test(h))){
      const url=new URL(href);
      assert.equal(url.protocol,'https:',page+': HTTPS download');
      assert.ok((url.hostname==='github.com' && url.pathname.startsWith('/etologin/Tikteam-site/releases/download/')) ||
        (url.hostname==='updates.tikteam.live' && url.pathname==='/TikTeam.Setup.exe'),page+': known download destination');
    }
  }
});

test("home pages preserve the published installer and hosted subscription links", () => {
  const ru = read("index.html"), en = read("en/index.html");
  assert.ok(ru.includes(`<a class="btn" href="${ACCOUNT.ru}">Создать аккаунт</a>`));
  assert.ok(en.includes(`<a class="btn" href="${ACCOUNT.en}">Create an account</a>`));
  const installer=html=>hrefs(html).filter(h=>h.startsWith('https://github.com/etologin/Tikteam-site/releases/download/') && h.endsWith('/TikTeam.Setup.exe'));
  assert.equal(installer(ru).length,1);
  assert.deepEqual(installer(en),installer(ru),'both languages download the same installer');
  assert.ok(ru.includes('https://account.tikteam.live/billing/'));
  assert.ok(en.includes('https://account.tikteam.live/billing/'));
});

test("home pages and the 32 language dictionaries consistently use Battle Overlay", () => {
  for (const page of ["index.html", "en/index.html"]) {
    const html = read(page);
    assert.equal([...html.matchAll(/<h3>Battle Overlay<\/h3>/g)].length, 2, page);
    assert.doesNotMatch(html, /TikTok Overlay/i, page);
  }
  const languages = JSON.parse(read("assets/i18n/languages.json"));
  assert.equal(languages.length, 32);
  for (const { code } of languages) {
    const dictionary = read(`assets/i18n/${code}.js`);
    assert.doesNotMatch(dictionary, /TikTok Overlay/i, code);
    if (code !== "ru") assert.match(dictionary, /Battle Overlay/, code);
  }
});

/** File a relative link of a page points to; directory links mean their index.html. */
function target(page, path) {
  if (!path) return join(SITE, page);
  const file = join(dirname(join(SITE, page)), path);
  return path.endsWith("/") ? join(file, "index.html") : file;
}

test("every internal link and anchor resolves", () => {
  for (const [page] of PAGES) {
    for (const href of hrefs(read(page))) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [path, fragment] = href.split("#");
      const file = target(page, path);
      assert.ok(existsSync(file), `${page}: ${href} → ${file}`);
      if (fragment) assert.ok(readFileSync(file, "utf8").includes(`id="${fragment}"`), `${page}: #${fragment} in ${file}`);
    }
  }
});

test("the menu script stays tiny and local: no storage, cookies or network", () => {
  const script = readFileSync(join(SITE, "assets", "js", "menu.js"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon|innerHTML|eval\(/);
  for (const [page] of PAGES) assert.match(read(page), /<script src="(\.\.\/)*assets\/js\/menu\.js" defer><\/script>/, page);
});
