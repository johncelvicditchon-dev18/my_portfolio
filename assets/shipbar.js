/* ============================================================
   Thousand Sunny scrollbar — bottom ocean
   The ship artwork is the scrollbar thumb: native scrolling sails
   it along a 3D ocean strip across the bottom edge, left to right,
   and it can be dragged (or the strip clicked) to steer the page.
   Everything runs off the real document scroll — no fake scroll
   container — so wheel, keys, touch, anchors and the browser's own
   scrolling all keep working. Disabled below 900px, where the
   native scrollbar returns.
   ============================================================ */
(() => {
  const bar = document.querySelector("[data-seabar]");
  if (!bar) return;

  const track = bar.querySelector("[data-seabar-track]");
  const thumb = bar.querySelector("[data-seabar-thumb]");
  const canvas = bar.querySelector("[data-seabar-water]");
  const root = document.documentElement;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wide = window.matchMedia("(min-width: 900px)");
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const state = {
    enabled: false,
    max: 0,
    travel: 1,
    thumbW: 0,
    shown: 0,
    flow: 0,
    lastY: 0,
  };

  /* ── Geometry ─────────────────────────────────────────────── */
  function measure() {
    state.max = Math.max(0, root.scrollHeight - window.innerHeight);
    state.thumbW = thumb.offsetWidth || 1;
    state.travel = Math.max(1, track.clientWidth - state.thumbW);
    sizeWater();
  }

  function render(p) {
    state.shown = p;
    thumb.style.transform = `translate3d(${(p * state.travel).toFixed(2)}px, 0, 0)`;
  }

  function progressFromScroll() {
    return state.max > 0 ? clamp(window.scrollY / state.max, 0, 1) : 0;
  }

  /* ── Scroll sync ──────────────────────────────────────────── */
  function onScroll() {
    if (!state.enabled) return;

    // Scroll speed feeds the current, so fast scrolling makes the
    // ocean rush past the hull.
    const y = window.scrollY;
    const dy = Math.abs(y - state.lastY);
    state.lastY = y;
    state.flow = clamp(state.flow + dy / 320, 0, 1);

    if (drag) return;
    render(progressFromScroll());
  }

  /* ── Drag the ship ────────────────────────────────────────── */
  let drag = null;

  function endDrag() {
    if (!drag) return;
    drag = null;
    bar.classList.remove("is-dragging");
    document.body.classList.remove("is-shipdragging");
    render(progressFromScroll());
  }

  thumb.addEventListener("pointerdown", (event) => {
    if (!state.enabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    // A drag must win over any smooth scroll already in flight.
    window.scrollTo({ top: window.scrollY, behavior: "instant" });
    drag = { x: event.clientX, p: progressFromScroll() };
    render(drag.p);
    bar.classList.add("is-dragging");
    document.body.classList.add("is-shipdragging");
    thumb.setPointerCapture(event.pointerId);
  });

  thumb.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const p = clamp(drag.p + (event.clientX - drag.x) / state.travel, 0, 1);
    render(p);
    root.scrollTop = p * state.max;
  });

  thumb.addEventListener("pointerup", endDrag);
  thumb.addEventListener("pointercancel", endDrag);
  thumb.addEventListener("lostpointercapture", endDrag);

  /* ── Click the strip to sail there ────────────────────────── */
  track.addEventListener("click", (event) => {
    if (!state.enabled || drag) return;
    const rect = track.getBoundingClientRect();
    const p = clamp((event.clientX - rect.left - state.thumbW / 2) / state.travel, 0, 1);
    window.scrollTo({
      top: p * state.max,
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  });

  /* ── 3D ocean: depth, glints, bubbles, wake and foam ──────── */
  const water = canvas ? canvas.getContext("2d") : null;
  const waterSize = { w: 1, h: 1 };
  const bubbles = [];
  const TAU = Math.PI * 2;
  let waterFrame = null;
  let waterLast = 0;
  let waterPrev = 0;

  function sizeWater() {
    if (!water) return;
    const rect = track.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const previousW = waterSize.w;
    waterSize.w = Math.max(1, Math.round(rect.width));
    waterSize.h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(waterSize.w * dpr);
    canvas.height = Math.round(waterSize.h * dpr);
    water.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!bubbles.length || previousW !== waterSize.w) seedBubbles();
    paintWater(0);
  }

  function seedBubbles() {
    bubbles.length = 0;
    // The band is short and wide, so the bubbles are seeded along
    // its length rather than its depth.
    const count = Math.max(16, Math.round(waterSize.w / 56));
    for (let i = 0; i < count; i += 1) {
      bubbles.push({
        x: Math.random() * waterSize.w,
        y: Math.random() * waterSize.h,
        r: 0.5 + Math.random() * 1.5,
        speed: 7 + Math.random() * 18,
        drift: Math.random() * TAU,
        alpha: 0.16 + Math.random() * 0.34,
      });
    }
  }

  function paintWater(time) {
    if (!water) return;
    const { w, h } = waterSize;
    const dt = waterPrev ? Math.min(0.1, Math.max(0, time - waterPrev)) : 0;
    waterPrev = time;
    state.flow = Math.max(0, state.flow - dt * 0.85);
    const rush = state.flow;
    water.clearRect(0, 0, w, h);

    // Where the hull meets the water, in track coordinates.
    const shipX = state.thumbW * 0.5 + state.shown * state.travel;
    const surface = h * 0.3;
    const radius = Math.max(34, h * 1.9);

    // Depth: lit surface at the top, colder and darker below.
    const depth = water.createLinearGradient(0, 0, 0, h);
    depth.addColorStop(0, "rgba(184, 246, 255, 0.16)");
    depth.addColorStop(0.16, "rgba(20, 110, 146, 0.07)");
    depth.addColorStop(0.58, "rgba(2, 24, 38, 0.1)");
    depth.addColorStop(1, "rgba(0, 4, 8, 0.32)");
    water.fillStyle = depth;
    water.fillRect(0, 0, w, h);

    // Soft currents: slow, wide patches of blue-green light.
    for (let i = 0; i < 3; i += 1) {
      const bx = ((time * (14 + i * 6) + w * (0.12 + i * 0.36) + w) % (w + 360)) - 180;
      const by = h * (0.24 + i * 0.26);
      const span = Math.max(120, w * 0.3);
      const blob = water.createRadialGradient(bx, by, 0, bx, by, span);
      blob.addColorStop(0, "rgba(62, 196, 226, 0.11)");
      blob.addColorStop(0.55, "rgba(16, 96, 130, 0.05)");
      blob.addColorStop(1, "rgba(2, 20, 34, 0)");
      water.fillStyle = blob;
      water.fillRect(bx - span, 0, span * 2, h);
    }

    // Surface glints sweeping along the band.
    for (let i = 0; i < 5; i += 1) {
      const phase = ((time * (26 + rush * 130) + i * (w / 5) + w) % (w + 300)) - 150;
      const span = 150;
      const glint = water.createLinearGradient(phase - span, 0, phase + span, 0);
      glint.addColorStop(0, "rgba(150, 238, 255, 0)");
      glint.addColorStop(0.5, `rgba(174, 244, 255, ${(0.05 + (i % 2) * 0.015 + rush * 0.03).toFixed(3)})`);
      glint.addColorStop(1, "rgba(150, 238, 255, 0)");
      water.fillStyle = glint;
      water.fillRect(phase - span, 0, span * 2, h);
    }

    // Swell crests travelling along the surface.
    const rows = 3;
    water.lineWidth = 1.2;
    for (let r = 0; r < rows; r += 1) {
      const base = h * (0.24 + r * 0.27);
      const amp = 0.7 + r * 0.32;
      const speed = 0.9 + r * 0.22 + rush * 1.6;
      const freq = 0.014 + r * 0.002;
      const offset = time * speed + r * 1.7;

      water.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = base + Math.sin(x * freq - offset) * amp;
        if (x === 0) water.moveTo(x, y);
        else water.lineTo(x, y);
      }
      const crest = water.createLinearGradient(0, base - amp - 1, 0, base + amp + 2);
      crest.addColorStop(0, "rgba(226, 252, 255, 0.30)");
      crest.addColorStop(0.45, "rgba(140, 224, 255, 0.15)");
      crest.addColorStop(1, "rgba(0, 26, 42, 0)");
      water.strokeStyle = crest;
      water.stroke();

      // shaded trough just under each crest
      water.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = base + 2.4 + Math.sin(x * freq - offset) * amp;
        if (x === 0) water.moveTo(x, y);
        else water.lineTo(x, y);
      }
      water.strokeStyle = "rgba(0, 14, 26, 0.26)";
      water.stroke();
    }

    // Rising bubbles, independent of the ship's position.
    for (const bubble of bubbles) {
      bubble.y -= bubble.speed * (1 + rush * 2.4) * dt;
      if (bubble.y < -3) {
        bubble.y = h + 3;
        bubble.x = Math.random() * w;
      }
      const bx = bubble.x + Math.sin(time * 1.4 + bubble.drift) * 1.6;
      water.beginPath();
      water.arc(bx, bubble.y, bubble.r, 0, TAU);
      water.fillStyle = `rgba(214, 247, 255, ${bubble.alpha.toFixed(3)})`;
      water.fill();
    }

    // Wake trailing behind the hull (the ship sails to the right).
    const wakeLength = 150;
    const wake = water.createLinearGradient(shipX - wakeLength, 0, shipX + 6, 0);
    wake.addColorStop(0, "rgba(226, 251, 255, 0)");
    wake.addColorStop(0.58, "rgba(196, 244, 255, 0.10)");
    wake.addColorStop(1, `rgba(232, 252, 255, ${(0.3 + rush * 0.2).toFixed(3)})`);
    water.fillStyle = wake;
    water.fillRect(shipX - wakeLength, 0, wakeLength + 6, h);

    // Refraction glow around the hull.
    const glow = water.createRadialGradient(shipX, surface + h * 0.24, 0, shipX, surface + h * 0.24, radius);
    glow.addColorStop(0, "rgba(164, 240, 255, 0.32)");
    glow.addColorStop(0.45, "rgba(64, 172, 220, 0.14)");
    glow.addColorStop(1, "rgba(0, 18, 30, 0)");
    water.fillStyle = glow;
    water.fillRect(shipX - radius, 0, radius * 2, h);

    // Foam pulsing against the hull.
    for (let i = 0; i < 3; i += 1) {
      const fx = shipX + Math.sin(time * 2 + i * 1.7) * 2 + (i - 1) * 5;
      const foam = water.createRadialGradient(fx, surface, 0, fx, surface, radius * 0.9);
      foam.addColorStop(0, `rgba(240, 254, 255, ${(0.26 - i * 0.05 + rush * 0.08).toFixed(3)})`);
      foam.addColorStop(1, "rgba(120, 214, 244, 0)");
      water.fillStyle = foam;
      water.fillRect(fx - radius, 0, radius * 2, h);
    }

    // Foam wisps peeling off behind the hull.
    for (let i = 0; i < 6; i += 1) {
      const phase = time * 1.25 + i * 2.1;
      const back = 12 + ((i * 13 + Math.abs(Math.sin(phase)) * 8) % 62);
      const fx = shipX - back;
      const fy = h * (0.28 + 0.14 * Math.sin(phase + i));
      const alpha = 0.14 + Math.max(0, Math.sin(phase)) * 0.16;
      water.beginPath();
      water.ellipse(
        fx,
        fy,
        2.4 + Math.abs(Math.sin(phase)) * 3,
        0.6 + Math.abs(Math.cos(phase)) * 0.5,
        0,
        0,
        TAU,
      );
      water.fillStyle = `rgba(240, 253, 255, ${alpha.toFixed(3)})`;
      water.fill();
    }

    // Spray droplets kicked up around the bow.
    for (let i = 0; i < 7; i += 1) {
      const phase = time * 1.8 + i * 1.27;
      const dx = shipX + (i - 3) * 3.4 + Math.sin(phase) * 2.2;
      const dy = surface - 1 - (i % 3) * 1.3 + Math.cos(phase) * 3.4;
      const alpha = 0.22 + Math.max(0, Math.sin(phase)) * 0.25;
      water.beginPath();
      water.arc(dx, dy, 0.7 + (i % 3) * 0.4, 0, TAU);
      water.fillStyle = `rgba(240, 253, 255, ${alpha.toFixed(3)})`;
      water.fill();
    }

    // Fast streaks while the page is moving.
    if (rush > 0.02) {
      water.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        const sy = h * (0.24 + i * 0.15);
        const sx = w + 60 - ((time * (220 + rush * 380) + i * 137) % (w + 120));
        const streak = water.createLinearGradient(sx, 0, sx - 54, 0);
        streak.addColorStop(0, "rgba(220, 250, 255, 0)");
        streak.addColorStop(0.5, `rgba(220, 250, 255, ${(0.12 * rush).toFixed(3)})`);
        streak.addColorStop(1, "rgba(220, 250, 255, 0)");
        water.strokeStyle = streak;
        water.beginPath();
        water.moveTo(sx, sy);
        water.lineTo(sx - 54, sy + Math.sin(i * 2.1) * 1.2);
        water.stroke();
      }
    }

    // Surface sheen along the waterline.
    const sheen = water.createLinearGradient(0, 0, 0, Math.max(4, h * 0.34));
    sheen.addColorStop(0, "rgba(226, 252, 255, 0.24)");
    sheen.addColorStop(1, "rgba(226, 252, 255, 0)");
    water.fillStyle = sheen;
    water.fillRect(0, 0, w, Math.max(4, h * 0.34));
  }

  function waterTick(now) {
    if (!state.enabled || document.hidden || reduceMotion.matches) {
      waterFrame = null;
      paintWater(0);
      return;
    }
    waterFrame = requestAnimationFrame(waterTick);
    if (now - waterLast < 34) return; // ~30 fps is plenty for a thin strip
    waterLast = now;
    paintWater(now / 1000);
  }

  function startWater() {
    if (waterFrame !== null || !state.enabled || document.hidden || reduceMotion.matches) return;
    paintWater(0);
    waterLast = performance.now();
    waterFrame = requestAnimationFrame(waterTick);
  }

  function stopWater() {
    if (waterFrame !== null) cancelAnimationFrame(waterFrame);
    waterFrame = null;
    paintWater(0);
  }

  /* ── Enable / disable with the breakpoint ─────────────────── */
  function setEnabled(on) {
    if (state.enabled === on) return;
    state.enabled = on;
    root.classList.toggle("has-shipbar", on);
    bar.classList.toggle("is-on", on);

    if (on) {
      state.lastY = window.scrollY;
      state.flow = 0;
      measure();
      render(progressFromScroll());
      startWater();
    } else {
      stopWater();
    }
  }

  function refresh() {
    if (!state.enabled) return;
    measure();
    if (!drag) render(progressFromScroll());
  }

  setEnabled(wide.matches);

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("load", refresh);

  const shipImage = thumb.querySelector("img");
  if (shipImage) {
    if (shipImage.complete) refresh();
    else shipImage.addEventListener("load", refresh, { once: true });
  }

  wide.addEventListener("change", (event) => setEnabled(event.matches));

  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) stopWater();
    else startWater();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopWater();
    else startWater();
  });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(refresh);
    observer.observe(document.body);
  }

  // Debug hook, in the spirit of ?auraTime / ?hatDebug: park the ship.
  const shipAt = Number.parseFloat(new URLSearchParams(window.location.search).get("shipAt"));
  if (Number.isFinite(shipAt)) {
    window.addEventListener("load", () => {
      window.scrollTo({ top: clamp(shipAt, 0, 1) * state.max, behavior: "instant" });
    });
  }
})();
