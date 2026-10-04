// Strict checks for the two URLs the server hands out. Anything else is refused,
// including look-alike hosts, user info, explicit ports, extra query or fragments.

const PORTAL_HOST = "sandbox-customer-portal.paddle.com";

function parse(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 8192 || value !== value.trim()) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return null;
  try { return new URL(value); } catch { return null; }
}

/**
 * One-time checkout link: the account API's own hosted page, `/billing/checkout#…`.
 * @param {unknown} value server response field
 * @param {string} checkoutOrigin exact origin for this build, e.g. https://api.tikteam.live
 */
export function checkoutUrl(value, checkoutOrigin) {
  const url = parse(value);
  if (!url || typeof checkoutOrigin !== "string" || !checkoutOrigin.startsWith("https://")) return null;
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (url.origin !== checkoutOrigin || url.pathname !== "/billing/checkout" || url.search) return null;
  if (url.hash.length < 2 || !/^#[A-Za-z0-9._~=&%-]{1,4096}$/.test(url.hash)) return null;
  return url;
}

/** Paddle Sandbox customer portal overview, mirroring the server's BillingLinks.SandboxPortal. */
export function portalUrl(value) {
  const url = parse(value);
  if (!url || url.protocol !== "https:" || url.hostname !== PORTAL_HOST || url.port) return null;
  if (url.username || url.password || url.hash) return null;
  if (!/^\/cpl_[a-z0-9]{26}$/.test(url.pathname)) return null;
  const pairs = url.search.replace(/^\?/, "").split("&").map((p) => p.split("="));
  if (pairs.length !== 2 || pairs.some((p) => p.length !== 2)) return null;
  const action = pairs.filter((p) => p[0] === "action");
  const token = pairs.filter((p) => p[0] === "token");
  if (action.length !== 1 || action[0][1] !== "overview" || token.length !== 1) return null;
  let decoded;
  try { decoded = decodeURIComponent(token[0][1]); } catch { return null; }
  if (!/^pga_[A-Za-z0-9._-]{20,8000}$/.test(decoded)) return null;
  return url;
}

/**
 * Recovery fragment `purpose=reset|confirm&code=…`. Returns null for anything else.
 * The server decides whether the code is valid; this only refuses malformed input.
 */
export function recoveryLink(fragment) {
  if (typeof fragment !== "string" || fragment.length < 1 || fragment.length > 2048) return null;
  const pairs = fragment.split("&").map((p) => p.split("="));
  if (pairs.length !== 2 || pairs.some((p) => p.length !== 2)) return null;
  const fields = Object.fromEntries(pairs);
  if (Object.keys(fields).length !== 2) return null;
  const purpose = fields.purpose;
  let code;
  try { code = decodeURIComponent(fields.code ?? ""); } catch { return null; }
  if (purpose !== "reset" && purpose !== "confirm") return null;
  if (!/^[A-Za-z0-9_-]{16,512}$/.test(code)) return null;
  return { purpose, code };
}
