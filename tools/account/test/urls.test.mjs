import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutUrl, portalUrl, recoveryLink } from "../../../assets/js/account/urls.js";

const API = "https://api.tikteam.live";
const PORTAL = "https://sandbox-customer-portal.paddle.com/cpl_abcdefghijklmnopqrstuvwxyz?action=overview&token=pga_0123456789abcdefghijKLMN";

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
