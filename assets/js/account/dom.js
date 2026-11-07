// Small DOM helpers. Server data only ever reaches the page through textContent.

import { t } from "./i18n.js";

export const byId = (id) => document.getElementById(id);

/** Creates an element with text content and optional class names. */
export function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.setAttribute('data-no-i18n', ''); // Dynamic copy is translated by t(); account and device data must stay literal.
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function showOnly(ids, visible) {
  for (const id of ids) byId(id).hidden = id !== visible;
}

/** Single status line under the title; announced to screen readers. */
export function notice(text, tone = "ok") {
  const box = byId("notice");
  box.setAttribute('data-no-i18n','');
  if (!text) { box.hidden = true; box.textContent = ""; return; }
  box.textContent = text;
  box.className = "notice notice--" + (tone === "error" ? "error" : "ok");
  box.hidden = false;
}

/** Disables a button (or a form's buttons) while an action runs. Returns the restore function. */
export function busy(target) {
  const buttons = target instanceof HTMLFormElement ? [...target.querySelectorAll("button")] : [target];
  const before = buttons.map((b) => b.disabled);
  buttons.forEach((b) => { b.disabled = true; });
  target.setAttribute?.("aria-busy", "true");
  return () => {
    buttons.forEach((b, i) => { b.disabled = before[i]; });
    target.removeAttribute?.("aria-busy");
  };
}

/** Empties every password field on the page (after each submit and when leaving). */
export function clearPasswords(root = document) {
  for (const input of root.querySelectorAll('input[type="password"], input[data-was-password]')) {
    input.value = "";
    if (input.dataset.wasPassword) { input.type = "password"; delete input.dataset.wasPassword; }
  }
  for (const toggle of root.querySelectorAll("button[data-reveal]")) {
    toggle.setAttribute("aria-pressed", "false");
    toggle.textContent = t("show");
  }
}

/** "Показать" buttons next to password fields. */
export function wireRevealButtons(root = document) {
  for (const toggle of root.querySelectorAll("button[data-reveal]")) {
    toggle.addEventListener("click", () => {
      const input = byId(toggle.dataset.reveal);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      if (showing) delete input.dataset.wasPassword; else input.dataset.wasPassword = "1";
      toggle.setAttribute("aria-pressed", String(!showing));
      toggle.textContent = t(showing ? "show" : "hide");
    });
  }
}

export const isEmail = (value) => value.length >= 3 && value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value);
export const isPasswordLength = (value) => value.length >= 8 && value.length <= 128;
