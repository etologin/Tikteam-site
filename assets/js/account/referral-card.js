import { pageLang, t } from "./i18n.js";
import { invitationLink, referralCode } from "./referrals.js";

export function createReferralCard(root) {
  const value = root.querySelector("[data-invite-code]");
  const actions = root.querySelector("[data-invite-actions]");
  const enter = root.querySelector("[data-invite-enter]");
  const retry = root.querySelector("[data-invite-retry]");
  const status = root.querySelector("[data-invite-status]");
  let code = "", state = "", feedback = "";
  const messages = { loading: "referral.loading", unconfirmed: "referral.confirm", error: "referral.failed" };

  function render() {
    for (const element of root.querySelectorAll("[data-invite-text]")) element.textContent = t(element.dataset.inviteText);
    value.textContent = code;
    value.hidden = actions.hidden = !code;
    if (enter) {
      enter.hidden = Boolean(code) || state === "loading";
      const target = new URL(pageLang() === "en" ? "/en/account/" : "/account/", "https://account.tikteam.live");
      if (!["ru", "en"].includes(pageLang())) target.searchParams.set("lang", pageLang());
      target.hash = "referrals";
      enter.href = target.href;
    }
    if (retry) retry.hidden = state !== "error";
    const message = feedback || messages[state];
    status.textContent = message ? t(message) : "";
  }

  for (const button of actions.querySelectorAll("button")) button.addEventListener("click", async () => {
    if (!code) return;
    const active = code;
    const link = button.dataset.inviteCopy === "link";
    let result;
    try {
      await navigator.clipboard.writeText(link ? invitationLink(active, pageLang()).href : active);
      result = link ? "referral.linkCopied" : "referral.codeCopied";
    } catch { result = "referral.copyManually"; }
    if (code !== active) return;
    feedback = result;
    render();
  });

  return {
    render,
    show(next, value = "") { state = next; code = referralCode(value); feedback = ""; render(); },
  };
}
