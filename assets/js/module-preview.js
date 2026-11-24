(() => {
  const cards = [...document.querySelectorAll('#modules .module')];
  if (!cards.length) return;
  const tip = document.createElement('div');
  tip.className = 'module__tip';
  tip.setAttribute('aria-hidden', 'true'); // The same visible paragraph describes the button.
  tip.hidden = true;
  const title = document.createElement('strong');
  const body = document.createElement('p');
  tip.append(title, body);
  document.body.append(tip);
  let active = null;
  let pinned = false;

  function position() {
    if (!active) return;
    const anchor = active.anchor.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight, gap = 8;
    const right = document.documentElement.clientWidth - w - gap;
    let x = anchor.right + gap, y = anchor.top;
    if (x > right) {
      x = anchor.left - w - gap;
      if (x < gap) {
        x = Math.max(gap, Math.min(anchor.left, right));
        const button = active.button.getBoundingClientRect();
        y = button.bottom + gap + h <= window.innerHeight ? button.bottom + gap : button.top - h - gap;
      }
    }
    tip.style.left = x + 'px';
    tip.style.top = Math.max(gap, Math.min(y, window.innerHeight - h - gap)) + 'px';
  }
  function show(entry) {
    if (active !== entry) pinned = false;
    active = entry;
    title.textContent = entry.name.textContent;
    body.textContent = entry.description.textContent;
    tip.hidden = false;
    position();
  }
  function hide() { active = null; pinned = false; tip.hidden = true; }
  // The same player handles the card's responsive sources in preview and fullscreen.
  const preview = document.createElement('div');
  preview.id = 'module-demo-preview';
  preview.className = 'demo-float';
  preview.hidden = true;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Close' : 'Закрыть');
  preview.append(close);
  document.body.append(preview);
  let watching = null;
  let leaveTimer;
  let manual = false;

  function dismissPreview(restoreFocus = false) {
    clearTimeout(leaveTimer);
    if (!watching) return;
    const { toggle, video, card } = watching;
    watching = null;
    manual = false;
    if (document.fullscreenElement === preview) document.exitFullscreen().catch(() => {});
    preview.hidden = true;
    card.classList.remove('module--watching');
    toggle.setAttribute('aria-expanded', 'false');
    video.pause();
    video.remove();
    // Abort pending requests and reset playback. preload="none" keeps the idle card light.
    video.load();
    if (restoreFocus) toggle.focus({preventScroll: true});
  }

  function placePreview() {
    if (!watching || document.fullscreenElement === preview) return;
    const r = watching.toggle.getBoundingClientRect();
    const margin = 10, gap = 10;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const aspect = watching.video.width / watching.video.height;
    const width = Math.min(r.width * 2, vw - 2 * margin, (vh - 2 * margin) * aspect);
    const height = width / aspect;
    let x = r.left + (r.width - width) / 2, y = r.top + (r.height - height) / 2;
    if (r.right + gap + width <= vw - margin) x = r.right + gap;
    else if (r.left - gap - width >= margin) x = r.left - gap - width;
    else if (r.bottom + gap + height <= vh - margin) y = r.bottom + gap;
    else if (r.top - gap - height >= margin) y = r.top - gap - height;
    preview.style.width = width + 'px';
    preview.style.height = height + 'px';
    preview.style.left = Math.max(margin, Math.min(x, vw - margin - width)) + 'px';
    preview.style.top = Math.max(margin, Math.min(y, vh - margin - height)) + 'px';
  }

  function scheduleLeave(event) {
    if (event.pointerType !== 'mouse' || manual || document.fullscreenElement === preview) return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(dismissPreview, 180);
  }

  function openPreview(entry, explicit) {
    clearTimeout(leaveTimer);
    if (watching !== entry) {
      dismissPreview();
      hide();
      watching = entry;
      entry.card.classList.add('module--watching');
      entry.toggle.setAttribute('aria-expanded', 'true');
      preview.prepend(entry.video);
      preview.hidden = false;
      placePreview();
      entry.video.play().catch(error => {
        // A new hover can cancel an earlier play() on the same video.
        if (watching === entry && error.name !== 'AbortError') dismissPreview();
      });
    }
    manual ||= explicit;
    close.hidden = !manual;
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function enableVideoPreview(video) {
    const card = video.closest('.module');
    const toggle = document.createElement('button');
    toggle.className = 'module__preview-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '▶ ' + video.getAttribute('aria-label'));
    toggle.setAttribute('aria-controls', preview.id);
    toggle.setAttribute('aria-expanded', 'false');
    const cover = new Image();
    cover.alt = '';
    cover.src = video.poster;
    toggle.append(cover);
    video.replaceWith(toggle);
    const entry = {card, toggle, video};
    toggle.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && !document.hidden && !reducedMotion.matches) openPreview(entry, false);
    });
    toggle.addEventListener('pointerleave', scheduleLeave);
    toggle.addEventListener('click', event => {
      if (watching === entry && manual) dismissPreview();
      else {
        openPreview(entry, true);
        if (event.detail === 0) close.focus({preventScroll: true});
      }
    });
    toggle.addEventListener('dblclick', () => {
      openPreview(entry, true);
      toggleFullscreen();
    });
    video.addEventListener('error', () => { if (video.error && watching === entry) dismissPreview(); });
  }

  function toggleFullscreen() {
    if (!watching) return;
    if (document.fullscreenElement === preview) document.exitFullscreen().catch(() => {});
    else if (preview.requestFullscreen) preview.requestFullscreen().catch(() => {});
  }
  preview.addEventListener('dblclick', event => { if (event.target !== close) toggleFullscreen(); });
  preview.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
  preview.addEventListener('pointerleave', scheduleLeave);
  close.addEventListener('click', () => dismissPreview(true));
  document.addEventListener('fullscreenchange', placePreview);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && watching) dismissPreview(preview.contains(document.activeElement));
  });
  function dismissOutside(event) {
    if (watching && !watching.toggle.contains(event.target) && !preview.contains(event.target)) dismissPreview();
  }
  document.addEventListener('pointerdown', dismissOutside);
  document.addEventListener('focusin', dismissOutside);
  document.addEventListener('visibilitychange', () => { if (document.hidden) dismissPreview(); });
  window.addEventListener('resize', placePreview);
  window.addEventListener('scroll', () => {
    if (!watching || document.fullscreenElement === preview) return;
    // Mobile browsers may scroll the focused card just after a tap.
    const anchor = watching.toggle.getBoundingClientRect();
    if (manual && anchor.bottom > 0 && anchor.top < window.innerHeight) placePreview();
    else dismissPreview();
  }, {passive: true});
  function attach(entry) {
    const {button} = entry;
    button.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(entry); });
    button.addEventListener('pointerleave', () => { if (active === entry && !pinned) hide(); });
    button.addEventListener('focus', () => show(entry));
    button.addEventListener('blur', () => { if (active === entry) hide(); });
    new MutationObserver(() => { if (active === entry) show(entry); })
      .observe(entry.anchor.closest('.module') || entry.description.parentElement, {subtree:true, characterData:true, childList:true});
  }
  cards.forEach((card,index) => {
    const name = card.querySelector('h3'), description = card.querySelector('p');
    if (!name || !description) return;
    name.id ||= 'module-name-' + index;
    description.id ||= 'module-description-' + index;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'module__info';
    button.textContent = '•••';
    button.setAttribute('aria-labelledby', name.id);
    button.setAttribute('aria-describedby', description.id);
    name.parentElement.append(button);
    const entry = {anchor:card,button,name,description};
    attach(entry);
    const video = card.querySelector('.module__video');
    if (video) enableVideoPreview(video);
    button.addEventListener('click', () => {
      if (pinned && active === entry) hide();
      else { show(entry); pinned = true; }
    });
    const link = [...document.querySelectorAll('.films li a')].find(a => a.querySelector('span')?.textContent === name.textContent);
    if (link) attach({anchor:link,button:link,name,description});
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('pointerdown', e => { if (active && !active.anchor.contains(e.target)) hide(); });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', hide, {passive:true});
})();
