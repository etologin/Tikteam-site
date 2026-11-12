import assert from "node:assert/strict";
import { test } from "node:test";
import { loadHomeReferral } from "../../../assets/js/referral-home.js";
import { invitationLink, readInvitation } from "../../../assets/js/account/referrals.js";

test("a guest is offered sign-in without minting a code", async () => {
  const calls = [];
  const result = await loadHomeReferral(async (url, options) => {
    calls.push(url);
    assert.equal(options.credentials, "include");
    return Response.json({ authenticated: false });
  });
  assert.deepEqual(result, { state: "guest" });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/referral\/session$/);
});

test("a signed-in visitor gets the exact six-character code using the session token", async () => {
  const result = await loadHomeReferral(async (url, options) => {
    if (url.endsWith("/session")) return Response.json({ authenticated: true, csrfToken: "only-in-memory" });
    assert.match(url, /\/referral\/code$/);
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-TikTeam-CSRF"], "only-in-memory");
    assert.equal(options.cache, "no-store");
    assert.equal(options.body, "{}");
    return Response.json({ code: "Q2WF9R" });
  });
  assert.deepEqual(result, { state: "ready", code: "Q2WF9R" });
  assert.equal(invitationLink(result.code, "en").href, "https://account.tikteam.live/en/account/?ref=Q2WF9R");
});

test("pending verification and invalid server codes remain distinct", async () => {
  const session = () => Response.json({ authenticated: true, csrfToken: "only-in-memory" });
  assert.deepEqual(await loadHomeReferral(async (url) => url.endsWith("/session") ? session()
    : Response.json({ code: "email_unconfirmed" }, { status: 403 })), { state: "unconfirmed" });
  await assert.rejects(loadHomeReferral(async (url) => url.endsWith("/session") ? session()
    : Response.json({ code: "<script>" })), /invalid referral code/);
});

test("only the validated public invitation is retained across sign-in", () => {
  const contents = new Map();
  const storage = () => ({ setItem: (key, value) => contents.set(key, value), getItem: (key) => contents.get(key) });
  assert.equal(readInvitation(new URL("https://account.tikteam.live/account/?ref=q2wf9r&token=private"), storage), "Q2WF9R");
  assert.deepEqual([...contents], [["tikteam.pending-referral", "Q2WF9R"]]);
  assert.equal(readInvitation(new URL("https://account.tikteam.live/account/"), storage), "Q2WF9R");
});
