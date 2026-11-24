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
  function enableVideoPreview(card, video) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let hoverPlayback = false;
    const touchPlay = document.createElement('button');
    touchPlay.type = 'button';
    touchPlay.className = 'module__touch-play';
    touchPlay.setAttribute('aria-label', '▶ ' + video.getAttribute('aria-label'));
    const icon = document.createElement('span');
    icon.textContent = '▶';
    icon.setAttribute('aria-hidden', 'true');
    touchPlay.append(icon);
    video.after(touchPlay);
    touchPlay.addEventListener('click', () => video.play().catch(() => {}));
    video.addEventListener('pause', () => { touchPlay.hidden = false; });
    video.addEventListener('play', () => {
      touchPlay.hidden = true;
      for (const other of document.querySelectorAll('.module__video')) {
        if (other !== video && !other.paused) other.pause();
      }
    });
    card.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !video.paused || document.hidden || reduceMotion.matches) return;
      hoverPlayback = true;
      video.play().catch(() => { /* The native play button stays available. */ });
    });
    card.addEventListener('pointerleave', () => {
      if (hoverPlayback && !document.fullscreenElement) video.pause();
      hoverPlayback = false;
    });
    if ('IntersectionObserver' in window) {
      const visibility = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting && !document.fullscreenElement) video.pause();
      });
      visibility.observe(card);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  }
  function attach(entry) {
    const {anchor,button} = entry;
    anchor.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(entry); });
    anchor.addEventListener('pointerleave', () => { if (active === entry && !pinned) hide(); });
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
    if (video) enableVideoPreview(card, video);
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
