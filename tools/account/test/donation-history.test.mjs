import { test } from "node:test";
import assert from "node:assert/strict";
import { donationHistory } from "../../../assets/js/account/tikdonate-history.js";

test("donation pages, shared totals and clearing private rows on account change", async () => {
  const elements = new Map();
  function element() {
    return { children: [], append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; } };
  }
  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: element, createDocumentFragment: element
  };
  const path = [];
  let later;
  const history = donationHistory(() => ({ get(url) {
    path.push(url);
    return new Promise(resolve => { later = resolve; });
  } }), false);
  const button = id => elements.get("history-" + id);
  try {
    history.clear();
    history.enable();
    const first = button("open").onclick();
    later({ body: { total: 31, summary: { count: 30, amount: 5100, maximum: 900 },
      rows: [{ sender: "<viewer>", ts: 10000, source: "manual", amount: 100 }] } });
    await first;
    assert.match(button("summary").textContent, /Донатов: 30/);
    assert.match(button("list").children[0].children[0].children[0], /<viewer>/);
    assert.equal(button("next").disabled, false);
    const second = button("next").onclick();
    history.clear();
    later({ body: { total: 33, summary: { count: 33, amount: 55, maximum: 50 }, rows: [] } });
    await second;
    assert.deepEqual(path, ["/tikdonate/history?limit=30&offset=0", "/tikdonate/history?limit=30&offset=30"]);
    assert.equal(elements.get("donation-history").hidden, true);
    assert.equal(button("summary").textContent, "");
    assert.deepEqual(button("list").children, []);
  } finally {
    delete globalThis.document;
  }
});
