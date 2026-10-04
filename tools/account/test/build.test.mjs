// The build picks the mode explicitly; real and disabled builds contain no demo code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BUILD = join(SITE, "tools", "account", "build.mjs");
const run = (...args) => spawnSync(process.execPath, [BUILD, ...args], { encoding: "utf8" });
const temp = () => mkdtempSync(join(tmpdir(), "tikteam-account-"));
const read = (root, path) => readFileSync(join(root, path), "utf8");

test("mock build: demo server and panel are included, no network allowed by CSP", () => {
  const out = temp();
  try {
    const result = run("--mode", "mock", "--out", out);
    assert.equal(result.status, 0, result.stderr);
    assert.match(read(out, "assets/js/account/config.js"), /export const MODE = "mock";/);
    assert.ok(existsSync(join(out, "assets/js/account/mock-server.js")));
    assert.ok(existsSync(join(out, "assets/js/account/mock-panel.js")));
    assert.match(read(out, "account/index.html"), /connect-src 'none'/);
    assert.ok(!existsSync(join(out, "tools")), "build tools are not copied");
    assert.ok(!existsSync(join(out, ".git")));
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test("real build: exact API origin in config and CSP, no demo files", () => {
  const out = temp();
  try {
    const result = run("--mode", "real", "--api-origin", "https://api-test.tikteam.live", "--out", out);
    assert.equal(result.status, 0, result.stderr);
    const config = read(out, "assets/js/account/config.js");
    assert.match(config, /export const MODE = "real";/);
    assert.match(config, /API_BASE = "https:\/\/api-test\.tikteam\.live\/api\/web\/v1"/);
    assert.match(config, /CHECKOUT_ORIGIN = "https:\/\/api-test\.tikteam\.live"/);
    assert.doesNotMatch(config, /mock/i);
    for (const page of ["account/index.html", "account/recovery/index.html", "en/account/index.html", "en/account/recovery/index.html"])
      assert.match(read(out, page), /connect-src https:\/\/api-test\.tikteam\.live;/, page);
    for (const file of ["mock-server.js", "mock-panel.js", "mock-panel.css"])
      assert.ok(!existsSync(join(out, "assets/js/account", file)), file);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test("unsafe or ambiguous build settings are refused", () => {
  for (const args of [
    ["--mode", "real", "--out", temp()],                                            // no API
    ["--mode", "real", "--api-origin", "http://api.tikteam.live", "--out", temp()],  // not https
    ["--mode", "real", "--api-origin", "https://api.tikteam.live/api/web/v1", "--out", temp()], // path
    ["--mode", "real", "--api-origin", "https://user@api.tikteam.live", "--out", temp()],
    ["--mode", "real", "--api-origin", "https://api.tikteam.live:8443", "--out", temp()],
    ["--mode", "real", "--api-origin", "https://*.tikteam.live", "--out", temp()],
    ["--mode", "mock"],                                                             // demo code into the site itself
    ["--mode", "mock", "--api-origin", "https://api.tikteam.live", "--out", temp()],
    ["--mode", "staging", "--out", temp()],
    ["--mode", "mock", "--out", join(SITE, "not-a-preview-folder")],                // inside the site, outside .preview
    ["--mode", "mock", "--out", SITE],
  ]) {
    const result = run(...args);
    assert.notEqual(result.status, 0, args.join(" "));
  }
});
