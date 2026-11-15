/* ============================================================
   AURA FIELD — shared crimson energy-field engine
   ------------------------------------------------------------
   One WebGL fragment shader, mounted once per portrait:
     • burgundy pressure cloud that hugs the silhouette
     • crimson energy field + rising flame tongues
     • expanding shockwave rings with distorted air
     • procedural black lightning with crimson edges
     • embers, bursts, camera shake, pointer intensification
   Every mount supplies its own silhouette mask baked from that
   cut-out's alpha (R = sharp, G = medium blur, B = wide blur),
   so the energy always follows the real outline of the figure
   instead of a generic oval.
   ============================================================ */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 900px)");
  const coarse = window.matchMedia("(hover: none), (pointer: coarse)");
  const params = new URLSearchParams(location.search);

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const FRAG = `
    precision highp float;

    varying vec2 vUv;

    uniform sampler2D uMask;
    uniform vec4 uImg;
    uniform vec4 uPad;
    uniform vec2 uRes;
    uniform vec2 uMouse;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uFocus;
    uniform float uBurst;
    uniform float uDebug;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * vnoise(p);
        p = p * 2.02 + vec2(11.3, 7.7);
        a *= 0.5;
      }
      return v;
    }

    float ridges(vec2 p) {
      float n = 0.0;
      float a = 0.55;
      for (int i = 0; i < 3; i++) {
        n += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
        p = p * 2.1 + vec2(5.7, 3.1);
        a *= 0.5;
      }
      return n;
    }

    // A field of sharp, vertically stretched flame spikes.
    float spikeField(vec2 p, float t, float seed) {
      vec2 f = vec2(p.x * 14.0 + seed * 0.37, p.y * 2.55 - t * 0.92);
      f.x += sin(p.y * 7.5 + t * 0.55 + seed) * 0.5;
      float ridge = ridges(f);
      float fine = vnoise(f * vec2(2.6, 1.7) + vec2(4.3, seed));
      float v = clamp(ridge * 0.74 + fine * 0.36 - 0.13, 0.0, 1.0);
      return pow(v, 3.4);
    }

    float embers(vec2 q, float t, float scale, float seed) {
      vec2 gp = vec2(q.x * scale, q.y * scale + t * 0.42);
      vec2 cell = floor(gp);
      vec2 f = fract(gp) - 0.5;
      float h = hash21(cell + seed);
      float h2 = hash21(cell + seed + 4.7);
      float h3 = hash21(cell + seed + 9.1);
      float show = step(0.62, h);
      vec2 off = (vec2(h2, h3) - 0.5) * 0.66;
      float d = length(f - off);
      float tw = 0.55 + 0.45 * sin(t * 2.6 + h * 37.0);
      return (1.0 - smoothstep(0.0, 0.085, d)) * show * tw;
    }

    // Thin, fast streaks of rising energy.
    float sparkStreaks(vec2 q, float t, float scale, float seed) {
      vec2 gp = vec2(q.x * scale * 1.55, q.y * scale + t * 0.92);
      vec2 cell = floor(gp);
      vec2 f = fract(gp) - 0.5;
      float h = hash21(cell + seed);
      float h2 = hash21(cell + seed + 3.3);
      float h3 = hash21(cell + seed + 8.7);
      float show = step(0.72, h);
      vec2 off = (vec2(h2, h3) - 0.5) * 0.68;
      float d = length(vec2((f.x - off.x) * 3.6, (f.y - off.y) * 0.9));
      float tw = 0.55 + 0.45 * sin(t * 7.5 + h * 43.0);
      return (1.0 - smoothstep(0.0, 0.06, d)) * show * tw;
    }

    // One jagged lightning bolt radiating from behind the portrait.
    // Returns (black core, crimson edge intensity).
    vec2 lightning(vec2 q, float seed, float t) {
      float ct = t * 0.52 + seed * 9.0;
      float cyc = floor(ct);
      float ph = fract(ct);
      float active = smoothstep(0.0, 0.04, ph) * (1.0 - smoothstep(0.24, 0.46, ph));
      if (active < 0.002) return vec2(0.0);

      float a = hash21(vec2(cyc, seed)) * 6.2831853;
      float len = 0.36 + hash21(vec2(cyc, seed + 3.0)) * 0.46;
      vec2 dir = vec2(cos(a), sin(a));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 qb = q - vec2(0.0, -0.015);

      float u = dot(qb, dir) - 0.055;
      float v = dot(qb, perp);
      if (u < 0.0 || u > len) return vec2(0.0);

      float segs = 7.0 + floor(hash21(vec2(cyc, seed + 8.0)) * 7.0);
      float zig = abs(fract(u * segs + hash21(vec2(cyc, seed + 4.0))) - 0.5) * 2.0 - 0.5;
      float micro = vnoise(vec2(u * 130.0, seed * 7.0 + cyc)) - 0.5;
      float bend = (zig * 0.028 + micro * 0.01) * smoothstep(0.0, 0.18, u);
      float d = abs(v - bend);

      float taper = 1.0 - clamp(u / len, 0.0, 1.0);
      float w = 0.0018 + hash21(vec2(cyc, seed + 12.0)) * 0.0024 + 0.0010 * taper;
      float core = 1.0 - smoothstep(w * 0.9, w * 2.2, d);
      float edge = smoothstep(w * 1.6, w * 2.6, d) * (1.0 - smoothstep(w * 2.6, w * 7.0, d));
      float bloomEdge = smoothstep(w * 5.0, w * 7.5, d) * (1.0 - smoothstep(w * 7.5, w * 20.0, d)) * 0.3;
      float flicker = 0.7 + 0.3 * sin(t * 87.0 + seed * 31.0);
      float reach = smoothstep(0.0, 0.05, u) * smoothstep(len, len * 0.86, u);

      return vec2(core, edge + bloomEdge) * active * flicker * reach;
    }

    // A continuous, slowly re-forming arc that keeps the silhouette crackling.
    vec2 arcBolt(vec2 q, float angle, float seed, float t, float len) {
      float a = angle + sin(t * 0.23 + seed) * 0.5;
      vec2 dir = vec2(cos(a), sin(a));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 qb = q - vec2(0.0, -0.015);

      float u = dot(qb, dir) - 0.045;
      float v = dot(qb, perp);
      if (u < 0.0 || u > len) return vec2(0.0);

      float n1 = vnoise(vec2(u * 34.0, seed * 17.0 + t * 0.55)) - 0.5;
      float n2 = vnoise(vec2(u * 88.0, seed * 5.0 - t * 0.9)) - 0.5;
      float bend = (n1 * 0.06 + n2 * 0.02) * smoothstep(0.0, 0.25, u);
      float d = abs(v - bend);

      float taper = 1.0 - clamp(u / len, 0.0, 1.0);
      float w = 0.0015 + 0.0012 * taper;
      float core = 1.0 - smoothstep(w * 0.9, w * 2.2, d);
      float edge = smoothstep(w * 1.6, w * 2.6, d) * (1.0 - smoothstep(w * 2.6, w * 7.2, d)) * 0.95;
      float bloomEdge = smoothstep(w * 5.0, w * 7.5, d) * (1.0 - smoothstep(w * 7.5, w * 21.0, d)) * 0.28;
      float flicker = 0.6 + 0.4 * vnoise(vec2(t * 6.0, seed));
      float reach = smoothstep(0.0, 0.04, u) * smoothstep(len, len * 0.82, u);
      return vec2(core, edge + bloomEdge) * flicker * reach;
    }

    void main() {
      vec2 p = (vUv - uImg.xy) / uImg.zw;
      float ar = (uImg.z * uRes.x) / max(uImg.w * uRes.y, 1.0);
      vec2 q = (p - 0.5) * vec2(ar, 1.0);

      vec2 muv = uPad.xy + p * uPad.zw;
      vec4 sil = texture2D(uMask, muv);
      float sharp = sil.r;
      float mid = sil.g;
      float wide = sil.b;

      if (uDebug > 0.5) {
        gl_FragColor = vec4(0.0, mid, wide, 0.9);
        return;
      }

      float inside = smoothstep(0.34, 0.66, sharp);
      float outside = 1.0 - inside;
      float tight = clamp((mid - sharp) * 3.2, 0.0, 1.0) * outside;
      float rim = smoothstep(0.02, 0.30, mid) * outside;
      float halo = smoothstep(0.004, 0.16, wide) * outside;

      // Silhouette gradient gives a directional crimson rim light that
      // follows the real outline of the portrait.
      vec2 me = vec2(0.0035, 0.0035);
      float mL = texture2D(uMask, muv - vec2(me.x, 0.0)).g;
      float mR = texture2D(uMask, muv + vec2(me.x, 0.0)).g;
      float mD = texture2D(uMask, muv - vec2(0.0, me.y)).g;
      float mU = texture2D(uMask, muv + vec2(0.0, me.y)).g;
      vec2 grad = vec2(mR - mL, mU - mD);
      vec2 nrm = grad / max(length(grad), 0.0001);
      float lit = dot(nrm, normalize(vec2(-0.62, 0.78)));
      float edgeBand = 1.0 - smoothstep(0.02, 0.30, abs(sharp - 0.5));
      float rimLight = edgeBand * (0.30 + 0.70 * smoothstep(-0.25, 0.85, lit));

      float t = uTime;
      vec2 m = uMouse;
      float focus = 1.0 + 0.5 * uFocus;
      float burst = 1.0 + 0.9 * uBurst;

      // rising, warping energy field
      float radius0 = length(vec2(q.x, q.y * 0.92));
      float shimmer = sin(radius0 * 34.0 - t * 5.0) * exp(-pow((radius0 - 0.32) * 3.2, 2.0)) * 0.05;

      vec2 f = vec2(q.x * 3.4, q.y * 2.2);
      f.y += t * 0.22;
      f.x += q.y * 0.55 + sin(q.y * 6.0 + t * 0.55) * 0.26 + m.x * 0.35 + shimmer;
      f.y += m.y * 0.18;

      vec2 warp = vec2(
        vnoise(f * 0.9 + vec2(0.0, t * 0.07)),
        vnoise(f * 0.9 + vec2(4.6, -t * 0.06))
      );
      f += (warp - 0.5) * 2.8;

      float n = fbm(f * 1.25);
      float field = smoothstep(0.36, 0.84, n);

      float tongueN = fbm(vec2(p.x * 17.0 + q.y * 2.0, p.y * 4.6 - t * 1.05) + warp * 1.7);
      float tongues = smoothstep(0.44, 0.92, tongueN);
      float flameShape = tongues;

      float vert = mix(1.35, 0.55, smoothstep(0.0, 0.95, p.y));
      vert += smoothstep(0.68, 0.94, p.y) * 0.4;

      // A tall crown of upward flame spikes rising past the head.
      float crownBand = smoothstep(0.26, 0.60, p.y) * (1.0 - smoothstep(1.02, 1.56, p.y));
      float crownWidth = 1.0 - smoothstep(0.06, 0.56, abs(q.x));
      vec2 cp = p;
      cp.x += m.x * 0.022 * crownBand;
      cp.y += m.y * 0.012;
      float spikeFar = spikeField(cp * vec2(0.92, 0.94) + vec2(0.00, 0.10), t * 0.72, 3.1);
      float spikeMid = spikeField(cp * vec2(1.12, 1.00) + vec2(0.18, 0.03), t * 0.98, 8.7);
      float crown = (spikeFar * 0.62 + spikeMid * 0.40) * crownBand * crownWidth * outside;

      // Thin vertical rays that shoot beyond the flame mass.
      float rayN = vnoise(vec2(cp.x * 17.0 + t * 0.25, cp.y * 2.1 - t * 0.55)) + warp.x * 0.5;
      float rays = pow(max(0.0, sin(cp.x * 23.0 + rayN * 7.0 + t * 0.35)), 18.0);
      rays *= smoothstep(0.42, 0.72, p.y) * (1.0 - smoothstep(1.08, 1.62, p.y)) * crownWidth * outside;

      // A radial burst of pointed spikes around the head — the
      // Super-Saiyan crown that reads above the silhouette.
      vec2 hc = q - vec2(0.0, 0.34);
      float rad = length(hc);
      float ang = atan(hc.x, max(hc.y, 0.0001));
      float angN = vnoise(vec2(ang * 2.7 + t * 0.14, t * 0.2));
      float radialSpikes = pow(max(0.0, sin(ang * 9.0 + angN * 4.5 + t * 0.45)), 20.0);
      float radialBand = smoothstep(0.16, 0.28, rad) * (1.0 - smoothstep(0.38, 0.62, rad));
      radialBand *= 1.0 - smoothstep(0.72, 1.20, abs(ang));
      radialSpikes *= radialBand * outside;

      // Explicit tapered tongues: the layered spike crown.
      float flameCrown = 0.0;
      float crownBloom = 0.0;
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float seed = fract(sin(fi * 12.9898) * 43758.5453);
        float seed2 = fract(sin(fi * 78.233) * 43758.5453);
        float top = 1.08 + seed * 0.30 + sin(t * 0.9 + fi * 1.7) * 0.04;
        float baseW = 0.020 + seed2 * 0.022;
        float yn = clamp((p.y - 0.24) / max(top - 0.24, 0.001), 0.0, 1.0);
        float w = baseW * pow(max(1.0 - yn, 0.0), 0.66);
        float cx = (fi - 2.5) * 0.064 + sin(t * 0.72 + fi * 1.9) * 0.05 * yn * yn;
        cx += (vnoise(vec2(seed * 11.0, p.y * 3.4 + t * 0.8)) - 0.5) * 0.055 * yn;
        float dx = abs(q.x - cx);
        float body = 1.0 - smoothstep(w * 0.15, w, dx);
        float wide = 1.0 - smoothstep(w * 1.6, w * 4.2, dx);
        float vmask = smoothstep(0.24, 0.33, p.y) * (1.0 - smoothstep(top - 0.045, top, p.y));
        float flick = 0.72 + 0.28 * sin(t * (1.3 + fi * 0.11) + fi * 3.1);
        flameCrown += body * vmask * flick;
        crownBloom += wide * vmask * flick * 0.24;
      }
      flameCrown *= crownWidth * outside;
      crownBloom *= crownWidth * outside;

      float energy = 0.0;
      energy += (rim * 1.45 + tight * 0.8) * (0.25 + 1.65 * tongues) * (0.45 + field) * vert;
      energy += halo * flameShape * (0.55 + 0.9 * field) * 1.75 * vert;
      energy += halo * 0.11 * (0.75 + 0.25 * sin(t * 1.4));
      energy += crown * (1.45 + 1.15 * field) * (0.55 + 0.55 * halo + 0.35 * rim) * (0.78 + 0.22 * sin(t * 2.0));
      energy += rays * (1.05 + 0.8 * field) * (0.35 + 0.65 * halo);
      energy += radialSpikes * (1.15 + 0.85 * field) * (0.45 + 0.55 * sin(t * 1.7)) * 0.95;
      energy += flameCrown * (3.1 + 1.5 * field) * (0.65 + 0.35 * sin(t * 1.4 + 1.0));
      energy += crownBloom * (1.7 + 0.9 * field) * (0.7 + 0.3 * sin(t * 1.1 + 0.5));
      energy += rimLight * (0.85 + 0.55 * sin(t * 2.4)) * (0.5 + 0.8 * tongues);
      energy *= focus * burst;

      // pressure shockwaves
      float radius = length(vec2(q.x, q.y * 0.92));
      float rings = 0.0;
      for (int i = 0; i < 2; i++) {
        float ph = fract(t * 0.24 + float(i) * 0.5);
        float rr = mix(0.03, 0.66, ph);
        float wob = (vnoise(q * 7.0 + t * 0.5 + float(i) * 10.0) - 0.5) * 0.02 * (0.4 + ph);
        float d = abs(radius + wob - rr);
        float ringCore = (1.0 - smoothstep(0.0, 0.005, d)) * (1.0 - ph);
        float ringBand = (1.0 - smoothstep(0.0, 0.035, d)) * (1.0 - ph) * 0.35;
        rings += (ringCore + ringBand) * smoothstep(0.0, 0.12, ph);
      }
      rings *= smoothstep(0.80, 0.20, radius) * outside * (0.5 + 0.8 * uBurst);
      energy += rings * 0.95;

      // dark pressure cloud
      float smoke = smoothstep(0.26, 0.86, fbm(q * 4.6 + vec2(t * 0.05, -t * 0.09) + warp * 1.6));
      float cloudA = smoothstep(0.0, 0.26, wide) * outside * (0.12 + 0.36 * smoke) * (0.7 + 0.6 * uBurst);

      // vertical energy bands
      float band = sin(p.y * 13.0 - t * 2.1 + n * 6.0);
      energy += smoothstep(0.90, 1.0, band) * (rim * 0.45 + halo * 0.5) * 0.9;

      // embers and fast rising sparks
      float part = embers(q, t, 26.0, 2.1) + embers(q, t, 47.0, 7.7) * 0.65;
      part *= 0.08 + halo * 2.0 + rim * 0.3;
      energy += part * 2.0;

      float streak = sparkStreaks(q, t, 17.0, 5.3) + sparkStreaks(q, t, 31.0, 11.1) * 0.62;
      streak *= 0.04 + halo * 1.6 + rim * 0.4 + crown * 0.55;
      energy += streak * 2.6;

      // strands licking over the lower body
      float lower = 1.0 - smoothstep(0.48, 0.70, p.y);
      energy += tongues * inside * lower * 0.45;

      float e = max(energy, 0.0);
      float a = 1.0 - exp(-e * 1.25);
      a = clamp(a * uIntensity * (0.85 + 0.3 * uBurst), 0.0, 1.0);

      // soft canvas border so the field never shows a cut
      float edgeFade = smoothstep(0.0, 0.11, vUv.x) * smoothstep(1.0, 0.89, vUv.x)
                     * smoothstep(0.0, 0.10, vUv.y) * smoothstep(1.0, 0.90, vUv.y);
      a *= edgeFade;

      vec3 c1 = vec3(0.18, 0.0, 0.055);
      vec3 c2 = vec3(0.42, 0.0, 0.105);
      vec3 c3 = vec3(0.69, 0.0, 0.125);
      vec3 c4 = vec3(1.0, 0.09, 0.267);
      vec3 col = mix(c1, c2, smoothstep(0.0, 0.35, e));
      col = mix(col, c3, smoothstep(0.25, 0.75, e));
      col = mix(col, c4, smoothstep(0.70, 1.50, e));
      col = mix(col, vec3(1.0, 0.32, 0.45), smoothstep(1.60, 2.60, e) * 0.4);
      col = mix(col, vec3(1.0, 0.82, 0.87), smoothstep(2.40, 4.40, e) * 0.46);

      // crimson rim light on the silhouette itself
      float rimGlow = clamp(rimLight * (0.65 + 0.35 * sin(t * 2.4)) * (0.7 + 0.5 * uBurst), 0.0, 1.0);
      col = mix(col, vec3(1.0, 0.48, 0.58), rimGlow * 0.8);
      a = max(a, rimGlow * 0.72 * edgeFade);

      // pressure cloud darkens the surrounding air
      col = mix(col, vec3(0.035, 0.0, 0.012), cloudA * 0.85);
      a = max(a, cloudA * 0.5 * edgeFade);

      // burst flare around the pressure core
      float flare = uBurst * exp(-radius * 3.2) * outside * 0.55;
      col = mix(col, vec3(1.0, 0.24, 0.36), flare);
      a = max(a, flare * 0.55);

      // shockwave crimson
      float wave = clamp(rings * 0.9, 0.0, 1.0) * edgeFade;
      col = mix(col, vec3(1.0, 0.32, 0.42), wave * 0.9);
      a = max(a, wave * 0.8);

      // lightning — black core, crimson halo
      vec2 b1 = lightning(q, 1.3, t);
      vec2 b2 = lightning(q, 7.1, t);
      vec2 b3 = lightning(q, 13.7, t);
      vec2 b4 = lightning(q, 21.3, t * 1.6);
      vec2 a1 = arcBolt(q, 2.60, 3.3, t, 0.55) * 1.25;
      vec2 a2 = arcBolt(q, 0.60, 9.1, t, 0.50) * 1.25;

      float bCore = clamp(b1.x + b2.x + b3.x + b4.x * uBurst + (a1.x + a2.x) * 0.9, 0.0, 1.0);
      float bEdge = clamp(b1.y + b2.y + b3.y + b4.y * uBurst + (a1.y + a2.y) * 1.1, 0.0, 1.0);

      float boltMask = outside + inside * lower * 0.55;
      bCore *= boltMask * (0.8 + 0.5 * uBurst);
      bEdge *= boltMask * (0.8 + 0.8 * uBurst);

      // electric crackle clinging to the silhouette
      float crackleN = ridges(vec2(p.x * 55.0 + t * 1.1, p.y * 34.0 - t * 2.2));
      float crackle = smoothstep(0.90, 1.0, crackleN) * tight * (0.7 + 0.6 * uBurst);
      bCore = clamp(bCore + crackle * 0.9, 0.0, 1.0);
      bEdge = clamp(bEdge + crackle * 1.3, 0.0, 1.0);

      // black lightning is negative space inside the glow, with a crimson rim
      a *= (1.0 - bCore * 0.96);
      col = mix(col, vec3(1.0, 0.2, 0.4), bEdge);
      a = max(a, bEdge * 0.72);

      gl_FragColor = vec4(col, a);
    }
  `;

  const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("Aura shader error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const parsePos = (value, freeSpace) => {
    if (value === "center") return freeSpace * 0.5;
    if (value === "left" || value === "top") return 0;
    if (value === "right" || value === "bottom") return freeSpace;
    if (value.endsWith("%")) return freeSpace * (parseFloat(value) / 100);
    return parseFloat(value) || 0;
  };

  const createAuraField = (options) => {
    const cfg = Object.assign(
      {
        layerRatio: [2.3, 1.74],
        budget: 520000,
        budgetSmall: 190000,
        fps: 45,
        fpsSmall: 30,
        intensity: 1.15,
        startDelay: 900,
        fallbackClass: "no-aura",
        debugParam: "auraDebug",
        timeParam: "auraTime",
        burstParam: "auraBurst",
        focusEl: null,
        shakeEl: null
      },
      options
    );

    const canvas = cfg.canvas;
    const layer = cfg.layer;
    const box = cfg.box;
    const img = cfg.img;
    const focusEl = cfg.focusEl || box;
    const shakeEl = cfg.shakeEl;
    if (!canvas || !layer || !box || !img || !cfg.mask) return null;

    const root = document.documentElement;
    const fail = () => root.classList.add(cfg.fallbackClass);

    const gl = (() => {
      try {
        return canvas.getContext("webgl", {
          alpha: true,
          premultipliedAlpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: "low-power"
        });
      } catch {
        return null;
      }
    })();

    if (!gl) {
      fail();
      return null;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();

    if (!vs || !fs || !program) {
      fail();
      return null;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Aura link error:", gl.getProgramInfoLog(program));
      fail();
      return null;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = {
      mask: gl.getUniformLocation(program, "uMask"),
      img: gl.getUniformLocation(program, "uImg"),
      pad: gl.getUniformLocation(program, "uPad"),
      res: gl.getUniformLocation(program, "uRes"),
      mouse: gl.getUniformLocation(program, "uMouse"),
      time: gl.getUniformLocation(program, "uTime"),
      intensity: gl.getUniformLocation(program, "uIntensity"),
      focus: gl.getUniformLocation(program, "uFocus"),
      burst: gl.getUniformLocation(program, "uBurst"),
      debug: gl.getUniformLocation(program, "uDebug")
    };

    gl.uniform4f(U.pad, cfg.pad[0], cfg.pad[1], cfg.pad[2], cfg.pad[3]);
    gl.uniform1i(U.mask, 0);
    gl.uniform1f(U.intensity, cfg.intensity);
    gl.uniform1f(U.debug, params.has(cfg.debugParam) ? 1 : 0);
    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    /* ── Geometry helpers ───────────────────────────────────── */
    const imageRect = (boxW, boxH) => {
      const nw = img.naturalWidth || Number(img.getAttribute("width")) || 924;
      const nh = img.naturalHeight || Number(img.getAttribute("height")) || 1488;
      if (!boxW || !boxH || !nw || !nh) return null;

      const style = getComputedStyle(img);
      const fit = style.objectFit === "cover" ? Math.max : Math.min;
      const scale = fit(boxW / nw, boxH / nh);
      const width = nw * scale;
      const height = nh * scale;
      const pos = style.objectPosition.split(" ");

      return {
        x: parsePos(pos[0], boxW - width),
        y: parsePos(pos[1] || "50%", boxH - height),
        w: width,
        h: height
      };
    };

    const setLayerSize = () => {
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      if (!w || !h) return;
      layer.style.width = `${Math.round(w * cfg.layerRatio[0])}px`;
      layer.style.height = `${Math.round(h * cfg.layerRatio[1])}px`;
    };

    const updateRect = () => {
      const W = box.offsetWidth;
      const H = box.offsetHeight;
      const CW = layer.offsetWidth;
      const CH = layer.offsetHeight;
      if (!W || !H || !CW || !CH) return;

      const rect = imageRect(W, H);
      if (!rect) return;

      const originX = (W - CW) * 0.5;
      const originY = (H - CH) * 0.5;

      gl.uniform4f(
        U.img,
        (rect.x - originX) / CW,
        1 - (rect.y + rect.h - originY) / CH,
        rect.w / CW,
        rect.h / CH
      );
    };

    const resize = () => {
      setLayerSize();
      const cssW = layer.offsetWidth;
      const cssH = layer.offsetHeight;
      if (!cssW || !cssH) return;

      const small = compact.matches || coarse.matches;
      const budget = small ? cfg.budgetSmall : cfg.budget;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const rawW = cssW * dpr;
      const rawH = cssH * dpr;
      const scale = Math.min(1, Math.sqrt(budget / (rawW * rawH)));
      const w = Math.max(2, Math.round(rawW * scale));
      const h = Math.max(2, Math.round(rawH * scale));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(U.res, w, h);
      updateRect();
    };

    /* ── Pointer influence ──────────────────────────────────── */
    let targetX = 0;
    let targetY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetFocus = 0;
    let focus = 0;

    if (!coarse.matches) {
      window.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") return;
        targetX = (event.clientX / window.innerWidth) * 2 - 1;
        targetY = (event.clientY / window.innerHeight) * 2 - 1;

        const r = focusEl.getBoundingClientRect();
        const nx = (event.clientX - (r.left + r.width * 0.5)) / Math.max(r.width * 0.75, 1);
        const ny = (event.clientY - (r.top + r.height * 0.5)) / Math.max(r.height * 0.75, 1);
        targetFocus = Math.max(0, 1 - Math.sqrt(nx * nx + ny * ny));
      }, { passive: true });
    }

    /* ── Render / bursts ────────────────────────────────────── */
    let time = 0;
    let last = 0;
    let raf = null;
    let visible = true;
    let burstStart = -1e9;
    let nextBurst = 0;
    let shaking = 0;
    const interval = compact.matches || coarse.matches ? 1000 / cfg.fpsSmall : 1000 / cfg.fps;

    const setShake = (x, y) => {
      if (!shakeEl) return;
      shakeEl.style.setProperty("--shake-x", `${x.toFixed(2)}px`);
      shakeEl.style.setProperty("--shake-y", `${y.toFixed(2)}px`);
    };

    const draw = (now) => {
      gl.uniform1f(U.time, time);
      gl.uniform2f(U.mouse, mouseX, mouseY);
      gl.uniform1f(U.focus, focus);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (now && !reduceMotion.matches) {
        if (now > nextBurst) {
          burstStart = now;
          nextBurst = now + 5500 + Math.random() * 4200;
        }
        const elapsed = now - burstStart;
        let burst = 0;
        if (elapsed >= 0 && elapsed < 750) {
          const k = elapsed / 750;
          burst = Math.sin(k * Math.PI) * (0.72 + 0.28 * Math.sin(k * 23));
        }
        gl.uniform1f(U.burst, burst);

        if (burst > 0.015) {
          const amp = 2.9 * burst;
          setShake(Math.sin(now * 0.058) * amp, Math.cos(now * 0.072) * amp * 0.8);
          shaking = now;
        } else if (shaking && now - shaking > 90) {
          setShake(0, 0);
          shaking = 0;
        }
      }
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) {
        last = now;
        return;
      }
      const elapsed = now - last;
      if (elapsed < interval - 0.5) return;

      last = now - (elapsed % interval);
      time += elapsed / 1000;
      mouseX += (targetX - mouseX) * 0.045;
      mouseY += (targetY - mouseY) * 0.045;
      focus += (targetFocus - focus) * 0.05;
      draw(now);
    };

    const start = () => {
      if (raf !== null || reduceMotion.matches) return;
      last = performance.now();
      nextBurst = last + 2200;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };

    /* ── Boot ───────────────────────────────────────────────── */
    const maskImage = new Image();
    maskImage.decoding = "async";
    maskImage.src = cfg.mask;

    const boot = () => {
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, maskImage);
      } catch {
        fail();
        return;
      }

      resize();
      canvas.classList.add("is-live");

      clearTimeout(boot.rectTimer);
      boot.rectTimer = setTimeout(resize, 2200);

      const freezeTime = params.has(cfg.timeParam) ? parseFloat(params.get(cfg.timeParam)) : NaN;

      if (Number.isFinite(freezeTime)) {
        time = freezeTime;
        mouseX = 0.18;
        mouseY = 0.05;
        focus = 0.5;
        gl.uniform1f(U.burst, params.has(cfg.burstParam) ? parseFloat(params.get(cfg.burstParam)) : 0.25);
        draw(0);
        return;
      }

      if (reduceMotion.matches) {
        time = 9.0;
        mouseX = 0.22;
        mouseY = 0.08;
        gl.uniform1f(U.burst, 0.35);
        draw(0);
      } else {
        // Let the entrance choreography paint first, then bring the
        // continuous field online. This keeps first paint cheap.
        clearTimeout(boot.startTimer);
        boot.startTimer = setTimeout(start, cfg.startDelay);
      }
    };

    if (maskImage.decode) {
      maskImage.decode().then(boot).catch(boot);
    } else if (maskImage.complete) {
      boot();
    } else {
      maskImage.addEventListener("load", boot, { once: true });
    }

    /* ── Lifecycle ──────────────────────────────────────────── */
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    };

    window.addEventListener("resize", onResize, { passive: true });
    if ("ResizeObserver" in window) {
      new ResizeObserver(onResize).observe(box);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }, { rootMargin: "140px" }).observe(focusEl);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else if (visible) start();
    });

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      stop();
      clearTimeout(boot.startTimer);
      fail();
    });

    reduceMotion.addEventListener?.("change", (event) => {
      if (event.matches) {
        stop();
        setShake(0, 0);
        time = 9.0;
        gl.uniform1f(U.burst, 0.35);
        draw(0);
      } else {
        start();
      }
    });

    return { resize };
  };

  window.AuraField = { create: createAuraField };
})();
