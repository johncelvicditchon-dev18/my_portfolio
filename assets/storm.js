/* ============================================================
   PAGE-WIDE STORM
   A fixed 2D canvas behind the content: black lightning with
   crimson edges, embers and pressure flashes that keep the
   whole site inside the energy field — including while scrolling.
   ============================================================ */
(() => {
  const canvas = document.querySelector("[data-storm]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(hover: none), (pointer: coarse)");
  const compact = window.matchMedia("(max-width: 900px)");

  let W = 0;
  let H = 0;
  let bolts = [];
  let embers = [];
  let flash = 0;
  let flashX = 0;
  let flashY = 0;
  let scrollKick = 0;
  let raf = null;
  let last = 0;
  let spawnAcc = 0;
  let time = 0;
  let running = true;

  const rand = (a, b) => a + Math.random() * (b - a);

  /* soft ember sprite */
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const sctx = sprite.getContext("2d");
  const sg = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  sg.addColorStop(0, "rgba(255, 150, 170, 0.95)");
  sg.addColorStop(0.25, "rgba(255, 40, 80, 0.7)");
  sg.addColorStop(0.6, "rgba(176, 0, 32, 0.28)");
  sg.addColorStop(1, "rgba(128, 0, 32, 0)");
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 32, 32);

  const maxBolts = () => (coarse.matches || compact.matches ? 5 : 8);

  function makeEmbers() {
    const count = coarse.matches || compact.matches ? 26 : 48;
    embers = Array.from({ length: count }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      s: rand(0.5, 2.1),
      speed: rand(7, 26),
      drift: rand(-10, 10),
      alpha: rand(0.18, 0.62),
      phase: rand(0, Math.PI * 2)
    }));
  }

  function makeBranch(pts, index, angle, len) {
    const start = pts[index];
    let x = start[0];
    let y = start[1];
    let a = angle + rand(-0.9, 0.9);
    const segments = Math.max(3, Math.round(len / 34));
    const step = len / segments;
    const branch = [[x, y]];

    for (let i = 0; i < segments; i += 1) {
      a += rand(-0.55, 0.55);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      branch.push([x, y]);
    }
    return branch;
  }

  function makeBolt(big = false) {
    if (bolts.length >= maxBolts()) return;

    const side = Math.random();
    const upward = side > 0.82;
    let x;
    let y;
    let angle;

    if (upward) {
      // sharp upward discharge, like the aura's rising spikes
      x = rand(W * 0.12, W * 0.88);
      y = H * 1.02;
      angle = -Math.PI * 0.5 + rand(-0.72, 0.72);
    } else {
      if (side < 0.34) {
        x = rand(W * 0.82, W * 1.04);
        y = rand(H * 0.04, H * 0.95);
      } else if (side < 0.58) {
        x = rand(W * 0.1, W * 0.95);
        y = rand(-H * 0.02, H * 0.12);
      } else if (side < 0.8) {
        x = rand(W * 0.08, W * 0.95);
        y = rand(H * 0.88, H * 1.04);
      } else {
        x = rand(-W * 0.02, W * 0.1);
        y = rand(H * 0.18, H * 0.95);
      }

      const midX = W * rand(0.3, 0.78);
      const midY = H * rand(0.18, 0.78);
      angle = Math.atan2(midY - y, midX - x) + rand(-0.45, 0.45);
    }

    const length = Math.min(W, H) * (big ? rand(0.55, 0.95) : rand(0.22, 0.55));
    const segments = big ? 12 : Math.round(rand(7, 10));
    const step = length / segments;
    const points = [[x, y]];

    for (let i = 0; i < segments; i += 1) {
      angle += rand(-0.52, 0.52);
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      points.push([x, y]);
    }

    const branches = [];
    if (Math.random() < 0.75) {
      const index = Math.round(rand(segments * 0.35, segments * 0.8));
      branches.push(makeBranch(points, index, angle, length * rand(0.18, 0.38)));
    }

    const mid = points[Math.round(points.length * 0.55)];
    const overText = mid[0] < W * 0.5 && mid[1] > H * 0.24 && mid[1] < H * 0.76;
    const alpha = (big ? 1 : rand(0.5, 0.9)) * (overText ? 0.4 : 1);

    bolts.push({
      points,
      branches,
      width: big ? rand(2.2, 3.2) : rand(1.1, 2.1),
      alpha,
      seed: rand(0, Math.PI * 2),
      life: 0,
      ttl: big ? rand(0.42, 0.75) : rand(0.2, 0.5),
      big
    });

    if (big) {
      flash = Math.min(1, flash + 0.8);
      flashX = points[0][0];
      flashY = points[0][1];
    }
  }

  function path(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
  }

  function stroke(points, width, color, alpha, blend = "lighter") {
    if (alpha <= 0.003 || width <= 0.05) return;
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    path(points);
    ctx.stroke();
  }

  function drawBolt(bolt) {
    const progress = bolt.life / bolt.ttl;
    const envelope = Math.min(1, progress * 9) * (1 - Math.max(0, (progress - 0.55) / 0.45));
    const flicker = 0.78 + 0.22 * Math.sin(bolt.life * 70 + bolt.seed);
    const a = bolt.alpha * envelope * flicker;
    if (a <= 0.01) return;

    const w = bolt.width;

    // crimson pressure bloom
    stroke(bolt.points, w * 16, "#ff1744", a * 0.045);
    // glowing rim
    stroke(bolt.points, w * 4.2, "#ff1744", a * 0.5);
    stroke(bolt.points, w * 2.0, "#ff4d6a", a * 0.35);

    for (const branch of bolt.branches) {
      stroke(branch, w * 12, "#ff1744", a * 0.03);
      stroke(branch, w * 3.4, "#ff1744", a * 0.32);
    }

    // black core
    stroke(bolt.points, w, "rgba(4, 0, 2, 1)", a * 0.97, "source-over");
    for (const branch of bolt.branches) {
      stroke(branch, w * 0.75, "rgba(4, 0, 2, 1)", a * 0.85, "source-over");
    }
  }

  function draw(dt) {
    if (!W || !H) return;

    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // pressure flash first, under the bolts
    if (flash > 0.01) {
      const radius = Math.min(W, H) * 0.82;
      const g = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, radius);
      g.addColorStop(0, `rgba(255, 23, 68, ${0.055 * flash})`);
      g.addColorStop(0.4, `rgba(176, 0, 32, ${0.024 * flash})`);
      g.addColorStop(0.7, `rgba(128, 0, 32, ${0.012 * flash})`);
      g.addColorStop(1, "rgba(128, 0, 32, 0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - dt * 2.4);
    }

    // embers
    ctx.globalCompositeOperation = "lighter";
    for (const p of embers) {
      p.y -= p.speed * dt;
      p.x += Math.sin(time * 0.7 + p.phase) * p.drift * dt;
      if (p.y < -20) {
        p.y = H + rand(4, 30);
        p.x = rand(0, W);
      }
      const size = p.s * 9;
      ctx.globalAlpha = p.alpha * (0.55 + 0.45 * Math.sin(time * 1.3 + p.phase));
      ctx.drawImage(sprite, p.x - size * 0.5, p.y - size * 0.5, size, size);
    }

    // lightning
    for (let i = bolts.length - 1; i >= 0; i -= 1) {
      const bolt = bolts[i];
      bolt.life += dt;
      if (bolt.life >= bolt.ttl) {
        bolts.splice(i, 1);
        continue;
      }
      drawBolt(bolt);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running || document.hidden) {
      last = now;
      return;
    }
    const limit = 1000 / 30;
    const elapsed = now - last;
    if (elapsed < limit - 0.5) return;

    last = now - (elapsed % limit);
    const dt = Math.min(0.05, elapsed / 1000);
    time += dt;

    spawnAcc += dt * (coarse.matches || compact.matches ? 3.2 : 5.2) * (1 + scrollKick);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      makeBolt(Math.random() < 0.13);
    }
    scrollKick = Math.max(0, scrollKick - dt * 2.4);

    draw(dt);
  }

  function start() {
    if (raf !== null || reduceMotion.matches) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function reset() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    W = rect.width;
    H = rect.height;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    const rawW = rect.width * dpr;
    const rawH = rect.height * dpr;
    const budget = coarse.matches || compact.matches ? 550000 : 1000000;
    const scale = Math.min(1, Math.sqrt(budget / (rawW * rawH)));

    canvas.width = Math.max(2, Math.round(rawW * scale));
    canvas.height = Math.max(2, Math.round(rawH * scale));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

    bolts = [];
    makeEmbers();
    spawnAcc = 0;

    // seed the frame so the field is alive immediately
    makeBolt(true);
    makeBolt(true);
    makeBolt(false);
    for (const bolt of bolts) bolt.life = rand(0.02, 0.14);

    if (reduceMotion.matches) {
      time = 4;
      draw(0.016);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  reset();
  if (reduceMotion.matches) {
    draw(0.016);
  } else {
    // Start after the entrance paints; the fixed canvas is behind
    // the content, so a short settle is invisible to the visitor.
    setTimeout(start, 850);
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      stop();
      reset();
      if (!reduceMotion.matches) start();
      else draw(0.016);
    }, 160);
  }, { passive: true });

  let lastScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    const distance = Math.abs(window.scrollY - lastScrollY);
    lastScrollY = window.scrollY;
    if (distance < 1) return;
    scrollKick = Math.min(2.2, scrollKick + 1.2);
    if (bolts.length < maxBolts()) {
      makeBolt(Math.random() < 0.28);
      if (bolts.length < maxBolts()) makeBolt(false);
    }
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!reduceMotion.matches) start();
  });

  reduceMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      stop();
      time = 4;
      bolts = [];
      reset();
    } else {
      start();
    }
  });
})();
