# tikteam.live

Static site for TikTeam: Russian at `/`, English at `/en/`. Plain HTML and CSS, no build step.

## Local preview

Any static file server pointed at this folder works. Paths are relative, so the site also
works under `https://etologin.github.io/Tikteam-site/` before the custom domain is attached.

## Layout

- `index.html` — Russian page
- `en/index.html` — English page; keep it in sync with the Russian one
- `terms/`, `refunds/`, `privacy/` and their `en/` copies — legal pages
- `assets/css/site.css` — shared styles
- `assets/js/menu.js` — closes the mobile menu after a choice; the menu works without it
- `assets/img/` — logo crops made from the original TikTeam logo

## Account area

The account area is hosted separately at `https://account.tikteam.live/account/`
(English: `/en/account/`). This site only links to it — from the header, the mobile menu,
the footer and the home page — and never embeds it or carries sign-in forms: the account
API accepts requests only from `account.tikteam.live`. For now accounts are open, while
purchases and stream connections are not.

## Checks

```bash
node --test tools/site/test/
node tools/site/browser-check.mjs .preview/site-check
```

The tests check the account links on every page and in both languages, the absence of
local, test or old account addresses, embedded pages, forms and purchase or download links,
and that every internal link and anchor resolves. `browser-check.mjs` drives headless Edge
or Chrome (`TIKTEAM_BROWSER=<path>`) at 1280, 1024, 800, 700 and 375 px: no horizontal
overflow, the right header items per width, and a mobile menu that opens with the account
link and closes after a choice, on Escape and on a tap outside. Exit code 2 means no browser.
