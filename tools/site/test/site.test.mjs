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
    for (const href of accountLinks) assert.equal(href, ACCOUNT[lang], `${page}: ${href}`);
    // No embedding and no sign-in forms on the main site; no test or local hosts.
    assert.doesNotMatch(html, /<iframe|<form|<input/i, page + ": no embedded account or forms");
    assert.doesNotMatch(html, /localhost|127\.0\.0\.1|web-test|api-test|api\.tikteam\.live|(?<!account\.)tikteam\.live\/(en\/)?account/i, page + ": no old or test hosts");
    // Nothing to buy or download yet (links to Paddle's legal pages are fine).
    assert.deepEqual(hrefs(html).filter((h) => /checkout|\/download|\.exe$|\.zip$|\.msi$/i.test(h)), [], page + ": no purchase or download links");
  }
});

test("home pages say that accounts are open and purchases and streams are not", () => {
  const ru = read("index.html"), en = read("en/index.html");
  assert.ok(ru.includes(`<a class="btn" href="${ACCOUNT.ru}">Создать аккаунт</a>`));
  assert.ok(en.includes(`<a class="btn" href="${ACCOUNT.en}">Create an account</a>`));
  assert.match(ru, /<p class="hero__note">Аккаунты уже открыты[^<]*Покупки и подключение эфиров пока недоступны\.<\/p>/);
  assert.match(en, /<p class="hero__note">Accounts are open[^<]*Purchases and stream connections are not available yet\.<\/p>/);
  assert.match(ru, /<p class="pricing__note">Покупки пока не открыты\./);
  assert.match(en, /<p class="pricing__note">Purchases are not open yet\./);
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
