// The real client against the demo server: the flows the brief asks to cover.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../../../assets/js/account/api.js";
import { createMockServer, MOCK_API_BASE, DEMO } from "../../../tools/account/mock/mock-server.js";

function setup(now) {
  const server = createMockServer(now ? { now } : undefined);
  const client = createClient({ transport: server.transport, base: MOCK_API_BASE });
  return { server, client, c: server.controls };
}
async function signIn(client, email = DEMO.email, password = DEMO.password) {
  await client.bootstrap();
  await client.post("/auth/login", { email, password });
  return client.bootstrap();
}
const code = (fragment) => new URLSearchParams(fragment).get("code");

test("sign-in issues a new CSRF token: the anonymous one stops working", async () => {
  const { client } = setup();
  const before = await client.bootstrap();
  assert.equal(before.authenticated, false);
  await client.post("/auth/login", { email: DEMO.email, password: DEMO.password });
  // Still holding the anonymous token: rejected, so a new bootstrap is required.
  await assert.rejects(client.post("/account/email/request", {}), (e) => e.code === "csrf_invalid");
  const after = await client.bootstrap();
  assert.equal(after.authenticated, true);
  await client.post("/account/email/request", {});
});

test("anonymous and expired sessions get 401 session_expired, and the session reads as signed out", async () => {
  const { client, c } = setup();
  await client.bootstrap();
  await assert.rejects(client.get("/account"), (e) => e.status === 401 && e.code === "session_expired");
  await signIn(client);
  c.expireSession();
  await assert.rejects(client.get("/account/devices"), (e) => e.code === "session_expired");
  assert.equal((await client.bootstrap()).authenticated, false);
});

test("idle timeout ends the session after 30 minutes without activity", async () => {
  let time = Date.parse("2026-10-04T10:00:00Z");
  const { client } = setup(() => time);
  await signIn(client);
  time += 29 * 60_000;
  await client.get("/account");           // activity extends the idle window
  time += 29 * 60_000;
  await client.get("/account");
  time += 31 * 60_000;
  await assert.rejects(client.get("/account"), (e) => e.code === "session_expired");
});

test("wrong credentials and a second sign-in are refused", async () => {
  const { client } = setup();
  await client.bootstrap();
  await assert.rejects(client.post("/auth/login", { email: DEMO.email, password: "wrong-password" }), (e) => e.code === "invalid_credentials");
  await assert.rejects(client.post("/auth/login", { email: "nobody@tikteam.test", password: "whatever-123" }), (e) => e.code === "invalid_credentials");
  await signIn(client);
  await assert.rejects(client.post("/auth/login", { email: DEMO.email, password: DEMO.password }), (e) => e.code === "logout_required");
});

test("forgot and register answer the same for existing and unknown addresses", async () => {
  const { client } = setup();
  await client.bootstrap();
  const known = await client.post("/auth/forgot-password", { email: DEMO.email });
  const unknown = await client.post("/auth/forgot-password", { email: "nobody@tikteam.test" });
  assert.deepEqual([known.status, known.body], [unknown.status, unknown.body]);
  const fresh = await client.post("/auth/register", { email: "new@tikteam.test", password: "new-pass-2026" });
  const taken = await client.post("/auth/register", { email: DEMO.email, password: "other-pass-2026" });
  assert.deepEqual([fresh.status, fresh.body], [taken.status, taken.body]);
  assert.equal(fresh.status, 202);
  assert.equal((await client.bootstrap()).authenticated, false, "registration does not sign in");
});

test("strict JSON: unknown fields are rejected", async () => {
  const { client } = setup();
  await client.bootstrap();
  await assert.rejects(client.post("/auth/forgot-password", { email: DEMO.email, redirect: "https://evil.example" }), (e) => e.code === "invalid_request");
  await assert.rejects(client.post("/auth/login", { email: DEMO.email, password: DEMO.password, userId: "x" }), (e) => e.code === "invalid_request");
});

test("password change checks the current password and ends every session", async () => {
  const { client, c } = setup();
  await signIn(client);
  await assert.rejects(client.post("/account/password", { currentPassword: "wrong-one-123", newPassword: "fresh-pass-2026" }), (e) => e.code === "current_password_invalid");
  await assert.rejects(client.post("/account/password", { currentPassword: DEMO.password, newPassword: DEMO.password }), (e) => e.code === "password_invalid");
  await assert.rejects(client.post("/account/password", { currentPassword: DEMO.password, newPassword: "short" }), (e) => e.code === "password_invalid");
  await client.post("/account/password", { currentPassword: DEMO.password, newPassword: "fresh-pass-2026" });
  assert.equal((await client.bootstrap()).authenticated, false, "the website session ended too");
  assert.ok(c.users.get(DEMO.email).devices.every((d) => !d.hasActiveSession), "app sessions ended");
  await signIn(client, DEMO.email, "fresh-pass-2026");
});

