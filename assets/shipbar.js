/* ============================================================
   Thousand Sunny scrollbar — the ship alone
   The artwork is the scrollbar thumb and the only thing drawn:
   no track, no water, no rail. Native scrolling sails it across the
   bottom edge on an invisible swell, turning the hull to face the way
   it is going — forward (down the page) points right, backward (up
   the page) points left — and it can be dragged (or the edge clicked)
   to steer the page. Everything runs off the real document scroll —
   no fake scroll container — so wheel, keys, touch, anchors and the
   browser's own scrolling all keep working. Disabled below 900px,
   where the native scrollbar returns.
   ============================================================ */
(() => {
  const bar = document.querySelector("[data-seabar]");
  if (!bar) return;

  const track = bar.querySelector("[data-seabar-track]");
  const thumb = bar.querySelector("[data-seabar-thumb]");
  const art = thumb.querySelector("img");
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
    lastY: 0,
  };

  /* ── Geometry ─────────────────────────────────────────────── */
  function measure() {
    state.max = Math.max(0, root.scrollHeight - window.innerHeight);
    state.thumbW = thumb.offsetWidth || 1;
    state.travel = Math.max(1, track.clientWidth - state.thumbW);
  }

  function render(p) {
    state.shown = p;
    // Forward is to the right: progress 0 parks the ship at the left
    // end of the strip, and scrolling down sails it across the page.
    thumb.style.transform = `translate3d(${(p * state.travel).toFixed(2)}px, 0, 0)`;
  }

  function progressFromScroll() {
    return state.max > 0 ? clamp(window.scrollY / state.max, 0, 1) : 0;
  }

  /* ── Which way she is pointing ────────────────────────────────
     The artwork is drawn bow-left. Sailing forward (down the page,
     left to right) therefore mirrors her so the lion figurehead
     leads; sailing back up the page turns her round again. A little
     hysteresis keeps a shaky trackpad from flickering the flip.
     ───────────────────────────────────────────────────────────── */
  let facing = 1;  // +1 bow right (forward), −1 bow left (backward)
  let drift = 0;   // movement logged against the current facing

  function setFacing(next) {
    if (facing === next) return;
    facing = next;
    drift = 0;
    bar.classList.toggle("is-facing-right", facing > 0);
  }

  function steer(dy) {
    if (!dy) return;
    const sign = dy > 0 ? 1 : -1;
    if (sign === facing) {
      drift = 0;
      return;
    }
    drift += Math.abs(dy);
    if (drift < 28) return;
    setFacing(sign);
  }

  /* ── Scroll sync ──────────────────────────────────────────── */
  function onScroll() {
    if (!state.enabled) return;

    // Hand the frame loop the distance and direction of this event:
    // the loop turns it into swell energy and lean.
    const y = window.scrollY;
    const dy = y - state.lastY;
    state.lastY = y;
    delta += dy;
    steer(dy);
    startTilt();

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
    // 1:1 with the cursor, so the page must follow instantly rather
    // than inherit the page's smooth scroll-behaviour.
    window.scrollTo({ top: p * state.max, behavior: "instant" });
  });

  thumb.addEventListener("pointerup", endDrag);
  thumb.addEventListener("pointercancel", endDrag);
  thumb.addEventListener("lostpointercapture", endDrag);

  /* ── Click the bottom edge to sail there ──────────────────── */
  track.addEventListener("click", (event) => {
    if (!state.enabled || drag) return;
    const rect = track.getBoundingClientRect();
    const p = clamp((event.clientX - rect.left - state.thumbW / 2) / state.travel, 0, 1);
    window.scrollTo({
      top: p * state.max,
      behavior: reduceMotion.matches ? "instant" : "smooth",
    });
  });

  /* ── The invisible swell ──────────────────────────────────────
     Nothing is drawn under the ship, so the motion has to carry the
     illusion. Two layers: a perpetual CSS roll and bob that never
     quite repeat, and this loop, which feeds the real scroll
     velocity into a damped, wider rock — faster page, livelier sea,
     settling back to the idle swell the moment movement stops.
     ───────────────────────────────────────────────────────────── */
  let raf = null;
  let lastT = 0;
  let delta = 0;     // signed scroll distance gathered since the last frame
  let energy = 0;    // 0…1, how lively the sea is
  let lean = 0;      // current roll in degrees
  let surge = 0;     // sustained lean from raw velocity
  let phase = 0;

  function tiltFrame(now) {
    raf = null;
    if (!state.enabled || document.hidden || reduceMotion.matches || !art) return;

    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
    lastT = now;

    const moved = delta;
    delta = 0;

    // Movement feeds the swell; it decays back to a calm sea.
    energy = Math.max(energy * Math.pow(0.93, dt * 60), Math.min(1, Math.abs(moved) / 160));

    if (energy < 0.005) {
      // Calm: hand the ship back to the idle CSS swell and sleep.
      energy = 0;
      lean = 0;
      surge = 0;
      phase = 0;
      delta = 0;
      art.style.transform = "";
      return;
    }

    phase += dt * (2.6 + energy * 5.6);

    // The hull lags a little behind the direction of travel: sailing
    // forward lifts the bow, backing up lets it dip.
    const wantSurge = clamp(moved * 0.14, -4, 4);
    surge += (wantSurge - surge) * Math.min(1, dt * 8);

    // …and the swell adds a wider, damped roll on top of it.
    const want = surge + Math.sin(phase) * (0.9 + energy * 5.6);
    lean += (want - lean) * Math.min(1, dt * 10);

    const lift = Math.sin(phase * 0.9 + 1) * (0.5 + energy * 2.2);

    art.style.transform =
      `translate3d(0, ${lift.toFixed(2)}px, 0) ` +
      `perspective(820px) rotateZ(${lean.toFixed(2)}deg) ` +
      `rotateY(${(-lean * 0.55).toFixed(2)}deg)`;

    raf = requestAnimationFrame(tiltFrame);
  }

  function startTilt() {
    if (raf !== null || !state.enabled || document.hidden || reduceMotion.matches || !art) return;
    lastT = 0;
    raf = requestAnimationFrame(tiltFrame);
  }

  function stopTilt() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    energy = 0;
    lean = 0;
    surge = 0;
    phase = 0;
    delta = 0;
    if (art) art.style.transform = "";
  }

  /* ── Enable / disable with the breakpoint ─────────────────── */
  function setEnabled(on) {
    if (state.enabled === on) return;
    state.enabled = on;
    root.classList.toggle("has-shipbar", on);
    bar.classList.toggle("is-on", on);

    if (on) {
      facing = 1;
      drift = 0;
      bar.classList.add("is-facing-right");
      state.lastY = window.scrollY;
      measure();
      render(progressFromScroll());
    }
    stopTilt();
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

  if (art) {
    if (art.complete) refresh();
    else art.addEventListener("load", refresh, { once: true });
  }

  wide.addEventListener("change", (event) => setEnabled(event.matches));

  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) stopTilt();
    else if (state.enabled) startTilt();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopTilt();
    else startTilt();
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
