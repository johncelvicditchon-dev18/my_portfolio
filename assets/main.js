/* ============================================================
   Interaction layer: entrance timing, pointer depth, spotlight.
   Everything degrades gracefully (and is skipped for reduced motion).
   ============================================================ */
(() => {
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ── Entrance ─────────────────────────────────────────────── */
  let ready = false;
  const reveal = () => {
    if (ready) return;
    ready = true;
    body.classList.add("is-ready");
  };

  const start = () => {
    // Let the first paint settle, then run the choreography.
    requestAnimationFrame(() => setTimeout(reveal, 120));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(reveal, 80)).catch(() => {});
    }
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });

  // Safety net: content is never left hidden.
  setTimeout(reveal, 2600);

  /* ── Pointer-driven depth ─────────────────────────────────── */
  const scene = document.querySelector("[data-scene]");
  const showcase = document.querySelector("[data-showcase]");
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  if (scene && showcase && document.body && !reduceMotion.matches) {
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    let frame = null;

    const write = () => {
      showcase.style.setProperty("--mx", currentX.toFixed(4));
      showcase.style.setProperty("--my", currentY.toFixed(4));
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;
      write();

      if (Math.abs(targetX - currentX) > 0.0006 || Math.abs(targetY - currentY) > 0.0006) {
        frame = requestAnimationFrame(tick);
      } else {
        currentX = targetX;
        currentY = targetY;
        write();
        frame = null;
      }
    };

    const queue = () => {
      if (frame === null) frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      targetX = clamp(nx, -1, 1) * 0.85;
      targetY = clamp(ny, -1, 1) * 0.85;
      queue();
    }, { passive: true });

    document.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      queue();
    });

    window.addEventListener("blur", () => {
      targetX = 0;
      targetY = 0;
      queue();
    });
  }

  /* ── Atmospheric spotlight ───────────────────────────────── */
  if (finePointer.matches && !reduceMotion.matches) {
    let sx = window.innerWidth * 0.72;
    let sy = window.innerHeight * 0.32;
    let spotFrame = null;

    const paintSpot = () => {
      root.style.setProperty("--px", `${sx.toFixed(0)}px`);
      root.style.setProperty("--py", `${sy.toFixed(0)}px`);
      spotFrame = null;
    };

    window.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      sx = event.clientX;
      sy = event.clientY;
      if (spotFrame === null) spotFrame = requestAnimationFrame(paintSpot);
    }, { passive: true });
  }

  /* ── Keep heavy animation cheap when the tab is hidden ────── */
  document.addEventListener("visibilitychange", () => {
    root.classList.toggle("is-hidden", document.hidden);
  });
})();
