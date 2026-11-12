const ACCOUNT_ORIGIN = "https://account.tikteam.live";
const pendingKey = "tikteam.pending-referral";
const tabStorage = () => globalThis.sessionStorage;

export function referralCode(value) {
  if (typeof value !== "string") return "";
  const code = value.trim().toUpperCase();
  return /^(?:[2-9A-HJ-NP-Z]{6}|TT-[0-9A-F]{32})$/.test(code) ? code : "";
}

export function invitationLink(code, language) {
  const valid = referralCode(code);
  if (!valid) return null;
  const url = new URL(language === "en" ? "/en/account/" : "/account/", ACCOUNT_ORIGIN);
  if (language !== "ru" && language !== "en") url.searchParams.set("lang", language);
  url.searchParams.set("ref", valid);
  return url;
}

export function readInvitation(url, storage = tabStorage) {
  const incoming = referralCode(url.searchParams.get("ref"));
  if (incoming) {
    // The code is public. Keep it across Google and email flows within this tab.
    // Attaching it to the authenticated account always requires an explicit submit.
    try { storage().setItem(pendingKey, incoming); } catch { /* Storage may be unavailable. */ }
    return incoming;
  }
  try { return referralCode(storage().getItem(pendingKey)); } catch { return ""; }
}

export function clearInvitation(storage = tabStorage) {
  try { storage().removeItem(pendingKey); } catch { /* Storage may be unavailable. */ }
}
