// What the dashboard shows for a profile: confirmation first, Google only when the server
// says so, and no current-password forms for an account that has no password.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardPlan } from "../../../assets/js/account/dashboard.js";

const confirmed = { email: "a@b.c", emailConfirmed: true, hasPassword: true, modules: [], packs: [] };

test("unconfirmed email: only the profile, the confirmation letter, recovery and sign-out", () => {
  for (const account of [{ ...confirmed, emailConfirmed: false }, { ...confirmed, emailConfirmed: "true" }, { email: "a@b.c" }, null, undefined]) {
    const plan = dashboardPlan(account, true);
    assert.equal(plan.confirmed, false, JSON.stringify(account));
    assert.equal(plan.loadFeatures, false, "computers and billing are not even requested");
    assert.deepEqual(plan.cards, { billing: false, modules: false, devices: false, google: false, security: false });
    assert.equal(plan.resendConfirmation, true);
    assert.equal(plan.recovery, true);
    for (const key of ["passwordForms", "setPassword", "removeDevices", "googleLink", "googleOnly"]) assert.equal(plan[key], false, key);
  }
});

test("confirmed account with a password: every card, password forms, Google link when configured", () => {
  const plan = dashboardPlan(confirmed, true);
  assert.equal(plan.loadFeatures, true);
  assert.deepEqual(plan.cards, { billing: true, modules: true, devices: true, google: true, security: true });
  assert.equal(plan.resendConfirmation, false);
  assert.equal(plan.recovery, false);
  assert.deepEqual([plan.passwordForms, plan.setPassword, plan.removeDevices], [true, false, true]);
  assert.deepEqual([plan.googleLink, plan.googleOnly], [true, false]);
});

test("Google appears only when the server answered enabled: true", () => {
  for (const google of [false, null, undefined, "true", 1]) {
    const plan = dashboardPlan(confirmed, google);
    assert.equal(plan.cards.google, false, String(google));
    assert.equal(plan.googleLink, false);
    assert.equal(plan.googleOnly, false);
    assert.equal(plan.cards.security, true, "the rest of the dashboard is unaffected");
  }
});

test("hasPassword=false: no current-password forms; the first password comes from recovery", () => {
  const plan = dashboardPlan({ ...confirmed, hasPassword: false }, true);
  assert.equal(plan.hasPassword, false);
  assert.deepEqual([plan.passwordForms, plan.setPassword, plan.removeDevices], [false, true, false]);
  assert.deepEqual([plan.googleLink, plan.googleOnly], [false, true]);
  assert.equal(plan.cards.security, true, "the security card explains how to set a password");
  assert.equal(dashboardPlan({ ...confirmed, hasPassword: false }, false).googleOnly, false);
});

test("a server without hasPassword is treated as one where every account has a password", () => {
  const { hasPassword: _, ...old } = confirmed;
  const plan = dashboardPlan(old, true);
  assert.equal(plan.hasPassword, true);
  assert.equal(plan.passwordForms, true);
  assert.equal(dashboardPlan({ ...confirmed, hasPassword: "false" }, true).hasPassword, true, "only an explicit false counts");
});
