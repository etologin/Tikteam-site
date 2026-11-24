// Checks of the static site: the account area is only linked (account.tikteam.live), never
// embedded or rebuilt here; every page offers it in the header, the mobile menu and the footer;
// every internal link and anchor resolves. Run: node --test tools/site/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

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

test("module previews retain their artwork, proportions and on-demand descriptions", () => {
  for (const page of ["index.html", "en/index.html"]) {
    const previews = [
      ["avatar-overlay", "avatar-description", "v33", 800, 420], ["battle-overlay", "battle-description", "v32", 800, 420],
      ["tikdonate", "donate-description", "v32", 800, 420], ["dead-as-disco", "disco-description", "v6", 1920, 1080],
    ];
    for (const [id, description, version, width, height] of previews) {
      const card = read(page).split('<article id="module-' + id + '"')[1].split("</article>")[0];
      assert.ok(card.includes(`width="${width}" height="${height}" muted playsinline loop preload="none"`));
      assert.doesNotMatch(card, /<video\b[^>]*\bcontrols\b/);
      assert.ok(card.includes('aria-describedby="' + description + '"'));
      assert.ok(card.includes('<p class="sr-only" id="' + description + '">'));
      const cover = card.match(/poster="([^"]+)"/)[1];
      assert.equal(resolve(SITE, dirname(page), cover), join(SITE, "assets/promo", id + "-" + version + (id === "dead-as-disco" && page.startsWith("en/") ? "-en" : "") + ".webp"));
      const sources = [...card.matchAll(/<source [^>]*src="([^"]+)"/g)].map(m => resolve(SITE, dirname(page), m[1]));
      assert.deepEqual(sources, ["mobile", "web"].map(variant => join(SITE, "assets/promo", id + "-" + version + "-" + variant + ".mp4")));
      assert.match(card, /<source media="\(max-width: 640px\)"/);
      assert.ok(sources.every(path => existsSync(path)));
    }
  }
});

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
    for (const href of accountLinks)
      assert.ok([ACCOUNT[lang], ACCOUNT[lang] + "#referrals", billing].includes(href), `${page}: ${href}`);
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
  const version = installer(ru)[0].match(/\/client-v(\d+\.\d+\.\d+)\/TikTeam\.Setup\.exe$/)?.[1];
  assert.ok(version, 'the installer URL is pinned to a release version');
  for (const html of [ru, en]) {
    assert.ok(html.includes('class="hero__note">TikTeam ' + version + ' '), 'the download and displayed version agree');
    assert.ok(hrefs(html).includes('https://updates.tikteam.live/TikTeam.Setup.exe'), 'the update server remains a second download source');
  }
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

test("the free trial can be found from either home page and read in every site language", () => {
  const russian = read("index.html");
  const english = read("en/index.html");
  const aliases = JSON.parse(read("assets/js/language-aliases.js").split(" = ")[1].trim().replace(/;$/, ""));
  function copy(html) {
    const section = html.match(/<section id="trial"[\s\S]*?<\/section>/)[0];
    assert.equal(hrefs(html).filter(href => href === "#trial").length, 2);
    assert.equal((section.match(/<dt>/g) ?? []).length, 4);
    assert.ok(section.includes("Corgi · Whale Diving · Leon the Kitten"));
    return [...section.matchAll(/<(h2|p|dd)\b[^>]*>([^<]+)<\/\1>/g)].map(m => m[2]);
  }
  const ru = copy(russian), en = copy(english);
  assert.ok(ru.some(text => text.includes("Попробовать бесплатно на 7 дней")));
  assert.equal(ru.length, en.length);
  for (const { code } of JSON.parse(read("assets/i18n/languages.json"))) {
    if (code === "ru") continue;
    const ctx = {};
    runInNewContext(read("assets/i18n/" + code + ".js"), ctx);
    const dictionary = ctx.TikTeamSiteDictionaries[code];
    ru.forEach((source, i) => {
      if (source === en[i]) return;
      assert.equal(aliases[en[i]], source);
      assert.ok(dictionary[source]?.trim(), code + ": " + source);
      if (code === "en") assert.equal(dictionary[source], en[i]);
    });
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
      const file = target(page, path.split("?")[0]);
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

test("the smartphone link offers the Android installer and the iPhone setup guide", () => {
  for (const prefix of ["", "en/"]) {
    const home = read(prefix + "index.html");
    const mobile = read(prefix + "mobile/index.html");
    assert.match(home, /class="hero__cta">\s*<a class="btn trial-cta" href="#trial">/);
    assert.deepEqual(hrefs(home).filter(href => href === "mobile/"), Array(4).fill("mobile/"));
    assert.ok(!hrefs(home).some(href => href.endsWith(".apk") || href === "iphone/"));
    assert.match(mobile, /https:\/\/updates\.tikteam\.live\/android\/TikTeam-Android-[\d.]+\.apk/);
    assert.ok(hrefs(mobile).includes("/" + prefix + "iphone/"));
    assert.equal((mobile.match(/<h2>Android<\/h2>|<h2>iPhone<\/h2>/g) ?? []).length, 2);
    assert.ok(mobile.includes("/assets/js/language.js"));
  }
});

test("the iPhone guide uses the public iCloud template and hands off only setup links", () => {
  const template = "https://www.icloud.com/shortcuts/089a4fbe013540ba83929644e2ab9e03";
  for (const page of ["iphone/index.html", "en/iphone/index.html"]) {
    const html = read(page);
    assert.ok(hrefs(html).includes(template), page);
    assert.ok(hrefs(html).includes("/assets/js/iphone-setup.js"), page);
    assert.match(html, /<meta name="referrer" content="no-referrer">/);
  }
  const script = read("assets/js/iphone-setup.js");
  const go = (hash) => {
    const calls = [];
    runInNewContext(script, { window: { location: { hash, replace: url => calls.push(url) } } });
    return calls;
  };
  const code = "ttsp1." + "a".repeat(64) + "." + "b".repeat(64);
  assert.deepEqual(go("#" + code), ["https://api.tikteam.live/api/tikdonate/shortcuts/v1/setup#" + code]);
  assert.deepEqual(go(""), []);
  assert.deepEqual(go("#https://example.com/"), []);
  assert.deepEqual(go("#" + code.replace("ttsp1.", "ttsc1.")), []);
});
