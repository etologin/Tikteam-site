import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutUrl, portalUrl, recoveryLink, googleStartUrl } from "../../../assets/js/account/urls.js";

const API = "https://api.tikteam.live";
const PORTAL = "https://sandbox-customer-portal.paddle.com/cpl_abcdefghijklmnopqrstuvwxyz?action=overview&token=pga_0123456789abcdefghijKLMN";
// The server writes the ticket with Convert.ToHexString (upper case); either case is hex.
const TICKET = "0123456789ABCDEF".repeat(4);
const GOOGLE = `${API}/auth/google/#${TICKET}`;

test("Google start link: only the API's bridge page with a 64-hex ticket in the fragment", () => {
  assert.equal(googleStartUrl(GOOGLE, API)?.href, GOOGLE);
  assert.ok(googleStartUrl(GOOGLE.toLowerCase(), API), "lower-case hex is hex too");
  for (const bad of [
    GOOGLE.replace("https:", "http:"),                                  // not https
    GOOGLE.replace("api.tikteam.live", "evil.example"),                 // other host
    GOOGLE.replace("api.tikteam.live", "api.tikteam.live.evil.example"),
    GOOGLE.replace("api.tikteam.live", "tikteam.live"),                 // the website is not the API
    GOOGLE.replace("https://", "https://user:pass@"),                   // user info
    GOOGLE.replace("api.tikteam.live", "api.tikteam.live:443"),         // explicit port
    GOOGLE.replace("api.tikteam.live", "api.tikteam.live:8443"),
    GOOGLE.replace("/#", "/?next=https://evil.example#"),               // query
    GOOGLE.replace("/#", "/?#"),                                        // empty query
    GOOGLE.replace("/auth/google/", "/auth/google"),                    // other paths
    GOOGLE.replace("/auth/google/", "/auth/google/begin"),
    GOOGLE.replace("/auth/google/", "/api/web/v1/auth/google/"),
    GOOGLE.replace("/auth/google/", "/auth/Google/"),
    GOOGLE.replace("/auth/google/", "/auth/google/../google/"),
    GOOGLE.replace("/auth/google/", "/auth/%67oogle/"),
    GOOGLE.slice(0, -1),                                                // 63 hex
    GOOGLE + "0",                                                       // 65 hex
    GOOGLE.slice(0, -1) + "g",                                          // not hex
    GOOGLE + "&next=x",
    `${API}/auth/google/`,                                              // no ticket
    `${API}/auth/google/#`,
    " " + GOOGLE, GOOGLE + " ", GOOGLE.replace("#", "#\n"),
    `javascript:alert(1)//${API}/auth/google/#${TICKET}`,
    "", null, undefined, 42, { href: GOOGLE },
  ]) assert.equal(googleStartUrl(bad, API), null, String(bad));
  for (const origin of ["http://api.tikteam.live", "https://api.tikteam.live/", "", null, "https://API.tikteam.live"])
    assert.equal(googleStartUrl(GOOGLE, origin), null, "expected origin " + origin);
});

test("Google start link per language: Russian has no query, English exactly ?lang=en", () => {
  const EN = `${API}/auth/google/?lang=en#${TICKET}`;
  assert.equal(googleStartUrl(GOOGLE, API, "ru")?.href, GOOGLE, "ru is the default and explicit value");
  assert.equal(googleStartUrl(EN, API, "en")?.href, EN);
  assert.ok(googleStartUrl(EN.toLowerCase().replace("https://api.tikteam.live", API), API, "en"), "lower-case ticket");
  assert.equal(googleStartUrl(EN, API, "ru"), null, "a Russian start never accepts ?lang=en");
  assert.equal(googleStartUrl(EN, API), null, "nor does the default");
  assert.equal(googleStartUrl(GOOGLE, API, "en"), null, "an English start must come back with ?lang=en");
  for (const bad of [
    `${API}/auth/google/?lang=ru#${TICKET}`,
    `${API}/auth/google/?lang=EN#${TICKET}`,
    `${API}/auth/google/?LANG=en#${TICKET}`,
    `${API}/auth/google/?lang=en&next=https://evil.example#${TICKET}`,
    `${API}/auth/google/?next=x&lang=en#${TICKET}`,
    `${API}/auth/google/?lang=en&#${TICKET}`,
    `${API}/auth/google/?lang=en=#${TICKET}`,
    `${API}/auth/google/?lang=%65n#${TICKET}`,
    `${API}/auth/google/?lang=en`,
    `${API}/auth/google/?lang=en#`,
    `${API}/auth/google/?lang=en#${TICKET}0`,
    `${API}/auth/google/?lang=en&ticket=${TICKET}`,
    `${API}/auth/google?lang=en#${TICKET}`,
    `https://evil.example/auth/google/?lang=en#${TICKET}`,
    `${API}:443/auth/google/?lang=en#${TICKET}`,
  ]) assert.equal(googleStartUrl(bad, API, "en"), null, bad);
  for (const locale of ["de", "EN", "", null, "constructor", "__proto__", "toString"])
    assert.equal(googleStartUrl(GOOGLE, API, locale), null, "unknown locale " + String(locale));
});

