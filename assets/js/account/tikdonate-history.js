export function donationHistory(getClient, en) {
  const byId = id => document.getElementById(id);
  const panel = byId("donation-history"), list = byId("history-list"), summary = byId("history-summary");
  const open = byId("history-open"), prev = byId("history-prev"), next = byId("history-next");
  const nav = byId("history-nav"), refresh = byId("history-refresh");
  const size = 30;
  const locale = en ? "en" : "ru";
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "KZT", maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  let generation = 0, offset = 0, total = 0;
  const clear = () => {
    generation++;
    offset = total = 0;
    panel.hidden = nav.hidden = true;
    open.hidden = open.disabled = false;
    list.replaceChildren();
    summary.textContent = "";
  };
  async function load(start) {
    if (panel.hidden) return;
    const current = ++generation;
    open.disabled = prev.disabled = next.disabled = refresh.disabled = true;
    summary.textContent = en ? "Loading history…" : "Загружаем историю…";
    try {
      const { body } = await getClient().get("/tikdonate/history?limit=" + size + "&offset=" + start);
      if (current !== generation) return;
      if (!Array.isArray(body?.rows) || !body.summary || !Number.isSafeInteger(body.total)) throw new Error();
      total = body.total;
      if (start > 0 && start >= total) return await load(Math.max(0, Math.floor((total - 1) / size) * size));
      offset = start;
      const fragment = document.createDocumentFragment();
      for (const row of body.rows) {
        const li = document.createElement("li"), info = document.createElement("small");
        const name = row.nick || row.sender || (en ? "Viewer" : "Зритель");
        li.append(name + " · " + money.format(row.amount));
        info.textContent = [date.format(new Date(row.ts * 1000)), row.bank || row.source, row.message,
          row.hidden ? (en ? "Hidden" : "Скрыт") : ""].filter(Boolean).join(" · ");
        li.append(info);
        fragment.append(li);
      }
      list.replaceChildren(fragment);
      const { count, amount, maximum } = body.summary;
      summary.textContent = !total ? (en ? "No donations yet." : "Донатов пока нет.") :
        (en ? "Donations: " : "Донатов: ") + count + (en ? " · Total: " : " · Сумма: ") + money.format(amount)
        + (en ? " · Largest: " : " · Максимум: ") + money.format(maximum);
      open.hidden = true;
      nav.hidden = false;
    } catch (error) {
      if (current !== generation) return;
      list.replaceChildren();
      open.hidden = false;
      nav.hidden = true;
      summary.textContent = error.status === 401 ? (en ? "Sign in again." : "Войдите в аккаунт снова.")
        : (en ? "Could not load history. Try again." : "Не удалось загрузить историю. Попробуйте ещё раз.");
    } finally {
      if (current === generation) {
        open.disabled = refresh.disabled = false;
        prev.disabled = offset === 0;
        next.disabled = offset + size >= total;
      }
    }
  }
  open.onclick = refresh.onclick = () => load(0);
  prev.onclick = () => load(Math.max(0, offset - size));
  next.onclick = () => load(offset + size);
  return { clear, enable: () => { panel.hidden = false; } };
}