test("sign out everywhere needs the current password and revokes both kinds of sessions", async () => {
  const { client, c } = setup();
  await signIn(client);
  await assert.rejects(client.post("/auth/logout-all", { currentPassword: "nope-nope-1" }), (e) => e.code === "current_password_invalid");
  assert.equal((await client.bootstrap()).authenticated, true);
  await client.post("/auth/logout-all", { currentPassword: DEMO.password });
  assert.equal((await client.bootstrap()).authenticated, false);
  assert.ok(c.users.get(DEMO.email).devices.every((d) => !d.hasActiveSession));
});

test("removing a computer: current password, unknown or foreign id gets the same 404", async () => {
  const { client } = setup();
  await signIn(client);
  const { body } = await client.get("/account/devices");
  assert.equal(body.limit, 2);
  assert.ok(body.devices.every((d) => d.isCurrent === false), "the browser is never a computer");
  await assert.rejects(client.post("/account/devices/dev_stream_pc/remove", { currentPassword: "nope-nope-1" }), (e) => e.code === "current_password_invalid");
  await assert.rejects(client.post("/account/devices/someone-elses-pc/remove", { currentPassword: DEMO.password }), (e) => e.status === 404 && e.code === "device_not_found");
  await client.post("/account/devices/dev_stream_pc/remove", { currentPassword: DEMO.password });
  assert.equal((await client.get("/account/devices")).body.devices.length, 1);
  assert.equal((await client.bootstrap()).authenticated, true, "removing a computer keeps the website session");
});

test("recovery codes work once, only for their purpose, and expire", async () => {
  let time = Date.parse("2026-10-04T10:00:00Z");
  const { client, c } = setup(() => time);
  await client.bootstrap();
  await client.post("/auth/forgot-password", { email: DEMO.email });
  const reset = code(c.lastLink("reset"));
  await assert.rejects(client.post("/auth/confirm-email", { code: reset }), (e) => e.code === "link_invalid", "wrong purpose");
  await assert.rejects(client.post("/auth/reset-password", { code: reset, newPassword: "short" }), (e) => e.code === "password_invalid");
  await client.post("/auth/reset-password", { code: reset, newPassword: "after-reset-2026" });
  await assert.rejects(client.post("/auth/reset-password", { code: reset, newPassword: "again-reset-2026" }), (e) => e.code === "link_invalid", "second use");
  await signIn(client, DEMO.email, "after-reset-2026");

  const confirm = code(c.issueLink("confirm"));
  time += 31 * 60_000;
  await client.bootstrap();
  await assert.rejects(client.post("/auth/confirm-email", { code: confirm }), (e) => e.code === "link_invalid", "expired after 30 minutes");
  const fresh = code(c.issueLink("confirm"));
  await client.post("/auth/confirm-email", { code: fresh });
  // 31 minutes passed, so the website session itself has idled out; read the stored flag.
  assert.equal(c.users.get(DEMO.email).confirmed, true);
  await assert.rejects(client.get("/account"), (e) => e.code === "session_expired");
});

test("checkout: a repeated click reuses the pending purchase; nothing is granted until the server check", async () => {
  const { client, c } = setup();
  await signIn(client);
  assert.equal((await client.get("/billing/status")).body.state, "none");
  await assert.rejects(client.post("/billing/checkout", { moduleId: "kaspi-app" }), (e) => e.code === "invalid_request", "TikDonate has no product yet");
  await assert.rejects(client.post("/billing/checkout", { moduleId: "avatar-overlay", priceId: "pri_x" }), (e) => e.code === "invalid_request");
  const first = await client.post("/billing/checkout", { moduleId: "avatar-overlay" });
  const second = await client.post("/billing/checkout", { moduleId: "avatar-overlay" });
  assert.notEqual(first.body.url, second.body.url, "a fresh one-time link each time");
  assert.equal(c.users.get(DEMO.email).billing.checkouts, 1, "but still one purchase");
  // Returning from the payment page grants nothing by itself.
  let status = (await client.post("/billing/check", {})).body;
  assert.equal(status.state, "awaiting_payment");
  assert.equal((await client.get("/account")).body.modules.find((m) => m.id === "avatar-overlay").active, false);
  await assert.rejects(client.post("/billing/portal", {}), (e) => e.code === "billing_unavailable");
  c.completePayment();
  status = (await client.post("/billing/check", {})).body;
  assert.equal(status.state, "active");
  const account = (await client.get("/account")).body;
  assert.equal(account.modules.find((m) => m.id === "avatar-overlay").active, true);
  assert.equal(account.modules.find((m) => m.id === "kaspi-app").name, "TikDonate");
  assert.ok((await client.post("/billing/portal", {})).body.url.startsWith("https://sandbox-customer-portal.paddle.com/cpl_"));
});

test("payments switched off: honest flags, checkout refused", async () => {
  const { client, c } = setup();
  await signIn(client);
  c.setBillingEnabled(false);
  const status = (await client.get("/billing/status")).body;
  assert.deepEqual([status.enabled, status.canCheckout, status.canManage, status.state], [false, false, false, "disabled"]);
  await assert.rejects(client.post("/billing/checkout", { moduleId: "avatar-overlay" }), (e) => e.status === 409 && e.code === "billing_unavailable");
});
