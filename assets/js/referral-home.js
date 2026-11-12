import { localizationReady } from "./language.js";
import { createReferralCard } from "./account/referral-card.js";
import { referralCode } from "./account/referrals.js";

const prefix = "https://api.tikteam.live/api/web/v1/referral/";

export async function loadHomeReferral(transport, signal) {
  const options = { credentials: "include", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal };
  const session = await transport(prefix + "session", options);
  if (!session.ok) throw new Error("referral session");
  const { authenticated, csrfToken } = await session.json();
  if (authenticated === false) return { state: "guest" };
  if (authenticated !== true || typeof csrfToken !== "string" || !csrfToken) throw new Error("invalid referral session");
  const answer = await transport(prefix + "code", {
    ...options, method: "POST", headers: { "Content-Type": "application/json", "X-TikTeam-CSRF": csrfToken }, body: "{}",
  });
  if (answer.status === 401) return { state: "guest" };
  if (!answer.ok) {
    const problem = await answer.json().catch(() => null);
    if (answer.status === 403 && problem?.code === "email_unconfirmed") return { state: "unconfirmed" };
    throw new Error("referral code");
  }
  const code = referralCode((await answer.json()).code);
  if (code.length !== 6) throw new Error("invalid referral code");
  return { state: "ready", code };
}

const root = globalThis.document?.querySelector("[data-home-referral]");
if (root) {
  await localizationReady;
  const card = createReferralCard(root);
  card.render();
  document.addEventListener("tikteam-language-changed", card.render);
  if (location.origin === "https://tikteam.live") {
    let request;
    async function refresh() {
      request?.abort();
      const current = request = new AbortController();
      card.show("loading");
      try {
        const result = await loadHomeReferral((url, options) => fetch(url, options), current.signal);
        if (!current.signal.aborted) card.show(result.state, result.code);
      } catch { if (!current.signal.aborted) card.show("error"); }
    }
    addEventListener("pagehide", () => { request?.abort(); card.show("guest"); });
    root.querySelector("[data-invite-retry]").addEventListener("click", refresh);
    addEventListener("pageshow", (event) => { if (event.persisted) refresh(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { request?.abort(); card.show("guest"); }
      else refresh();
    });
    if (!document.hidden) refresh();
  }
}