test("checkout link: only the API's own hosted page with a fragment capability", () => {
  assert.ok(checkoutUrl(API + "/billing/checkout#cap_ABCdef-123", API));
  for (const bad of [
    "http://api.tikteam.live/billing/checkout#x1",            // not https
    "https://evil.example/billing/checkout#x1",                // other host
    "https://api.tikteam.live.evil.example/billing/checkout#x1",
    "https://user:pass@api.tikteam.live/billing/checkout#x1",  // user info
    "https://api.tikteam.live:8443/billing/checkout#x1",       // explicit port
    "https://api.tikteam.live/billing/checkout?next=evil#x1",  // query
    "https://api.tikteam.live/billing/checkout",               // no capability
    "https://api.tikteam.live/billing/checkout#",
    "https://api.tikteam.live/billing/checkout/#x1",           // other path
    "https://api.tikteam.live/api/web/v1/billing/checkout#x1",
    " https://api.tikteam.live/billing/checkout#x1",           // whitespace
    "javascript:alert(1)//https://api.tikteam.live/billing/checkout#x",
    "", null, 42,
  ]) assert.equal(checkoutUrl(bad, API), null, String(bad));
  assert.equal(checkoutUrl(API + "/billing/checkout#x1", "http://api.tikteam.live"), null, "a non-https expected origin is refused");
});

test("portal link: exact Paddle Sandbox overview, nothing similar", () => {
  assert.ok(portalUrl(PORTAL));
  for (const bad of [
    PORTAL.replace("https:", "http:"),
    PORTAL.replace("sandbox-customer-portal.paddle.com", "customer-portal.paddle.com"),       // live host is not allowed yet
    PORTAL.replace("sandbox-customer-portal.paddle.com", "sandbox-customer-portal.paddle.com.evil.example"),
    PORTAL.replace("sandbox-customer-portal.paddle.com", "evil.example/sandbox-customer-portal.paddle.com"),
    PORTAL.replace("sandbox-customer-portal.paddle.com", "sandbox-customer-portal.paddle.com:444"),
    PORTAL.replace("https://", "https://a:b@"),
    PORTAL + "#frag",
    PORTAL + "&redirect=https://evil.example",
    PORTAL.replace("action=overview", "action=cancel"),
    PORTAL.replace("cpl_abcdefghijklmnopqrstuvwxyz", "cpl_ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
    PORTAL.replace("cpl_abcdefghijklmnopqrstuvwxyz", "cpl_short"),
    PORTAL.replace("token=pga_0123456789abcdefghijKLMN", "token=pga_short"),
    PORTAL.replace("token=pga_", "token=xyz_"),
    "", undefined,
  ]) assert.equal(portalUrl(bad), null, String(bad));
});

test("recovery fragment: purpose and code only, in a strict shape", () => {
  assert.deepEqual(recoveryLink("purpose=reset&code=abcdefghijklmnop_-123"), { purpose: "reset", code: "abcdefghijklmnop_-123" });
  assert.deepEqual(recoveryLink("code=abcdefghijklmnop&purpose=confirm"), { purpose: "confirm", code: "abcdefghijklmnop" });
  for (const bad of [
    "", "purpose=reset", "purpose=reset&token=abcdefghijklmnop",          // the field is code, not token
    "purpose=login&code=abcdefghijklmnop", "purpose=reset&code=short",
    "purpose=reset&code=abcdefghijklmnop&next=https://evil.example",
    "purpose=reset&code=<script>alert(1)</script>xxxx",
    "purpose=reset&purpose=confirm", "purpose=reset&code=abc%ZZdefghijklmnop",
  ]) assert.equal(recoveryLink(bad), null, bad);
});
