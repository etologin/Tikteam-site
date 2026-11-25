(() => {
  'use strict';
  const reel = document.querySelector('.hero-reels');
  if (!reel) return;
  const slides = [...reel.querySelectorAll('.hero-reels__slide')];
  const videos = slides.map(slide => slide.querySelector('video'));
  let active = 0;
  let inView = true;

  function syncPlayback() {
    const video = videos[active];
    if (!inView || document.hidden) {
      video.pause();
      return;
    }
    if (!video.hasAttribute('src')) video.src = video.dataset.src;
    // Navigating away while play is pending cancels the request.
    video.play().catch(() => {});
  }

  function step(direction) {
    const total = slides.length;
    const next = (active + direction + total) % total;
    // Move the offscreen slide around the back before it enters from the opposite edge.
    const incoming = slides[(next + direction + total) % total];
    incoming.setAttribute('data-reposition', '');
    incoming.dataset.slot = String(2 * direction);
    incoming.getBoundingClientRect();
    incoming.removeAttribute('data-reposition');

    videos[active].pause();
    active = next;
    slides.forEach((slide, i) => {
      const distance = (i - active + total) % total;
      const slot = distance === total - 1 ? -1 : distance === 2 ? -2 * direction : distance;
      slide.dataset.slot = String(slot);
      slide.setAttribute('aria-hidden', String(slot !== 0));
    });
    const video = videos[active];
    if (video.readyState && video.currentTime) video.currentTime = 0;
    syncPlayback();
  }

  videos.forEach((video, index) => {
    video.controls = false;
    video.addEventListener('ended', () => { if (index === active) step(1); });
  });
  reel.querySelector('[data-prev]').addEventListener('click', () => step(-1));
  reel.querySelector('[data-next]').addEventListener('click', () => step(1));
  slides.forEach(slide => slide.addEventListener('click', () => {
    const slot = Number(slide.dataset.slot);
    if (Math.abs(slot) === 1) step(slot);
  }));
  reel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  });
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (inView === entry.isIntersecting) return;
      inView = entry.isIntersecting;
      syncPlayback();
    }).observe(reel);
  }
  reel.setAttribute('data-enhanced', '');
  syncPlayback();
})();
