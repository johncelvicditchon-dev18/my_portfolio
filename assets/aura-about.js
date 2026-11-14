/* ============================================================
   ABOUT PORTRAIT FIELD — cinematic crimson aura
   ------------------------------------------------------------
   A lightweight 2D canvas that wraps the "Who I am" cut-out:
     • layered burgundy / crimson flame tongues and sharp spikes
     • expanding pressure rings
     • black lightning with a crimson edge
     • rising embers and fast vertical sparks
   The canvas sits behind the portrait, so the figure is never
   recoloured or covered — only the surrounding air burns.
   ============================================================ */
(() => {
  const canvas = document.querySelector("[data-about-aura]");
  if (!canvas) return;
  const wrap = canvas.closest(".about__aura");
  const frameEl = canvas.closest(".about__frame");
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx || !wrap || !frameEl) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(hover: none), (pointer: coarse)");
  const compact = window.matchMedia("(max-width: 900px)");

  const rand = (a, b) => a + Math.random() * (b - a);

  let W = 0;
  let H = 0;
  let time = 0;
  let last = 0;
  let raf = null;
  let visible = false;
  let running = false;

  let tongues = [];
  let spikes = [];
  let embers = [];
  let streaks = [];
  let bolts = [];
  let ringAt = -10;
  let nextStrike = 1.1;

  /* Soft ember sprite shared by every particle. */
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 40;
  const sctx = sprite.getContext("2d");
  const sg = sctx.createRadialGradient(20, 20, 0, 20, 20, 20);
  sg.addColorStop(0, "rgba(255, 168, 184, 0.95)");
  sg.addColorStop(0.22, "rgba(255, 40, 80, 0.75)");
  sg.addColorStop(0.56, "rgba(176, 0, 32, 0.3)");
  sg.addColorStop(1, "rgba(128, 0, 32, 0)");
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 40, 40);

  function buildScene() {
    const count = coarse.matches || compact.matches ? 9 : 15;
    tongues = Array.from({ length: count }, (_, i) => {
      const depth = i / Math.max(count - 1, 1);
      const side = (i % 2 === 0 ? -1 : 1) * (0.1 + Math.random() * 0.4);
      return {
        x: 0.5 + side * 0.7,
        w: rand(0.018, 0.055),
        h: rand(0.32, 0.62) + (1 - Math.abs(side)) * 0.16,
        phase: rand(0, Math.PI * 2),
        sway: rand(0.012, 0.048),
        speed: rand(0.55, 1.1),
        depth,
        layer: i % 3
      };
    });

    spikes = Array.from({ length: coarse.matches || compact.matches ? 5 : 8 }, (_, i) => ({
      x: rand(0.16, 0.84),
      w: rand(1.2, 3.6),
      h: rand(0.22, 0.5) + (1 - Math.abs(i / 8 - 0.5) * 2) * 0.1,
      phase: rand(0, Math.PI * 2),
      speed: rand(0.7, 1.4),
      sway: rand(0.008, 0.03)
    }));

    const eCount = coarse.matches || compact.matches ? 22 : 40;
    embers = Array.from({ length: eCount }, () => ({
      x: rand(0, 1),
      y: rand(0, 1),
      s: rand(0.6, 2.2),
      speed: rand(0.035, 0.12),
      drift: rand(-0.03, 0.03),
      alpha: rand(0.18, 0.7),
      phase: rand(0, Math.PI * 2)
    }));

    streaks = Array.from({ length: coarse.matches || compact.matches ? 6 : 12 }, () => ({
      x: rand(0.12, 0.88),
      y: rand(0, 1),
      len: rand(0.02, 0.08),
      speed: rand(0.15, 0.38),
      alpha: rand(0.18, 0.5),
      phase: rand(0, Math.PI * 2)
    }));

    bolts = [];
    ringAt = -10;
    nextStrike = 0.6;
  }

  /* ── Flame shapes ─────────────────────────────────────────── */
  function tonguePath(cx, baseY, h, w, t, item) {
    const sway = Math.sin(t * item.speed + item.phase) * item.sway;
    const wobble = Math.sin(t * (item.speed * 2.3) + item.phase * 1.7) * item.sway * 0.45;
    const tipX = cx + sway + wobble;
    const tipY = baseY - h * (0.94 + 0.06 * Math.sin(t * item.speed * 1.6 + item.phase));
    const waistY = baseY - h * 0.55;

    ctx.beginPath();
    ctx.moveTo(cx - w, baseY);
    ctx.bezierCurveTo(cx - w * 0.82 + sway * 0.4, waistY + h * 0.12, tipX - w * 0.12, tipY + h * 0.22, tipX, tipY);
    ctx.bezierCurveTo(tipX + w * 0.12, tipY + h * 0.22, cx + w * 0.82 + sway * 0.4, waistY + h * 0.12, cx + w, baseY);
    ctx.closePath();
    return { tipX, tipY };
  }

  function drawFlames(t) {
    const baseY = H * 0.88;

    for (const item of tongues) {
      const cx = item.x * W;
      const h = item.h * H;
      const w = item.w * W;
      const far = item.layer === 0;
      const mid = item.layer === 1;

      const { tipX, tipY } = tonguePath(cx, baseY, h, w, t, item);
      const grad = ctx.createLinearGradient(0, baseY, 0, tipY);
      grad.addColorStop(0, "rgba(61, 0, 21, 0)");
      grad.addColorStop(0.12, `rgba(128, 0, 32, ${far ? 0.14 : 0.2})`);
      grad.addColorStop(0.54, `rgba(176, 0, 32, ${far ? 0.18 : 0.3})`);
      grad.addColorStop(0.86, `rgba(255, 23, 68, ${far ? 0.16 : 0.34})`);
      grad.addColorStop(1, "rgba(255, 23, 68, 0)");
      ctx.fillStyle = grad;

      if (!coarse.matches) {
        ctx.filter = far ? "blur(12px)" : mid ? "blur(4px)" : "blur(0.4px)";
      }
      ctx.globalAlpha = far ? 0.42 : mid ? 0.6 : 0.78;
      ctx.fill();
      if (!coarse.matches) ctx.filter = "none";
      ctx.globalAlpha = 1;

      // Hot, knife-thin core so each tongue ends in a sharp point.
      if (!far) {
        const core = ctx.createLinearGradient(0, baseY - h * 0.1, 0, tipY);
        core.addColorStop(0, "rgba(255, 23, 68, 0)");
        core.addColorStop(0.55, "rgba(255, 60, 94, 0.3)");
        core.addColorStop(0.92, "rgba(255, 128, 150, 0.62)");
        core.addColorStop(1, "rgba(255, 176, 190, 0)");
        ctx.fillStyle = core;
        ctx.shadowColor = "rgba(255, 23, 68, 0.85)";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.13, baseY - h * 0.06);
        ctx.quadraticCurveTo(cx, baseY - h * 0.62, tipX, tipY);
        ctx.quadraticCurveTo(cx + w * 0.16, baseY - h * 0.54, cx + w * 0.13, baseY - h * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Tall narrow energy spikes that break the outline of the flame mass.
    ctx.lineCap = "round";
    for (const spike of spikes) {
      const x = spike.x * W;
      const tipX = x + Math.sin(t * spike.speed + spike.phase) * spike.sway * W;
      const topY = H * (0.88 - spike.h - 0.02 * Math.sin(t * spike.speed * 1.3 + spike.phase));
      const g = ctx.createLinearGradient(0, H * 0.86, 0, topY);
      g.addColorStop(0, "rgba(176, 0, 32, 0)");
      g.addColorStop(0.55, "rgba(255, 23, 68, 0.34)");
      g.addColorStop(0.9, "rgba(255, 90, 118, 0.55)");
      g.addColorStop(1, "rgba(255, 23, 68, 0)");
      ctx.strokeStyle = g;
      ctx.shadowColor = "rgba(255, 23, 68, 0.75)";
      ctx.shadowBlur = 12;
      ctx.lineWidth = spike.w;
      ctx.beginPath();
      ctx.moveTo(x, H * 0.88);
      ctx.quadraticCurveTo(x + (tipX - x) * 0.25, H * 0.6, tipX, topY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  /* ── Flame crown above the head ───────────────────────────── */
  function drawCrown(t) {
    const baseY = H * 0.62;
    const count = coarse.matches || compact.matches ? 5 : 7;

    for (let i = 0; i < count; i += 1) {
      const k = i / Math.max(count - 1, 1);
      const center = 0.5 + (k - 0.5) * 0.62;
      const x = W * (center + Math.sin(t * 0.7 + i * 1.3) * 0.012);
      const top = H * (0.03 + Math.abs(k - 0.5) * 0.22 + 0.035 * Math.sin(t * 1.25 + i * 1.8));
      const sway = Math.sin(t * 0.9 + i * 1.6) * W * 0.018;
      const w = W * (0.011 + 0.007 * Math.abs(0.5 - k) * 2);

      const grad = ctx.createLinearGradient(0, baseY, 0, top);
      grad.addColorStop(0, "rgba(176, 0, 32, 0)");
      grad.addColorStop(0.35, "rgba(176, 0, 32, 0.2)");
      grad.addColorStop(0.72, "rgba(255, 23, 68, 0.5)");
      grad.addColorStop(0.93, "rgba(255, 118, 140, 0.62)");
      grad.addColorStop(1, "rgba(255, 23, 68, 0)");
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.82;
      ctx.shadowColor = "rgba(255, 23, 68, 0.85)";
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.moveTo(x - w, baseY);
      ctx.bezierCurveTo(x - w * 0.9, baseY - (baseY - top) * 0.46, x + sway - w * 0.14, top + (baseY - top) * 0.2, x + sway, top);
      ctx.bezierCurveTo(x + sway + w * 0.14, top + (baseY - top) * 0.2, x + w * 0.9, baseY - (baseY - top) * 0.46, x + w, baseY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /* ── Shockwave ring ───────────────────────────────────────── */
  function drawRing(t) {
    const age = t - ringAt;
    if (age < 0 || age > 3.4) return;
    const k = age / 3.4;
    const rx = W * (0.16 + k * 0.5);
    const ry = rx * 0.24;
    ctx.globalAlpha = (1 - k) * 0.32;
    ctx.strokeStyle = "#ff1744";
    ctx.lineWidth = Math.max(1, 2.4 * (1 - k));
    ctx.shadowColor = "rgba(255, 23, 68, 0.9)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.84, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /* ── Lightning ────────────────────────────────────────────── */
  function makeBolt(big) {
    const side = Math.random() < 0.5 ? -1 : 1;
    let x = W * (0.5 + side * rand(0.16, 0.44));
    let y = H * rand(0.24, 0.68);
    const segments = big ? 9 : 6;
    const length = H * (big ? rand(0.3, 0.5) : rand(0.12, 0.26));
    const startAngle = rand(-Math.PI, Math.PI);
    let angle = startAngle;
    const step = length / segments;
    const points = [[x, y]];

    for (let i = 0; i < segments; i += 1) {
      angle += rand(-0.7, 0.7);
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      points.push([x, y]);
    }

    bolts.push({
      points,
      width: big ? rand(1.9, 2.8) : rand(0.9, 1.7),
      alpha: big ? 1 : rand(0.45, 0.85),
      seed: rand(0, Math.PI * 2),
      life: 0,
      ttl: big ? rand(0.34, 0.6) : 0.24
    });
  }

  function stroke(points, width, color, alpha, mode = "lighter") {
    if (alpha <= 0.005 || width <= 0.05) return;
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }

  function drawBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i -= 1) {
      const bolt = bolts[i];
      bolt.life += dt;
      if (bolt.life >= bolt.ttl) {
        bolts.splice(i, 1);
        continue;
      }
      const p = bolt.life / bolt.ttl;
      const env = Math.min(1, p * 10) * (1 - Math.max(0, (p - 0.5) / 0.5));
      const a = bolt.alpha * env * (0.8 + 0.2 * Math.sin(bolt.life * 70 + bolt.seed));

      stroke(bolt.points, bolt.width * 14, "#ff1744", a * 0.05);
      stroke(bolt.points, bolt.width * 4.4, "#ff1744", a * 0.48);
      stroke(bolt.points, bolt.width * 2.0, "#ff5a7a", a * 0.26);
      stroke(bolt.points, bolt.width, "rgba(4, 0, 2, 1)", a * 0.95, "source-over");
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ── Particles ────────────────────────────────────────────── */
  function drawParticles(dt, t) {
    ctx.globalCompositeOperation = "lighter";

    for (const p of embers) {
      p.y -= p.speed * dt;
      p.x += Math.sin(t * 0.6 + p.phase) * p.drift * dt;
      if (p.y < -0.05) {
        p.y = 1.04;
        p.x = rand(0, 1);
      }
      if (p.x < -0.04) p.x = 1.02;
      if (p.x > 1.04) p.x = -0.02;

      const size = p.s * Math.min(W, H) * 0.034;
      ctx.globalAlpha = p.alpha * (0.55 + 0.45 * Math.sin(t * 1.7 + p.phase));
      ctx.drawImage(sprite, p.x * W - size * 0.5, p.y * H - size * 0.5, size, size);
    }

    for (const s of streaks) {
      s.y -= s.speed * dt;
      if (s.y < -0.06) {
        s.y = 1.05;
        s.x = rand(0.1, 0.9);
      }
      const g = ctx.createLinearGradient(0, s.y * H, 0, (s.y + s.len) * H);
      g.addColorStop(0, "rgba(255, 150, 168, 0)");
      g.addColorStop(0.55, `rgba(255, 80, 110, ${s.alpha * 0.8})`);
      g.addColorStop(1, "rgba(255, 23, 68, 0)");
      ctx.strokeStyle = g;
      ctx.globalAlpha = s.alpha * (0.5 + 0.5 * Math.sin(t * 2.2 + s.phase));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x * W, s.y * H);
      ctx.lineTo(s.x * W + Math.sin(t + s.phase) * 3, (s.y + s.len) * H);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ── Frame ────────────────────────────────────────────────── */
  function draw(dt) {
    if (!W || !H) return;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const t = time;

    // volumetric background bloom
    ctx.globalCompositeOperation = "lighter";
    const bloom = ctx.createRadialGradient(W * 0.5, H * 0.56, 0, W * 0.5, H * 0.56, W * 0.58);
    bloom.addColorStop(0, "rgba(255, 23, 68, 0.16)");
    bloom.addColorStop(0.42, "rgba(176, 0, 32, 0.1)");
    bloom.addColorStop(0.74, "rgba(61, 0, 21, 0.08)");
    bloom.addColorStop(1, "rgba(61, 0, 21, 0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);

    // ground pressure glow
    const ground = ctx.createRadialGradient(W * 0.5, H * 0.9, 0, W * 0.5, H * 0.9, W * 0.46);
    ground.addColorStop(0, "rgba(255, 23, 68, 0.22)");
    ground.addColorStop(0.5, "rgba(176, 0, 32, 0.12)");
    ground.addColorStop(1, "rgba(61, 0, 21, 0)");
    ctx.fillStyle = ground;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    ctx.globalCompositeOperation = "lighter";
    drawFlames(t);
    drawCrown(t);
    drawRing(t);

    ctx.globalCompositeOperation = "lighter";
    drawParticles(dt, t);
    drawBolts(dt);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
  }

  function resize() {
    const w = wrap.offsetWidth;
    const h = wrap.offsetHeight;
    if (!w || !h) return;
    W = w;
    H = h;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.3);
    const rawW = w * dpr;
    const rawH = h * dpr;
    const budget = coarse.matches || compact.matches ? 250000 : 500000;
    const scale = Math.min(1, Math.sqrt(budget / (rawW * rawH)));
    canvas.width = Math.max(2, Math.round(rawW * scale));
    canvas.height = Math.max(2, Math.round(rawH * scale));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

    buildScene();
    canvas.classList.add("is-live");
    if (reduceMotion.matches) {
      time = 6.4;
      draw(0.016);
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) {
      last = now;
      return;
    }
    const elapsed = now - last;
    const interval = coarse.matches || compact.matches ? 1000 / 30 : 1000 / 36;
    if (elapsed < interval - 0.5) return;

    last = now - (elapsed % interval);
    const dt = Math.min(0.05, elapsed / 1000);
    time += dt;

    nextStrike -= dt;
    if (nextStrike <= 0) {
      makeBolt(Math.random() < 0.28);
      if (Math.random() < 0.35) makeBolt(false);
      nextStrike = rand(1.2, 3.6);
    }

    if (time - ringAt > 3.6) ringAt = time;

    draw(dt);
  }

  function start() {
    if (raf !== null || reduceMotion.matches) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }

  resize();

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      stop();
      resize();
      if (visible && !reduceMotion.matches) start();
    }, 160);
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      const entry = entries[0];
      const next = entry.intersectionRatio > 0.16;
      if (next === visible) return;
      visible = next;
      if (visible && !reduceMotion.matches) start();
      else stop();
    }, { threshold: [0, 0.16, 0.3, 0.6, 1] }).observe(frameEl);
  } else {
    visible = true;
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  reduceMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      stop();
      time = 6.4;
      draw(0.016);
    } else if (visible) {
      start();
    }
  });
})();
