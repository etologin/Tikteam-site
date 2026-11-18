// The pointer affects only the glow and draw position of nearby drifting particles.
(() => {
  "use strict";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const contrast = matchMedia("(forced-colors: active)");
  const layer = document.createElement("div");
  layer.className = "ocean-backdrop";
  layer.setAttribute("aria-hidden", "true");
  const water = document.createElement("canvas");
  const ctx = water.getContext("2d");
  if (!ctx) return;
  layer.append(water);
  document.body.prepend(layer);
  const colors = ["76,232,215", "94,193,255", "140,136,249", "135,245,200"];
  const kinds = 3;
  function makeSprite(rgb, kind) {
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const g = c.getContext("2d");
    const glow = g.createRadialGradient(24,24,0,24,24,22);
    glow.addColorStop(0, "rgba("+rgb+",.92)");
    glow.addColorStop(.18, "rgba("+rgb+",.48)");
    glow.addColorStop(.52, "rgba("+rgb+",.12)");
    glow.addColorStop(1, "rgba("+rgb+",0)");
    g.fillStyle = glow;
    g.fillRect(0,0,48,48);
    g.fillStyle = "rgb("+rgb+")";
    g.strokeStyle = "rgba("+rgb+",.8)";
    g.lineWidth = 1.4;
    g.beginPath();
    if (kind === 1) {
      g.ellipse(23,23,5,2.5,-.5,0,2*Math.PI);
      g.fill();
      g.moveTo(25,24); g.quadraticCurveTo(30,24,34,29);
      g.moveTo(22,24); g.quadraticCurveTo(27,30,30,31);
      g.stroke();
    } else if (kind === 2) {
      g.arc(24,24,5,Math.PI,2*Math.PI);
      g.closePath(); g.fill();
      for (let x=21; x<=27; x+=3) {
        g.beginPath(); g.moveTo(x,24); g.quadraticCurveTo(x-3,28,x+1,30); g.stroke();
      }
    } else {
      g.arc(24,24,2.9,0,2*Math.PI); g.fill();
    }
    return c;
  }
  const sprites = colors.flatMap(rgb => Array.from({length:kinds}, (_,i) => makeSprite(rgb,i)));
  const radius = 110;
  const maxShift = 9;
  let width = 0, height = 0, elapsed = 0, last = 0;
  let frame = 0, timer = 0, pointer = null;
  const particles = [];

  function resize() {
    const nextWidth = Math.max(1, layer.clientWidth);
    const nextHeight = Math.max(1, layer.clientHeight);
    for (const p of particles) {
      p.x *= nextWidth / width;
      p.y *= nextHeight / height;
    }
    width = nextWidth;
    height = nextHeight;
    const scale = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1900000 / (width * height)));
    water.width = Math.max(1, Math.round(width * scale));
    water.height = Math.max(1, Math.round(height * scale));
    ctx.setTransform(water.width / width, 0, 0, water.height / height, 0, 0);

    const count = Math.min(380, Math.max(92, Math.round(width * height / 4150)));
    if (particles.length > count) particles.length = count;
    while (particles.length < count) {
      const depth = Math.random();
      const color = Math.floor(Math.random() * colors.length);
      const kind = depth < .75 ? 0 : 1 + Math.floor(Math.random() * 2);
      particles.push({
        x: Math.random() * width, y: (Math.random() ** .8) * height,
        phase: Math.random() * 2 * Math.PI, depth, speed: 1.3 + depth * 3.7,
        heat: 0, offsetX: 0, offsetY: 0, sprite: sprites[color * kinds + kind]
      });
    }
  }

  function draw(dt) {
    ctx.clearRect(0, 0, width, height);
    elapsed += dt;
    const response = 1 - Math.exp(-dt * 8);
    for (const p of particles) {
      p.x += p.speed * dt;
      p.y += Math.sin(elapsed * .32 + p.phase) * dt * p.speed * .5;
      if (p.x > width + 24) p.x = -24;
      if (p.y > height + 24) p.y = -24;
      if (p.y < -24) p.y = height + 24;

      let glow = 0, shiftX = 0, shiftY = 0;
      if (pointer) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius) {
          glow = 1 - distance / radius;
          const shift = glow * maxShift;
          shiftX = shift * (distance > .01 ? dx / distance : Math.cos(p.phase));
          shiftY = shift * (distance > .01 ? dy / distance : Math.sin(p.phase));
        }
      }
      p.heat += (glow - p.heat) * response;
      p.offsetX += (shiftX - p.offsetX) * response;
      p.offsetY += (shiftY - p.offsetY) * response;
      const pulse = .5 + .5 * Math.sin(elapsed * (.6 + p.depth * .5) + p.phase);
      const span = 4 + p.depth * p.depth * 13 + (p.depth > .94 ? 14 : 0) + 9 * p.heat;
      ctx.globalAlpha = Math.min(1, .21 + .28 * p.depth + .17 * pulse + .65 * p.heat);
      ctx.drawImage(p.sprite, p.x + p.offsetX - span / 2, p.y + p.offsetY - span / 2, span, span);
    }
    ctx.globalAlpha = 1;
  }

  function follow(event) {
    if (event.isPrimary === false || motion.matches || contrast.matches || document.hidden) return;
    pointer = { x: event.clientX, y: event.clientY };
  }
  function clearPointer() { pointer = null; }
  function tick(now) {
    draw(last ? Math.min((now - last) / 1000, .12) : 0);
    last = now;
    timer = setTimeout(() => { frame = requestAnimationFrame(tick); }, 32);
  }
  function sync() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    last = 0;
    if (document.hidden || contrast.matches) { clearPointer(); return; }
    if (width !== layer.clientWidth || height !== layer.clientHeight) resize();
    if (motion.matches) {
      clearPointer();
      for (const p of particles) p.heat = p.offsetX = p.offsetY = 0;
      draw(0);
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  window.addEventListener("pointermove", follow, { passive: true });
  window.addEventListener("pointerdown", follow, { passive: true });
  window.addEventListener("pointerup", event => {
    if (event.isPrimary && event.pointerType !== "mouse") clearPointer();
  }, { passive: true });
  window.addEventListener("pointercancel", clearPointer, { passive: true });
  window.addEventListener("pointerout", event => {
    if (!event.relatedTarget) clearPointer();
  }, { passive: true });
  window.addEventListener("blur", clearPointer);
  window.addEventListener("resize", sync, { passive: true });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pageshow", sync);
  motion.addEventListener("change", sync);
  contrast.addEventListener("change", sync);
  sync();
})();
