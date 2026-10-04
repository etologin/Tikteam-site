// In-memory stand-in for the account API (/api/web/v1), used only by mock builds and tests.
// It follows the server contract closely enough to exercise the real client code path:
// CSRF bound to the signed-in principal, strict JSON fields, the documented error codes,
// one-time recovery codes, pending payments that grant nothing until a server check.
// No real network, provider, mail or money is involved. Never shipped in real builds.

export const MOCK_API_ORIGIN = "https://api.mock.invalid";
export const MOCK_API_BASE = MOCK_API_ORIGIN + "/api/web/v1";
export const DEMO = Object.freeze({ email: "demo@tikteam.test", password: "demo-pass-2026" });

const MINUTE = 60_000;
const IDLE = 30 * MINUTE, ABSOLUTE = 12 * 60 * MINUTE;
const LINK_LIFETIME = { reset: 15 * MINUTE, confirm: 30 * MINUTE };

function random(bytes = 24) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const encodeEmail = (email) => btoa(unescape(encodeURIComponent(email))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function decodeEmail(value) {
  try { return decodeURIComponent(escape(atob(value.replace(/-/g, "+").replace(/_/g, "/")))); } catch { return null; }
}

export function createMockServer({ now = () => Date.now() } = {}) {
  const users = new Map();
  let cookie = null;            // what the browser would hold for the API host
  let csrf = { token: random(), principal: "anon" };
  const usedCodes = new Set();
  const outbox = [];
  let outage = null;            // null | "network" | "502"
  let rateLimitSeconds = null;  // next request answers 429
  const log = [];               // request log for tests (paths only)

  function addUser(email, password, extra = {}) {
    const created = now();
    users.set(email, {
      email, password, confirmed: false, stamp: random(8),
      modules: {
        "sor4": { name: "Streets of Rage 4", active: true, paidUntil: null },   // manual test access
        "dead-as-disco": { name: "Dead as Disco", active: false, paidUntil: null },
        "avatar-overlay": { name: "Avatar Overlay", active: false, paidUntil: null },
        "kaspi-app": { name: "TikDonate", active: false, paidUntil: null },
        "tiktok-overlay": { name: "TikTok Overlay", active: false, paidUntil: null },
      },
      packs: [{ id: "standard", owned: false }, { id: "neon-party", owned: true }],
      devices: [
        { id: "dev_stream_pc", name: "STREAM-PC", addedAt: new Date(created - 20 * 24 * 60 * MINUTE).toISOString(), hasActiveSession: true },
        { id: "dev_laptop", name: "Ноутбук", addedAt: new Date(created - 3 * 24 * 60 * MINUTE).toISOString(), hasActiveSession: false },
      ],
      billing: { enabled: true, pending: false, providerPaid: false, active: false, paidUntil: null, stopAt: null, customer: false, checkouts: 0 },
      ...extra,
    });
  }
  addUser(DEMO.email, DEMO.password);

  /* ---------- helpers ---------- */

  function respond(status, body, extraHeaders = {}) {
    const headers = new Headers({ "Cache-Control": "no-store", ...extraHeaders });
    if (body === undefined || status === 204) return new Response(null, { status, headers });
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(body), { status, headers });
  }
  const fail = (status, code, message, headers) => respond(status, { code, message }, headers);

  function session(credentials) {
    if (credentials !== "include" || !cookie) return null;
    const user = users.get(cookie.email);
    const time = now();
    if (!user || user.stamp !== cookie.stamp || time >= cookie.idleUntil || time >= cookie.absoluteUntil) { cookie = null; return null; }
    cookie.idleUntil = Math.min(time + IDLE, cookie.absoluteUntil); // activity extends idle, never the 12 hours
    return user;
  }
  function principal(credentials) { return session(credentials)?.email ?? "anon"; }
  function rotateCsrf(owner) { csrf = { token: random(), principal: owner }; }
  function revokeEverything(user) {
    user.stamp = random(8);
    for (const device of user.devices) device.hasActiveSession = false;
    if (cookie?.email === user.email) cookie = null;
  }
  function issueLink(purpose, email) {
    const letter = purpose === "reset" ? "r" : "c";
    const code = `mock_${letter}_${encodeEmail(email)}_${now().toString(36)}_${random(12)}`;
    const fragment = `purpose=${purpose}&code=${code}`;
    outbox.push({ to: email, purpose, fragment });
    return fragment;
  }
  // Codes are self-describing so a fresh page (the recovery page) can check them too.
  function readCode(code, purpose) {
    const match = /^mock_([rc])_([A-Za-z0-9_-]+)_([0-9a-z]+)_[A-Za-z0-9_-]+$/.exec(code ?? "");
    if (!match || usedCodes.has(code)) return null;
    if ((match[1] === "r" ? "reset" : "confirm") !== purpose) return null;
    const issued = parseInt(match[3], 36);
    if (!Number.isFinite(issued) || now() - issued > LINK_LIFETIME[purpose] || issued > now() + MINUTE) return null;
    const user = users.get(decodeEmail(match[2]));
    return user ?? null;
  }
  function billingStatus(user) {
    const b = user.billing;
    const state = !b.enabled ? "disabled" : b.active ? "active" : b.pending ? "awaiting_payment" : "none";
    return {
      enabled: b.enabled, canCheckout: b.enabled && !b.active, state,
      message: "Демо-состояние оплаты.", active: b.active,
      paidUntil: b.paidUntil, stopAt: b.stopAt, canManage: b.enabled && b.customer,
    };
  }
  function account(user) {
    const avatar = user.modules["avatar-overlay"].active;
    return {
      email: user.email, emailConfirmed: user.confirmed,
      modules: Object.entries(user.modules).map(([id, m]) => ({ id, name: m.name, active: m.active, paidUntil: m.paidUntil, status: m.active ? "active" : "inactive" })),
      packs: user.packs.map((p) => ({ id: p.id, owned: p.owned, canPlay: avatar })),
    };
  }
  const validEmail = (value) => typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value);
  const validPassword = (value) => typeof value === "string" && value.length >= 8 && value.length <= 128;
  /** Strict JSON: exactly these fields, nothing else. */
  function body(raw, fields) {
    let value;
    try { value = JSON.parse(raw ?? ""); } catch { return null; }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (keys.length !== fields.length || !fields.every((f) => keys.includes(f))) return null;
    return value;
  }

  /* ---------- routes ---------- */

  function handle(method, path, init) {
    const credentials = init.credentials;
    if (method === "GET" && path === "/session") {
      const owner = principal(credentials);
      if (csrf.principal !== owner) rotateCsrf(owner);
      return respond(200, {
        version: 1, authenticated: owner !== "anon",
        expiresAt: owner !== "anon" ? new Date(cookie.idleUntil).toISOString() : null, csrfToken: csrf.token,
      });
    }
    if (method === "GET") {
      const user = session(credentials);
      if (path === "/account") return user ? respond(200, account(user)) : fail(401, "session_expired", "Сеанс завершён.");
      if (path === "/account/devices") return user
        ? respond(200, { devices: user.devices.map((d) => ({ ...d, isCurrent: false })), limit: 2 })
        : fail(401, "session_expired", "Сеанс завершён.");
      if (path === "/billing/status") return user ? respond(200, billingStatus(user)) : fail(401, "session_expired", "Сеанс завершён.");
      return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
    }
    if (method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    // Every POST: JSON and the CSRF token issued for the current principal.
    const headers = new Headers(init.headers);
    if (!/^application\/json\b/i.test(headers.get("Content-Type") ?? "")) return fail(400, "invalid_request", "Нужен JSON.");
    if (headers.get("X-TikTeam-CSRF") !== csrf.token || csrf.principal !== principal(credentials))
      return fail(403, "csrf_invalid", "Защита запроса устарела.");
    const raw = init.body;
    const user = session(credentials);
    const needUser = () => fail(401, "session_expired", "Сеанс завершён.");

    switch (path) {
      case "/auth/register": {
        const b = body(raw, ["email", "password"]);
        if (!b || !validEmail(b.email)) return fail(400, "invalid_request", "Проверьте email.");
        if (!validPassword(b.password)) return fail(400, "password_invalid", "Пароль 8–128 символов.");
        const email = b.email.trim().toLowerCase();
        if (!users.has(email)) { addUser(email, b.password); issueLink("confirm", email); }
        return respond(202, { message: "Если адрес новый, аккаунт создан." });
      }
      case "/auth/login": {
        const b = body(raw, ["email", "password"]);
        if (!b || typeof b.email !== "string" || typeof b.password !== "string") return fail(400, "invalid_request", "Неверный запрос.");
        if (user) return fail(409, "logout_required", "Сначала выйдите.");
        const target = users.get(b.email.trim().toLowerCase());
        if (!target || target.password !== b.password) return fail(401, "invalid_credentials", "Неверный email или пароль.");
        const time = now();
        cookie = { email: target.email, stamp: target.stamp, idleUntil: time + IDLE, absoluteUntil: time + ABSOLUTE };
        rotateCsrf(target.email);
        return respond(200, { authenticated: true, expiresAt: new Date(cookie.idleUntil).toISOString() });
      }
      case "/auth/logout": {
        if (!body(raw, [])) return fail(400, "invalid_request", "Неверный запрос.");
        cookie = null; rotateCsrf("anon");
        return respond(204);
      }
      case "/auth/logout-all": {
        const b = body(raw, ["currentPassword"]);
        if (!b) return fail(400, "invalid_request", "Неверный запрос.");
        if (!user) return needUser();
        if (user.password !== b.currentPassword) return fail(403, "current_password_invalid", "Текущий пароль неверен.");
        revokeEverything(user); rotateCsrf("anon");
        return respond(204);
      }
      case "/account/password": {
        const b = body(raw, ["currentPassword", "newPassword"]);
        if (!b) return fail(400, "invalid_request", "Неверный запрос.");
        if (!user) return needUser();
        if (user.password !== b.currentPassword) return fail(403, "current_password_invalid", "Текущий пароль неверен.");
        if (!validPassword(b.newPassword) || b.newPassword === b.currentPassword) return fail(400, "password_invalid", "Пароль 8–128 символов.");
        user.password = b.newPassword; revokeEverything(user); rotateCsrf("anon");
        return respond(204);
      }
      case "/account/email/request": {
        if (!body(raw, [])) return fail(400, "invalid_request", "Неверный запрос.");
        if (!user) return needUser();
        if (!user.confirmed) issueLink("confirm", user.email);
        return respond(202, { message: "Письмо отправлено, если адрес не подтверждён." });
      }
      case "/auth/forgot-password": {
        const b = body(raw, ["email"]);
        if (!b || !validEmail(b.email)) return fail(400, "invalid_request", "Проверьте email.");
        const target = users.get(b.email.trim().toLowerCase());
        if (target) issueLink("reset", target.email);
        return respond(202, { message: "Если аккаунт есть, письмо отправлено." });
      }
      case "/auth/confirm-email": {
        const b = body(raw, ["code"]);
        if (!b) return fail(400, "invalid_request", "Неверный запрос.");
        const target = readCode(b.code, "confirm");
        if (!target) return fail(400, "link_invalid", "Ссылка недействительна.");
        usedCodes.add(b.code); target.confirmed = true;
        return respond(204);
      }
      case "/auth/reset-password": {
        const b = body(raw, ["code", "newPassword"]);
        if (!b) return fail(400, "invalid_request", "Неверный запрос.");
        if (!validPassword(b.newPassword)) return fail(400, "password_invalid", "Пароль 8–128 символов.");
        const target = readCode(b.code, "reset");
        if (!target) return fail(400, "link_invalid", "Ссылка недействительна.");
        // Like the server: the browser's token changes only if its own session was revoked.
        const ownSession = cookie?.email === target.email;
        usedCodes.add(b.code); target.password = b.newPassword; revokeEverything(target);
        if (ownSession) rotateCsrf("anon");
        return respond(204);
      }
      case "/billing/check": {
        if (!body(raw, [])) return fail(400, "invalid_request", "Неверный запрос.");
        if (!user) return needUser();
        const b = user.billing;
        // Only the provider's confirmation (simulated by the panel) grants anything.
        if (b.pending && b.providerPaid) {
          const until = new Date(now() + 30 * 24 * 60 * MINUTE).toISOString();
          Object.assign(b, { pending: false, providerPaid: false, active: true, paidUntil: until, customer: true });
          Object.assign(user.modules["avatar-overlay"], { active: true, paidUntil: until });
        }
        return respond(200, billingStatus(user));
      }
      case "/billing/checkout": {
        const b = body(raw, ["moduleId"]);
        if (!b || b.moduleId !== "avatar-overlay") return fail(400, "invalid_request", "Оплата этого модуля не настроена.");
        if (!user) return needUser();
        if (!user.billing.enabled || user.billing.active) return fail(409, "billing_unavailable", "Оплата недоступна.");
        // A repeated click reopens the same pending purchase; it never creates a second one.
        if (!user.billing.pending) { user.billing.pending = true; user.billing.checkouts++; }
        return respond(200, { url: `${MOCK_API_ORIGIN}/billing/checkout#${random(32)}` });
      }
      case "/billing/portal": {
        if (!body(raw, [])) return fail(400, "invalid_request", "Неверный запрос.");
        if (!user) return needUser();
        if (!user.billing.enabled || !user.billing.customer) return fail(409, "billing_unavailable", "Управление станет доступно после первой оплаты.");
        const id = Array.from(crypto.getRandomValues(new Uint8Array(26)), (n) => "abcdefghijklmnopqrstuvwxyz0123456789"[n % 36]).join("");
        return respond(200, { url: `https://sandbox-customer-portal.paddle.com/cpl_${id}?action=overview&token=pga_${random(24)}` });
      }
      default: {
        const remove = /^\/account\/devices\/([^/]+)\/remove$/.exec(path);
        if (remove) {
          const b = body(raw, ["currentPassword"]);
          if (!b) return fail(400, "invalid_request", "Неверный запрос.");
          if (!user) return needUser();
          if (user.password !== b.currentPassword) return fail(403, "current_password_invalid", "Текущий пароль неверен.");
          const id = decodeURIComponent(remove[1]);
          const index = user.devices.findIndex((d) => d.id === id);
          // Same answer for someone else's and a missing computer.
          if (index < 0) return fail(404, "device_not_found", "Компьютер не найден.");
          user.devices.splice(index, 1);
          return respond(204);
        }
        return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain" } });
      }
    }
  }

  async function transport(url, init = {}) {
    if (typeof url !== "string" || !url.startsWith(MOCK_API_BASE + "/")) throw new TypeError("Mock transport only serves the mock API.");
    const path = url.slice(MOCK_API_BASE.length);
    const method = (init.method ?? "GET").toUpperCase();
    log.push(method + " " + path);
    if (outage === "network") throw new TypeError("Failed to fetch");
    if (outage === "502") return new Response("<html>Bad Gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } });
    if (rateLimitSeconds !== null) {
      const seconds = rateLimitSeconds; rateLimitSeconds = null;
      return fail(429, "rate_limited", "Слишком много запросов.", { "Retry-After": String(seconds) });
    }
    return handle(method, path, init);
  }

  return {
    transport,
    /** Controls for the demo panel and tests. Not part of any API. */
    controls: {
      demo: DEMO,
      users,
      log,
      outbox,
      lastLink(purpose) { return [...outbox].reverse().find((m) => m.purpose === purpose)?.fragment ?? null; },
      issueLink(purpose, email = DEMO.email) { return issueLink(purpose, email); },
      expireSession() { cookie = null; },
      setOutage(kind) { outage = kind; },
      get outage() { return outage; },
      rateLimitNext(seconds) { rateLimitSeconds = seconds; },
      completePayment(email = DEMO.email) { const user = users.get(email); if (user?.billing.pending) user.billing.providerPaid = true; return !!user?.billing.pending; },
      setBillingEnabled(enabled, email = DEMO.email) { users.get(email).billing.enabled = enabled; },
      currentCsrf() { return csrf.token; },
    },
  };
}

/** The page-wide instance used by mock builds. */
export const mockServer = createMockServer();
