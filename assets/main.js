/* ============================================================
   Interaction layer
   Entrance timing, pointer depth, drag-to-inspect, navigation,
   scroll reveals, and the contact form.
   Everything degrades gracefully (and is skipped for reduced motion).
   ============================================================ */
(() => {
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

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

  if (scene && showcase && !reduceMotion.matches) {
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

  /* ── Drag to inspect ──────────────────────────────────────────
     The portrait is a single photograph, so the orbit is a
     controlled arc rather than a fake full turnaround. Drag
     horizontally to look around, vertically to tilt; release
     and the frame eases back to the front.
     ----------------------------------------------------------- */
  if (scene && showcase) {
    const MAX_YAW = 16;
    const MAX_PITCH = 8;
    let yaw = 0, pitch = 0;
    let startYaw = 0, startPitch = 0;
    let startX = 0, startY = 0;
    let dragging = false;
    let decided = false;
    let ignore = false;
    let settle = null;
    let settleAt = 0;

    const paint = () => {
      showcase.style.setProperty("--orbit-y", yaw.toFixed(3) + "deg");
      showcase.style.setProperty("--orbit-x", pitch.toFixed(3) + "deg");
      // shared with the hat renderer so the hat turns with the view
      window.__orbit = { y: yaw, x: pitch };
    };

    const glide = (now) => {
      // ease back toward the front view, time-based so the settle
      // takes the same ~0.6s regardless of frame rate
      const dt = settleAt ? Math.min(64, Math.max(1, now - settleAt)) : 16.7;
      settleAt = now;
      const k = Math.pow(0.89, dt / 16.7);
      yaw *= k;
      pitch *= k;
      if (Math.abs(yaw) < 0.05 && Math.abs(pitch) < 0.05) {
        yaw = 0;
        pitch = 0;
        paint();
        settle = null;
        settleAt = 0;
        return;
      }
      paint();
      settle = requestAnimationFrame(glide);
    };

    const release = () => {
      if (!dragging) return;
      dragging = false;
      scene.classList.remove("is-dragging");
      if (!settle && !reduceMotion.matches) {
        settleAt = 0;
        settle = requestAnimationFrame(glide);
      }
    };

    scene.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (settle) {
        cancelAnimationFrame(settle);
        settle = null;
      }
      dragging = true;
      decided = false;
      ignore = false;
      startX = event.clientX;
      startY = event.clientY;
      startYaw = yaw;
      startPitch = pitch;
      scene.classList.add("is-dragging");
      if (scene.setPointerCapture) {
        try { scene.setPointerCapture(event.pointerId); } catch (_) { /* noop */ }
      }
    });

    scene.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        decided = true;
        // let vertical gestures scroll the page untouched
        ignore = Math.abs(dy) > Math.abs(dx);
        if (ignore) {
          release();
          return;
        }
        root.classList.add("has-orbit");
      }
      if (ignore) return;

      yaw = clamp(startYaw + dx * 0.22, -MAX_YAW, MAX_YAW);
      pitch = clamp(startPitch - dy * 0.14, -MAX_PITCH, MAX_PITCH);
      paint();
    });

    scene.addEventListener("pointerup", release);
    scene.addEventListener("pointercancel", release);
    scene.addEventListener("pointerleave", release);

    scene.addEventListener("dragstart", (event) => event.preventDefault());
  }

  /* ── Navigation: active section + sliding marker ──────────── */
  const nav = document.querySelector("[data-nav]");
  if (nav) {
    const links = Array.from(nav.querySelectorAll(".nav__link"));
    const marker = nav.querySelector("[data-nav-marker]");
    const targets = links
      .map((link) => {
        const id = link.getAttribute("href");
        const section = id && id.length > 1 ? document.querySelector(id) : null;
        return section ? { link, section } : null;
      })
      .filter(Boolean);

    let active = null;

    const placeMarker = (link) => {
      if (!marker) return;
      if (!link) {
        marker.classList.remove("is-on");
        return;
      }
      marker.style.width = link.offsetWidth + "px";
      marker.style.transform = "translateX(" + link.offsetLeft + "px)";
      marker.classList.add("is-on");
    };

    const setActive = (link) => {
      if (active === link) return;
      active = link;
      links.forEach((item) => {
        const on = item === link;
        item.classList.toggle("is-active", on);
        if (on) item.setAttribute("aria-current", "true");
        else item.removeAttribute("aria-current");
      });
      placeMarker(link);
    };

    if (targets.length && "IntersectionObserver" in window) {
      const visible = new Map();
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => visible.set(entry.target, entry.intersectionRatio));
        let best = null;
        let ratio = 0;
        targets.forEach(({ link, section }) => {
          const r = visible.get(section) || 0;
          if (r > ratio) {
            ratio = r;
            best = link;
          }
        });
        setActive(ratio > 0.08 ? best : null);
      }, { threshold: [0, 0.15, 0.35, 0.6, 0.85], rootMargin: "-18% 0px -24% 0px" });

      targets.forEach(({ section }) => observer.observe(section));
    }

    links.forEach((link) => {
      link.addEventListener("focus", () => placeMarker(active || link));
    });

    window.addEventListener("resize", () => placeMarker(active), { passive: true });
  }

  /* ── Scroll reveals for everything below the hero ─────────── */
  const revealables = Array.from(document.querySelectorAll("[data-reveal]")).filter(
    (el) => !el.closest(".hero")
  );

  if (!reduceMotion.matches && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("is-in"));
  }

  /* ── Contact form ─────────────────────────────────────────────
     There is no backend on this site, so the form validates the
     input and hands the message to the visitor's email app. It
     never claims a message was delivered.
     ----------------------------------------------------------- */
  const form = document.querySelector("[data-form]");
  if (form) {
    const status = form.querySelector("[data-form-status]");
    const fields = Array.from(form.querySelectorAll(".field__input"));
    const owner = (input) => input.closest(".field");
    const message = (input) => {
      const slot = form.querySelector('[data-error-for="' + input.name + '"]');
      return slot || null;
    };

    const say = (input, text) => {
      const slot = message(input);
      const wrap = owner(input);
      if (slot) slot.textContent = text;
      if (wrap) wrap.classList.toggle("has-error", Boolean(text));
      input.setAttribute("aria-invalid", text ? "true" : "false");
    };

    const validate = (input) => {
      const value = input.value.trim();
      if (!value) {
        say(input, "This field is required.");
        return false;
      }
      if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        say(input, "Enter a valid email address.");
        return false;
      }
      if (input.name === "message" && value.length < 12) {
        say(input, "A little more detail helps — 12 characters or more.");
        return false;
      }
      say(input, "");
      return true;
    };

    fields.forEach((input) => {
      input.addEventListener("input", () => {
        if (owner(input) && owner(input).classList.contains("has-error")) validate(input);
      });
      input.addEventListener("blur", () => {
        if (input.value.trim()) validate(input);
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      let firstBad = null;
      fields.forEach((input) => {
        if (!validate(input) && !firstBad) firstBad = input;
      });

      if (firstBad) {
        if (status) status.textContent = "Please check the highlighted fields.";
        firstBad.focus();
        return;
      }

      const value = (name) => form.elements[name].value.trim();
      const subject = "Portfolio inquiry — " + value("subject");
      const body =
        value("message") +
        "\n\n— " + value("name") +
        "\n" + value("email");

      const mailto =
        "mailto:ditchonjohncelvic@gmail.com" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      if (status) {
        status.textContent = "Opening your email app with the message ready to send…";
      }

      window.location.href = mailto;

      window.setTimeout(() => {
        if (status) {
          status.textContent =
            "If nothing opened, email ditchonjohncelvic@gmail.com directly.";
        }
      }, 4000);
    });
  }

  /* ── Copy to clipboard ────────────────────────────────────────
     Small utilities for the email, Instagram and Facebook rows.
     Uses the async clipboard API where it is available and falls
     back to a hidden textarea so it also works over plain http.
     ----------------------------------------------------------- */
  const copyButtons = Array.from(document.querySelectorAll("[data-copy]"));
  if (copyButtons.length) {
    const status = document.querySelector("[data-copy-status]");
    let clearTimer = null;
    let resetTimer = null;

    const announce = (text) => {
      if (!status) return;
      status.textContent = text;
      status.classList.add("is-shown");
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        status.classList.remove("is-shown");
        window.setTimeout(() => {
          if (!status.classList.contains("is-shown")) status.textContent = "";
        }, 420);
      }, 2800);
    };

    const legacyCopy = (text) => {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.setAttribute("aria-hidden", "true");
      field.style.position = "fixed";
      field.style.top = "-1000px";
      field.style.left = "-1000px";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_) {
        ok = false;
      }
      document.body.removeChild(field);
      return ok;
    };

    const write = async (text) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (_) {
          /* fall through to the legacy path */
        }
      }
      return legacyCopy(text);
    };

    copyButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const text = button.getAttribute("data-copy");
        if (!text) return;
        const ok = await write(text);
        const label = button.getAttribute("aria-label") || "Detail";
        const name = label.replace(/^copy\s+/i, "");
        if (ok) {
          window.clearTimeout(resetTimer);
          copyButtons.forEach((item) => item.classList.remove("is-copied"));
          button.classList.add("is-copied");
          resetTimer = window.setTimeout(() => button.classList.remove("is-copied"), 1800);
          announce(name.charAt(0).toUpperCase() + name.slice(1) + " copied to clipboard.");
        } else {
          announce("Couldn't copy automatically — the detail is on this page.");
        }
      });
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
