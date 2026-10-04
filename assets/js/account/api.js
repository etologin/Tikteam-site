// Browser client for the account API (/api/web/v1). The session cookie is HttpOnly and
// belongs to the API host; this code never sees it. The CSRF token lives only in this
// module's memory: never Web Storage, IndexedDB or the URL. Nothing is retried
// automatically: a failed purchase or account change is reported, not repeated.

export class ApiError extends Error {
  /**
   * @param {number} status HTTP status, 0 for network or local failures
   * @param {string} code stable error code from the server, or one derived from the status
   * @param {number|null} retryAfter seconds from Retry-After, when the server sent one
   */
  constructor(status, code, retryAfter = null) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const STATUS_CODES = {
  400: "invalid_request", 401: "session_expired", 403: "forbidden", 404: "not_found",
  409: "conflict", 429: "rate_limited", 500: "internal_error",
  502: "service_unavailable", 503: "service_unavailable", 504: "service_unavailable",
};

/** Seconds from a Retry-After header (delta-seconds or HTTP date), or null. */
export function parseRetryAfter(value, now = Date.now()) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  if (/^\d{1,6}$/.test(text)) return Number(text);
  const at = Date.parse(text);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

async function readBody(response) {
  if (response.status === 204) return null;
  const type = response.headers.get("Content-Type") || "";
  if (!/^application\/(problem\+)?json\b/i.test(type)) return null;
  try { return await response.json(); } catch { return null; }
}

/**
 * @param {{transport: (url: string, init: RequestInit) => Promise<Response>, base: string}} options
 */
export function createClient({ transport, base }) {
  if (typeof transport !== "function" || typeof base !== "string" || !base) throw new Error("Account client is not configured.");
  let csrf = null;

  async function call(method, path, body) {
    const headers = { Accept: "application/json" };
    const init = {
      method, headers, credentials: "include", cache: "no-store",
      redirect: "error", referrerPolicy: "no-referrer", mode: "cors",
    };
    if (method === "POST") {
      // Every POST needs the token from GET /session, even sign-in and recovery.
      if (!csrf) throw new ApiError(0, "csrf_missing");
      headers["Content-Type"] = "application/json";
      headers["X-TikTeam-CSRF"] = csrf;
      init.body = JSON.stringify(body ?? {});
    }
    let response;
    try { response = await transport(base + path, init); }
    catch { throw new ApiError(0, "network"); }
    const data = await readBody(response);
    if (!response.ok) {
      const serverCode = data && typeof data.code === "string" && /^[a-z_]{1,64}$/.test(data.code) ? data.code : null;
      const code = serverCode ?? STATUS_CODES[response.status] ?? "unexpected";
      // A rejected token is useless: the page must fetch a new one before the next action.
      if (code === "csrf_invalid") csrf = null;
      throw new ApiError(response.status, code, parseRetryAfter(response.headers.get("Retry-After")));
    }
    return { status: response.status, body: data };
  }

  return {
    /** GET /session: refreshes the CSRF token. Call on load and after every sign-in or sign-out. */
    async bootstrap() {
      csrf = null;
      const { body } = await call("GET", "/session");
      if (!body || body.version !== 1 || typeof body.authenticated !== "boolean"
        || typeof body.csrfToken !== "string" || !body.csrfToken) throw new ApiError(200, "unexpected");
      csrf = body.csrfToken;
      return { authenticated: body.authenticated, expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null };
    },
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body ?? {}),
    hasToken: () => csrf !== null,
    /** Drops the token, e.g. when the page is left or the account changes. */
    forget() { csrf = null; },
  };
}
