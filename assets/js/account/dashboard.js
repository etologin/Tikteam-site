// What the dashboard may show for one profile. Pure and DOM-free, so it is tested directly.
// The server stays the authority: it refuses every feature to an unconfirmed email with
// 403 email_unconfirmed. This only keeps the page from asking for features or showing them.

/**
 * @param {object} account body of GET /account
 * @param {boolean|null} googleEnabled answer of GET /auth/google/config, null while unknown
 */
export function dashboardPlan(account, googleEnabled) {
  const confirmed = account?.emailConfirmed === true;
  // Servers from before Google always had a password: only an explicit false means none.
  const hasPassword = account?.hasPassword !== false;
  const google = confirmed && googleEnabled === true;
  return {
    confirmed,
    hasPassword,
    // Before confirmation: the email and its state, the confirmation letter, recovery and sign-out.
    loadFeatures: confirmed,
    cards: { billing: confirmed, modules: confirmed, devices: confirmed, google, security: confirmed },
    resendConfirmation: !confirmed,
    recovery: !confirmed,
    // Forms that need the current password; without one the first password comes from recovery.
    passwordForms: confirmed && hasPassword,
    setPassword: confirmed && !hasPassword,
    removeDevices: confirmed && hasPassword,
    googleLink: google && hasPassword,
    googleOnly: google && !hasPassword,
  };
}
