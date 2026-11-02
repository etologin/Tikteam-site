import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, ApiError, parseRetryAfter } from "../../../assets/js/account/api.js";
import { errorText, billingState, moduleName, packName, formatDate } from "../../../assets/js/account/i18n.js";

const BASE = "https://api.example.test/api/web/v1";
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function recording(responses) {
  const calls = [];
  const queue = [...responses];
  return { calls, transport: async (url, init) => { calls.push({ url, init }); const next = queue.shift(); if (next instanceof Error) throw next; return next; } };
}

test("bootstrap keeps the CSRF token in memory and every POST sends it with JSON and credentials", async () => {
  const fake = recording([json(200, { version: 1, authenticated: false, expiresAt: null, csrfToken: "tok-1" }), new Response(null, { status: 202 })]);
  const client = createClient({ transport: fake.transport, base: BASE });
  await client.bootstrap();
  await client.post("/auth/forgot-password", { email: "a@b.c" });
  const [get, post] = fake.calls;
  assert.equal(get.url, BASE + "/session");
  for (const call of fake.calls) {
    assert.equal(call.init.credentials, "include");
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.redirect, "error");
  }
  assert.equal(post.init.method, "POST");
  assert.equal(post.init.headers["X-TikTeam-CSRF"], "tok-1");
  assert.equal(post.init.headers["Content-Type"], "application/json");
  assert.equal(post.init.body, JSON.stringify({ email: "a@b.c" }));
});

test("POST without a bootstrap token is refused locally, nothing is sent", async () => {
  const fake = recording([]);
  const client = createClient({ transport: fake.transport, base: BASE });
  await assert.rejects(client.post("/auth/login", { email: "a@b.c", password: "x" }), (e) => e.code === "csrf_missing");
  assert.equal(fake.calls.length, 0);
});

test("a POST without parameters sends {} — never an empty or form body", async () => {
  const fake = recording([json(200, { version: 1, authenticated: true, expiresAt: null, csrfToken: "t" }), new Response(null, { status: 204 })]);
  const client = createClient({ transport: fake.transport, base: BASE });
  await client.bootstrap();
  await client.post("/auth/logout");
  assert.equal(fake.calls[1].init.body, "{}");
});

test("server error codes are kept; non-JSON proxy errors map by status without echoing the body", async () => {
  const fake = recording([
    json(200, { version: 1, authenticated: false, expiresAt: null, csrfToken: "t" }),
    json(401, { code: "invalid_credentials", message: "x" }),
    new Response("<html>Bad Gateway: secret upstream detail</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
    json(400, { code: "<b>not-a-code</b>", message: "x" }),
    new Response("nope", { status: 418 }),
  ]);
  const client = createClient({ transport: fake.transport, base: BASE });
  await client.bootstrap();
  await assert.rejects(client.post("/auth/login", {}), (e) => e instanceof ApiError && e.status === 401 && e.code === "invalid_credentials");
  await assert.rejects(client.post("/auth/login", {}), (e) => e.code === "service_unavailable" && !String(e.message).includes("secret"));
  await assert.rejects(client.post("/auth/login", {}), (e) => e.code === "invalid_request");
  await assert.rejects(client.post("/auth/login", {}), (e) => e.code === "unexpected");
});

test("a rejected CSRF token is dropped: the next POST is not sent until a new bootstrap", async () => {
  const fake = recording([
    json(200, { version: 1, authenticated: true, expiresAt: null, csrfToken: "old" }),
    json(403, { code: "csrf_invalid", message: "x" }),
  ]);
  const client = createClient({ transport: fake.transport, base: BASE });
  await client.bootstrap();
  await assert.rejects(client.post("/account/password", { currentPassword: "a", newPassword: "b" }), (e) => e.code === "csrf_invalid");
  assert.equal(client.hasToken(), false);
  await assert.rejects(client.post("/account/password", { currentPassword: "a", newPassword: "b" }), (e) => e.code === "csrf_missing");
  assert.equal(fake.calls.length, 2, "the mutation was not repeated automatically");
});

test("network failure and Retry-After", async () => {
  const fake = recording([
    json(200, { version: 1, authenticated: false, expiresAt: null, csrfToken: "t" }),
    new TypeError("Failed to fetch"),
    json(429, { code: "rate_limited", message: "x" }, { "Retry-After": "42" }),
    json(429, { code: "rate_limited", message: "x" }),
  ]);
  const client = createClient({ transport: fake.transport, base: BASE });
  await client.bootstrap();
  await assert.rejects(client.post("/auth/forgot-password", { email: "a@b.c" }), (e) => e.code === "network" && e.status === 0);
  await assert.rejects(client.post("/auth/forgot-password", { email: "a@b.c" }), (e) => e.code === "rate_limited" && e.retryAfter === 42);
  await assert.rejects(client.post("/auth/forgot-password", { email: "a@b.c" }), (e) => e.code === "rate_limited" && e.retryAfter === null);
  assert.equal(parseRetryAfter("Wed, 21 Oct 2026 07:28:30 GMT", Date.parse("Wed, 21 Oct 2026 07:28:00 GMT")), 30);
  assert.equal(parseRetryAfter("soon"), null);
});

test("a malformed session answer is not trusted", async () => {
  for (const body of [{ authenticated: true, csrfToken: "t" }, { version: 1, authenticated: "yes", csrfToken: "t" }, { version: 1, authenticated: true, csrfToken: "" }]) {
    const client = createClient({ transport: async () => json(200, body), base: BASE });
    await assert.rejects(client.bootstrap(), (e) => e.code === "unexpected");
    assert.equal(client.hasToken(), false);
  }
});

test("texts: codes and states are translated; unknown ones stay neutral", () => {
  assert.match(errorText({ code: "current_password_invalid" }, "ru"), /Текущий пароль неверен/);
  assert.match(errorText({ code: "current_password_invalid" }, "en"), /current password is wrong/);
  assert.match(errorText({ code: "rate_limited", retryAfter: 12 }, "ru"), /12 с/);
  assert.equal(errorText({ code: "something_new" }, "en"), errorText({ code: "unexpected" }, "en"));
  // Confirmation and Google answers have their own texts; none of them reads as an outage.
  const outage = errorText({ code: "service_unavailable" }, "ru");
  for (const code of ["email_unconfirmed", "google_link_required", "google_link_conflict", "google_flow_expired", "logout_required"]) {
    for (const lang of ["ru", "en"]) {
      const text = errorText({ code }, lang);
      assert.notEqual(text, errorText({ code: "unexpected" }, lang), `${code} (${lang}) has its own text`);
      assert.notEqual(text, outage, code);
    }
  }
  assert.match(errorText({ code: "email_unconfirmed" }, "ru"), /Подтвердите почту/);
  assert.match(errorText({ code: "google_link_required" }, "en"), /link Google/);
  assert.deepEqual(billingState("active", "ru"), { text: "Подписка активна", tone: "on" });
  assert.equal(billingState("brand_new_state", "en").tone, "", "an unknown state is never shown as success");
  assert.equal(moduleName({ id: "kaspi-app", name: "Kaspi App" }), "TikDonate", "display name changes, id does not");
  assert.equal(moduleName({ id: "tiktok-overlay", name: "TikTok Overlay" }), "Battle Overlay", "the module id stays tiktok-overlay");
  assert.equal(moduleName({ id: "future-module", name: "Future" }), "Future");
  assert.equal(packName({ id: "standard" }, "en"), "Standard pack");
  assert.equal(formatDate(null), "");
  assert.equal(formatDate("not a date"), "");
  assert.ok(formatDate("2026-11-03T12:00:00Z", "ru").length > 0);
});
