// A purely decorative layer. Pointer coordinates stay in memory for the short glow trail.
(() => {
  "use strict";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const contrast = matchMedia("(forced-colors: active)");
  const layer = document.createElement("div");
  layer.className = "ocean-backdrop";
  layer.setAttribute("aria-hidden", "true");
  const bed = document.createElement("canvas");
  const water = document.createElement("canvas");
  const floor = bed.getContext("2d");
  const ctx = water.getContext("2d");
  if (!ctx || !floor) return;
  layer.append(bed, water);
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
  let width=0, height=0, particles=[], trails=[], frame=0, timer=0, last=0, elapsed=0;
  function seabed(h) {
    floor.clearRect(0,0,width,h);
    for (let band=0; band<3; band++) {
      const ridge = x => h*(.42+.19*band+.10*Math.sin(x/175+band*1.7)+.05*Math.cos(x/85+band));
      floor.beginPath(); floor.moveTo(0,h);
      for (let x=0; x<width; x+=4) floor.lineTo(x,ridge(x));
      floor.lineTo(width,ridge(width)); floor.lineTo(width,h); floor.closePath();
      floor.fillStyle=["#112b3c88","#10273add","#0c192cff"][band]; floor.fill();
      if (band===0) continue;
      for (let i=0; i<width/36; i++) {
        const x=(i+.45+.3*Math.sin(i*14+band))*36;
        const y=ridge(x)+2;
        const size=(5+27*(.5+.5*Math.sin(i*37+band))**2)*(h/180);
        for (let j=-1; j<=1; j++) {
          const dx=j*size*.45, top=y-size*(1-.2*Math.abs(j));
          floor.beginPath(); floor.moveTo(x,y);
          floor.quadraticCurveTo(x+dx*.18,y-size*.6,x+dx,top);
          floor.strokeStyle=band===1?"#295766":"#33676a"; floor.lineWidth=1; floor.stroke();
          if (size>17) {
            for (let k=1; k<=3; k++) {
              const t=k/5, sx=x+dx*t*t, sy=y-(y-top)*t, reach=(1-t)*size*.30;
              for (const side of [-1,1]) {
                floor.beginPath(); floor.moveTo(sx,sy);
                floor.quadraticCurveTo(sx+side*reach*.6,sy,sx+side*reach,sy-reach*.8);
                floor.strokeStyle=band===2?"#508a92":"#385d72"; floor.stroke();
                floor.fillStyle=i%3===0?"#92a9ed":"#7bdcce";
                floor.fillRect(sx+side*reach,sy-reach*.8,1.3,1.3);
              }
            }
          }
          floor.beginPath(); floor.arc(x+dx,top,1,0,2*Math.PI);
          floor.fillStyle=band===1?"#62bfb583":"#90c6e295"; floor.fill();
        }
      }
    }
  }
  function sizeCanvas(c, h, scale) {
    c.width=Math.max(1,Math.round(width*scale)); c.height=Math.max(1,Math.round(h*scale));
    c.getContext("2d").setTransform(c.width/width,0,0,c.height/h,0,0);
  }
  function resize() {
    width=Math.max(1,layer.clientWidth); height=Math.max(1,layer.clientHeight);
    const scale=Math.min(devicePixelRatio||1,1.25,Math.sqrt(1900000/(width*height)));
    const h=Math.min(height*.22,185);
    sizeCanvas(water,height,scale); sizeCanvas(bed,h,scale);
    seabed(h);
    const count=Math.min(330,Math.max(80,Math.round(width*height/4800)));
    particles=Array.from({length:count}, () => {
      const depth=Math.random();
      return {x:Math.random()*width,y:(Math.random()**.8)*height,depth,
        phase:Math.random()*2*Math.PI, speed:1.3+depth*3.7, heat:0,
        sprite:sprites[Math.floor(Math.random()*colors.length)*kinds + (depth<.75?0:1+Math.floor(Math.random()*2))]};
    });
    trails=[]; draw(0);
  }
  function draw(dt) {
    ctx.clearRect(0,0,width,height);
    elapsed+=dt;
    for (const t of trails) t.life-=dt;
    trails=trails.filter(t=>t.life>0);
    for (const t of trails) {
      ctx.globalAlpha=.22*t.life;
      ctx.drawImage(sprites[0],t.x-50,t.y-50,100,100);
      ctx.globalAlpha=.85*t.life;
      const spread=14+(1-t.life)*18;
      for (let j=0; j<3; j++) {
        const angle=t.angle+j*2.1;
        ctx.drawImage(sprites[j*kinds],t.x+spread*Math.cos(angle)-5,t.y+spread*Math.sin(angle)-5,10,10);
      }
    }
    for (const p of particles) {
      p.x+=p.speed*dt;
      p.y+=Math.sin(elapsed*.32+p.phase)*dt*p.speed*.5;
      if (p.x>width+12) p.x=-12;
      if (p.y>height+12) p.y=-12;
      if (p.y< -12) p.y=height+12;
      p.heat=Math.max(0,p.heat-dt*.69);
      for (const t of trails) {
        const dx=p.x-t.x, dy=p.y-t.y, d=dx*dx+dy*dy;
        if (d<14400) p.heat=Math.max(p.heat,(1-d/14400)*t.life);
      }
      const pulse=.5+.5*Math.sin(elapsed*(.6+p.depth*.5)+p.phase);
      const span=4+p.depth*p.depth*13+(p.depth>.94?14:0)+12*p.heat;
      ctx.globalAlpha=Math.min(1,.21+.28*p.depth+.17*pulse+.65*p.heat);
      ctx.drawImage(p.sprite,p.x-span/2,p.y-span/2,span,span);
    }
    ctx.globalAlpha=1;
  }
  function excite(event) {
    if (motion.matches || contrast.matches || document.hidden) return;
    const x=event.clientX,y=event.clientY,prev=trails[trails.length-1];
    if (prev && (x-prev.x)**2+(y-prev.y)**2<100) { prev.life=1; return; }
    if (trails.length>=12) trails.shift();
    trails.push({x,y,life:1,angle:Math.random()*2*Math.PI});
  }
  function tick(now) {
    draw(last?Math.min((now-last)/1000,.12):0);
    last=now;
    timer=setTimeout(()=>{frame=requestAnimationFrame(tick);},32);
  }
  function sync() {
    cancelAnimationFrame(frame); clearTimeout(timer); last=0;
    if (document.hidden || contrast.matches) return;
    if (width!==layer.clientWidth || height!==layer.clientHeight) resize();
    if (motion.matches) {
      trails=[]; for (const p of particles) p.heat=0;
      draw(0); return;
    }
    frame=requestAnimationFrame(tick);
  }
  window.addEventListener("pointermove",excite,{passive:true});
  window.addEventListener("pointerdown",excite,{passive:true});
  window.addEventListener("resize",sync,{passive:true});
  document.addEventListener("visibilitychange",sync);
  window.addEventListener("pageshow",sync);
  motion.addEventListener("change",sync);
  contrast.addEventListener("change",sync);
  sync();
})();
