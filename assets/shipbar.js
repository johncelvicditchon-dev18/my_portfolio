/* ============================================================
   Thousand Sunny scrollbar
   The ship artwork is the scrollbar thumb: native scrolling sails
   it down a 3D ocean column on the right edge, and it can be
   dragged (or the track clicked) to steer the page. Everything
   runs off the real document scroll — no fake scroll container —
   so wheel, keys, touch, anchors and the browser's own scrolling
   all keep working. Disabled below 900px, where the native
   scrollbar returns.
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
    thumbH: 0,
    shown: 0,
    flow: 0,
    lastY: 0,
  };

  /* ── Geometry ─────────────────────────────────────────────── */
  function measure() {
    state.max = Math.max(0, root.scrollHeight - window.innerHeight);
    state.thumbH = thumb.offsetHeight || 1;
    state.travel = Math.max(1, track.clientHeight - state.thumbH);
    sizeWater();
  }

  function render(p) {
    state.shown = p;
    thumb.style.transform = `translate3d(0, ${(p * state.travel).toFixed(2)}px, 0)`;
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
    drag = { y: event.clientY, p: progressFromScroll() };
    render(drag.p);
    bar.classList.add("is-dragging");
    document.body.classList.add("is-shipdragging");
    thumb.setPointerCapture(event.pointerId);
  });

  thumb.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const p = clamp(drag.p + (event.clientY - drag.y) / state.travel, 0, 1);
    render(p);
    root.scrollTop = p * state.max;
  });

  thumb.addEventListener("pointerup", endDrag);
  thumb.addEventListener("pointercancel", endDrag);
  thumb.addEventListener("lostpointercapture", endDrag);

  /* ── Click the track to sail there ────────────────────────── */
  track.addEventListener("click", (event) => {
    if (!state.enabled || drag) return;
    const rect = track.getBoundingClientRect();
    const p = clamp((event.clientY - rect.top - state.thumbH / 2) / state.travel, 0, 1);
    window.scrollTo({
      top: p * state.max,
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  });

  /* ── 3D ocean: depth, caustics, bubbles, wake and foam ────── */
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
    const previousH = waterSize.h;
    waterSize.w = Math.max(1, Math.round(rect.width));
    waterSize.h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(waterSize.w * dpr);
    canvas.height = Math.round(waterSize.h * dpr);
    water.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!bubbles.length || previousH !== waterSize.h) seedBubbles();
    paintWater(0);
  }

  function seedBubbles() {
    bubbles.length = 0;
    const count = Math.max(10, Math.round(waterSize.h / 46));
    for (let i = 0; i < count; i += 1) {
      bubbles.push({
        x: Math.random() * waterSize.w,
        y: Math.random() * waterSize.h,
        r: 0.8 + Math.random() * 2,
        speed: 10 + Math.random() * 26,
        drift: Math.random() * TAU,
        alpha: 0.16 + Math.random() * 0.3,
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

    // Where the hull meets the water (image is ~70% down the thumb).
    const shipY = state.thumbH * 0.7 + state.shown * state.travel;
    const radius = Math.max(48, h * 0.12);

    // Depth: brighter surface at the top, colder and darker below.
    const depth = water.createLinearGradient(0, 0, 0, h);
    depth.addColorStop(0, "rgba(180, 244, 255, 0.10)");
    depth.addColorStop(0.16, "rgba(20, 110, 146, 0.05)");
    depth.addColorStop(0.62, "rgba(2, 24, 38, 0.10)");
    depth.addColorStop(1, "rgba(0, 4, 8, 0.30)");
    water.fillStyle = depth;
    water.fillRect(0, 0, w, h);

    // Soft currents: slow, volumetric patches of blue-green light.
    for (let i = 0; i < 3; i += 1) {
      const bx = w * (0.32 + 0.36 * Math.sin(time * 0.18 + i * 2.1));
      const by = (h * (0.18 + i * 0.31) - time * 7 + h) % h;
      const blob = water.createRadialGradient(bx, by, 0, bx, by, w * 1.1);
      blob.addColorStop(0, "rgba(62, 196, 226, 0.10)");
      blob.addColorStop(0.55, "rgba(16, 96, 130, 0.05)");
      blob.addColorStop(1, "rgba(2, 20, 34, 0)");
      water.fillStyle = blob;
      water.fillRect(0, by - w, w, w * 2);
    }

    // Caustic light shafts drifting up the column.
    for (let i = 0; i < 4; i += 1) {
      const phase = h + 90 - ((time * (16 + rush * 60) + i * 118) % (h + 180));
      const shaft = water.createLinearGradient(0, phase, w, phase + 110);
      shaft.addColorStop(0, "rgba(150, 238, 255, 0)");
      shaft.addColorStop(0.5, `rgba(164, 242, 255, ${(0.045 + i * 0.01 + rush * 0.03).toFixed(3)})`);
      shaft.addColorStop(1, "rgba(150, 238, 255, 0)");
      water.fillStyle = shaft;
      water.fillRect(0, phase, w, 110);
    }

    // Swell crests sliding upward past the ship.
    const gap = 32;
    const drift = -((time * (13 + rush * 120)) % gap);
    water.lineWidth = 1.5;
    for (let i = -1; i < h / gap + 2; i += 1) {
      const base = i * gap + drift;
      water.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = base + Math.sin(x * 0.11 + time * 1.15 + i * 0.6) * 2.2;
        if (x === 0) water.moveTo(x, y);
        else water.lineTo(x, y);
      }
      const crest = water.createLinearGradient(0, 0, w, 0);
      crest.addColorStop(0, "rgba(120, 220, 255, 0.04)");
      crest.addColorStop(0.4, "rgba(204, 250, 255, 0.30)");
      crest.addColorStop(0.72, "rgba(96, 190, 226, 0.14)");
      crest.addColorStop(1, "rgba(0, 30, 50, 0)");
      water.strokeStyle = crest;
      water.stroke();

      // shaded trough just below each crest
      water.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = base + 4 + Math.sin(x * 0.11 + time * 1.15 + i * 0.6) * 2.2;
        if (x === 0) water.moveTo(x, y);
        else water.lineTo(x, y);
      }
      water.strokeStyle = "rgba(0, 16, 28, 0.22)";
      water.stroke();
    }

    // Soft column of light running down the water.
    const coreX = w * (0.52 + Math.sin(time * 0.35) * 0.16);
    const core = water.createLinearGradient(coreX - 18, 0, coreX + 18, 0);
    core.addColorStop(0, "rgba(120, 230, 255, 0)");
    core.addColorStop(0.5, "rgba(176, 246, 255, 0.10)");
    core.addColorStop(1, "rgba(120, 230, 255, 0)");
    water.fillStyle = core;
    water.fillRect(0, 0, w, h);

    // Rising bubbles, independent of the ship's position.
    for (const bubble of bubbles) {
      bubble.y -= bubble.speed * (1 + rush * 2.4) * dt;
      if (bubble.y < -4) {
        bubble.y = h + 4;
        bubble.x = Math.random() * w;
      }
      const bx = bubble.x + Math.sin(time * 1.4 + bubble.drift) * 2;
      water.beginPath();
      water.arc(bx, bubble.y, bubble.r, 0, TAU);
      water.fillStyle = `rgba(214, 247, 255, ${bubble.alpha.toFixed(3)})`;
      water.fill();
      water.beginPath();
      water.arc(bx - bubble.r * 0.3, bubble.y - bubble.r * 0.35, bubble.r * 0.34, 0, TAU);
      water.fillStyle = `rgba(255, 255, 255, ${(bubble.alpha * 0.8).toFixed(3)})`;
      water.fill();
    }

    // Wake trailing upward from the hull (the ship sails downward).
    const wake = water.createLinearGradient(0, shipY, 0, shipY - 150);
    wake.addColorStop(0, `rgba(226, 251, 255, ${(0.3 + rush * 0.18).toFixed(3)})`);
    wake.addColorStop(0.35, "rgba(190, 242, 255, 0.14)");
    wake.addColorStop(1, "rgba(170, 236, 255, 0)");
    water.fillStyle = wake;
    water.fillRect(0, shipY - 150, w, 150);

    // Refraction glow around the hull.
    const glow = water.createRadialGradient(w * 0.6, shipY, 0, w * 0.6, shipY, radius);
    glow.addColorStop(0, "rgba(164, 240, 255, 0.30)");
    glow.addColorStop(0.45, "rgba(64, 172, 220, 0.13)");
    glow.addColorStop(1, "rgba(0, 18, 30, 0)");
    water.fillStyle = glow;
    water.fillRect(0, shipY - radius, w, radius * 2);

    // Foam pulsing against the hull.
    for (let i = 0; i < 3; i += 1) {
      const yy = shipY + Math.sin(time * 2 + i * 1.7) * 3 + (i - 1) * 6;
      const foam = water.createRadialGradient(w * 0.55, yy, 0, w * 0.55, yy, w * 0.95);
      foam.addColorStop(0, `rgba(240, 254, 255, ${(0.26 - i * 0.05 + rush * 0.08).toFixed(3)})`);
      foam.addColorStop(1, "rgba(120, 214, 244, 0)");
      water.fillStyle = foam;
      water.fillRect(0, yy - 18, w, 36);
    }

    // Foam wisps peeling off the hull.
    for (let i = 0; i < 6; i += 1) {
      const phase = time * 1.25 + i * 2.1;
      const fx = w * (0.16 + 0.66 * (((i * 0.27 + 0.13) % 1)));
      const fy = shipY + Math.sin(phase) * 14 + (i - 3) * 4.5;
      const alpha = 0.16 + Math.max(0, Math.sin(phase)) * 0.16;
      water.beginPath();
      water.ellipse(
        fx,
        fy,
        2.2 + Math.abs(Math.sin(phase)) * 2.8,
        0.7 + Math.abs(Math.cos(phase)) * 0.7,
        Math.sin(phase) * 0.5,
        0,
        TAU,
      );
      water.fillStyle = `rgba(240, 253, 255, ${alpha.toFixed(3)})`;
      water.fill();
    }

    // Spray droplets kicked up around the hull.
    for (let i = 0; i < 7; i += 1) {
      const phase = time * 1.8 + i * 1.27;
      const side = i % 2 === 0 ? -1 : 1;
      const dx = w * 0.5 + side * (5 + ((i * 7) % 10) + Math.sin(phase) * 3);
      const dy = shipY + Math.cos(phase) * 11 + (i - 3) * 3;
      const alpha = 0.22 + Math.max(0, Math.sin(phase)) * 0.25;
      water.beginPath();
      water.arc(dx, dy, 0.7 + (i % 3) * 0.45, 0, TAU);
      water.fillStyle = `rgba(240, 253, 255, ${alpha.toFixed(3)})`;
      water.fill();
    }

    // Fast vertical streaks while the page is moving.
    if (rush > 0.02) {
      water.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        const sx = w * (0.16 + i * 0.17);
        const sy = h + 40 - ((time * (150 + rush * 320) + i * 137) % (h + 80));
        const streak = water.createLinearGradient(0, sy, 0, sy - 42);
        streak.addColorStop(0, "rgba(220, 250, 255, 0)");
        streak.addColorStop(0.5, `rgba(220, 250, 255, ${(0.12 * rush).toFixed(3)})`);
        streak.addColorStop(1, "rgba(220, 250, 255, 0)");
        water.strokeStyle = streak;
        water.beginPath();
        water.moveTo(sx, sy);
        water.lineTo(sx + Math.sin(i * 2.1) * 2, sy - 42);
        water.stroke();
      }
    }

    // Surface shimmer at the top of the column.
    const shimmer = water.createLinearGradient(0, 0, 0, 46);
    shimmer.addColorStop(0, "rgba(226, 252, 255, 0.22)");
    shimmer.addColorStop(1, "rgba(226, 252, 255, 0)");
    water.fillStyle = shimmer;
    water.fillRect(0, 0, w, 46);
  }

  function waterTick(now) {
    if (!state.enabled || document.hidden || reduceMotion.matches) {
      waterFrame = null;
      paintWater(0);
      return;
    }
    waterFrame = requestAnimationFrame(waterTick);
    if (now - waterLast < 34) return; // ~30 fps is plenty for a 46px strip
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
