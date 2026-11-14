/* ============================================================
   FLOATING MUGIWARA — a procedural straw hat in WebGL
   ------------------------------------------------------------
   No model files, no libraries. The hat is lofted from a crown,
   a woven brim and a satin ribbon, then lit with the same black /
   maroon palette as the rest of the page.

   The canvas is locked to the portrait's head: every frame its
   box is derived from the rendered <img> rect, so the hat follows
   the head through the entrance scale, the idle float, the scroll
   and the pointer tilt.
   ============================================================ */
(() => {
  const layer = document.querySelector("[data-hat-layer]");
  const box = document.querySelector("[data-hat]");
  const canvas = document.querySelector("[data-hat-canvas]");
  const img = document.querySelector(".portrait__media picture img");
  if (!layer || !box || !canvas || !img) return;

  const attrs = {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    depth: true,
    powerPreference: "high-performance"
  };
  const gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
  if (!gl) return;

  /* ----------------------------------------------------------
     Portrait metrics (image space, measured from the cut-out)
     ---------------------------------------------------------- */
  const IMG_W = 924;
  const IMG_H = 1488;
  const HEAD_X = 450;   // horizontal centre of the head
  const HEAD_TOP = 26;  // top of the hair
  const HEAD_W = 371;   // hair width at its widest

  // Where the hat rests on the upper back, in image fractions.
  const BACK_X = 0.74;
  const BACK_Y = 0.34;
  const HAT_SCALE = 1.3; // brim diameter / head width

  const DEBUG = window.location.search.includes("hatDebug");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 900px)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ----------------------------------------------------------
     Small matrix kit
     ---------------------------------------------------------- */
  const mat4 = () => new Float32Array(16);

  function identity(out) {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
  }

  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) / (near - far); out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = (2 * far * near) / (near - far); out[15] = 0;
    return out;
  }

  function lookAt(out, eye, center, up) {
    let zx = eye[0] - center[0];
    let zy = eye[1] - center[1];
    let zz = eye[2] - center[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function multiply(out, a, b) {
    for (let c = 0; c < 4; c += 1) {
      const b0 = b[c * 4];
      const b1 = b[c * 4 + 1];
      const b2 = b[c * 4 + 2];
      const b3 = b[c * 4 + 3];
      out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  }

  function modelMatrix(out, ax, ay, az, ty) {
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const cz = Math.cos(az), sz = Math.sin(az);

    // R = Ry * Rx * Rz
    const m00 = cy * cz + sy * sx * sz;
    const m01 = -cy * sz + sy * sx * cz;
    const m02 = sy * cx;
    const m10 = cx * sz;
    const m11 = cx * cz;
    const m12 = -sx;
    const m20 = -sy * cz + cy * sx * sz;
    const m21 = sy * sz + cy * sx * cz;
    const m22 = cy * cx;

    out[0] = m00; out[1] = m10; out[2] = m20; out[3] = 0;
    out[4] = m01; out[5] = m11; out[6] = m21; out[7] = 0;
    out[8] = m02; out[9] = m12; out[10] = m22; out[11] = 0;
    out[12] = 0; out[13] = ty; out[14] = 0; out[15] = 1;
    return out;
  }

  /* ----------------------------------------------------------
     Geometry
     One interleaved buffer: position, normal, straw coords, flex.
     ---------------------------------------------------------- */
  const TAU = Math.PI * 2;
  const P = [];
  const N3 = [];
  const S2 = [];
  const F = [];
  const IDX = [];
  const parts = {};

  function surface(nu, nv, fn) {
    const start = P.length / 3;
    const iStart = IDX.length;
    const row = nu + 1;
    for (let j = 0; j <= nv; j += 1) {
      for (let i = 0; i <= nu; i += 1) {
        const v = fn(i / nu, j / nv);
        P.push(v.p[0], v.p[1], v.p[2]);
        N3.push(v.n[0], v.n[1], v.n[2]);
        S2.push(v.s[0], v.s[1]);
        F.push(v.f || 0);
      }
    }
    for (let j = 0; j < nv; j += 1) {
      for (let i = 0; i < nu; i += 1) {
        const a = start + j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        IDX.push(a, c, b, b, c, d);
      }
    }
    return [iStart, IDX.length - iStart];
  }

  const SEG = 176;
  const R0 = 0.42;

  function brimY(t) {
    return 0.022 * Math.sin(Math.PI * t) - 0.088 * Math.pow(t, 2.2);
  }
  function brimDY(t) {
    return 0.022 * Math.PI * Math.cos(Math.PI * t) - 0.088 * 2.2 * Math.pow(t, 1.2);
  }

  /* woven brim */
  parts.brim = surface(SEG, 20, (u, v) => {
    const th = u * TAU;
    const r = R0 + (1 - R0) * v;
    const y = brimY(v);
    const dr = 1 - R0;
    const dy = brimDY(v);
    let nr = -dy;
    let ny = dr;
    const len = Math.hypot(nr, ny) || 1;
    nr /= len; ny /= len;
    return {
      p: [r * Math.sin(th), y, r * Math.cos(th)],
      n: [nr * Math.sin(th), ny, nr * Math.cos(th)],
      s: [u, v]
    };
  });

  /* thin outer edge, so the silhouette of the brim reads as a solid */
  parts.edge = surface(SEG, 1, (u, v) => {
    const th = u * TAU;
    const y = brimY(1) - 0.055 * v;
    const r = 1 - 0.024 * v;
    return {
      p: [r * Math.sin(th), y, r * Math.cos(th)],
      n: [Math.sin(th) * 0.94, 0.34, Math.cos(th) * 0.94],
      s: [u, 0.94 + v * 0.06]
    };
  });

  /* crown, lofted from a profile — low and gently domed, the way a
     straw hat sits, so the wide brim stays the dominant shape */
  const CROWN = [
    [0.412, -0.012],
    [0.432, 0.03],
    [0.438, 0.088],
    [0.436, 0.142],
    [0.428, 0.196],
    [0.414, 0.244],
    [0.392, 0.288],
    [0.360, 0.322],
    [0.315, 0.349],
    [0.245, 0.369],
    [0.155, 0.383],
    [0.075, 0.391],
    [0.0, 0.394]
  ];

  parts.crown = surface(SEG, CROWN.length - 1, (u, j) => {
    const f = j * (CROWN.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(CROWN.length - 1, i0 + 1);
    const k = f - i0;
    const r = CROWN[i0][0] + (CROWN[i1][0] - CROWN[i0][0]) * k;
    const y = CROWN[i0][1] + (CROWN[i1][1] - CROWN[i0][1]) * k;
    const a = CROWN[Math.max(0, i0 - 1)];
    const b = CROWN[Math.min(CROWN.length - 1, i1 + 1)];
    const dr = b[0] - a[0];
    const dy = b[1] - a[1];
    let nr = dy;
    let ny = -dr;
    const len = Math.hypot(nr, ny) || 1;
    nr /= len; ny /= len;
    if (j === CROWN.length - 1) { nr = 0; ny = 1; }
    const th = u * TAU;
    return {
      p: [r * Math.sin(th), y, r * Math.cos(th)],
      n: [nr * Math.sin(th), ny, nr * Math.cos(th)],
      s: [u, 2 + j / (CROWN.length - 1)]
    };
  });

  /* red ribbon band — a band around the base of the crown, not a cap */
  const RIB = [
    [0.441, 0.05],
    [0.449, 0.064],
    [0.446, 0.138],
    [0.437, 0.152]
  ];
  parts.ribbon = surface(SEG, RIB.length - 1, (u, j) => {
    const f = j * (RIB.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(RIB.length - 1, i0 + 1);
    const k = f - i0;
    const r = RIB[i0][0] + (RIB[i1][0] - RIB[i0][0]) * k;
    const y = RIB[i0][1] + (RIB[i1][1] - RIB[i0][1]) * k;
    const dr = r - RIB[i0][0];
    const dy = y - RIB[i0][1];
    const a = RIB[Math.max(0, i0 - 1)];
    const b = RIB[Math.min(RIB.length - 1, i1 + 1)];
    let nr = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const len = Math.hypot(nr, ny) || 1;
    nr /= len; ny /= len;
    if (j === 0) { nr *= 0.7; ny = 0.7; }
    if (j === RIB.length - 1) { nr *= 0.7; ny = -0.7; }
    const th = u * TAU;
    return {
      p: [r * Math.sin(th), y, r * Math.cos(th)],
      n: [nr * Math.sin(th), ny, nr * Math.cos(th)],
      s: [u, j / (RIB.length - 1)]
    };
  });

  /* ribbon knot at the front */
  parts.knot = surface(26, 14, (u, v) => {
    const th = u * TAU;
    const ph = v * Math.PI;
    const sx = 0.088;
    const sy = 0.072;
    const sz = 0.058;
    const x = Math.sin(ph) * Math.cos(th) * sx;
    const y = Math.cos(ph) * sy;
    const z = Math.sin(ph) * Math.sin(th) * sz;
    const nn = [x / (sx * sx), y / (sy * sy), z / (sz * sz)];
    const len = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    return {
      p: [x, y + 0.125, z + 0.447],
      n: [nn[0] / len, nn[1] / len, nn[2] / len],
      s: [u, v]
    };
  });

  /* short trailing ribbon that sways */
  parts.tail = surface(8, 16, (u, v) => {
    const s = v;
    const cx = -0.06 - 0.26 * s;
    const cy = 0.126 - 0.1 * Math.pow(s, 1.7);
    const cz = 0.45 - 0.09 * s;
    const w = 0.06 * (1 - 0.45 * s);
    const off = (u - 0.5) * w;
    const dx = -0.12;
    const dz = -1;
    const dl = Math.hypot(dx, dz);
    return {
      p: [cx + (dz / dl) * off * -1, cy + Math.sin(u * Math.PI) * 0.007, cz + (dx / dl) * off],
      n: [0, 1, 0],
      s: [u, s],
      f: s
    };
  });

  /* ----------------------------------------------------------
     Shaders
     ---------------------------------------------------------- */
  const VERT = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    attribute vec2 aStraw;
    attribute float aFlex;

    uniform mat4 uMVP;
    uniform mat4 uModel;
    uniform vec2 uFitScale;
    uniform vec2 uFitOffset;
    uniform float uTime;

    varying vec3 vNormal;
    varying vec3 vWorld;
    varying vec2 vStraw;
    varying float vKind;

    void main() {
      vec3 p = aPos;
      float f = aFlex;
      if (f > 0.001) {
        float w = f * f;
        p.x += sin(uTime * 1.15 + f * 3.4) * 0.03 * w;
        p.y += cos(uTime * 0.9 + f * 2.6) * 0.018 * w;
        p.z += sin(uTime * 0.75 + f * 1.8) * 0.016 * w;
      }
      vec4 world = uModel * vec4(p, 1.0);
      vWorld = world.xyz;
      vNormal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
      vStraw = aStraw;
      vKind = aStraw.y;
      vec4 clip = uMVP * vec4(p, 1.0);
      clip.xy = clip.xy * uFitScale + uFitOffset * clip.w;
      gl_Position = clip;
    }
  `;

  const FRAG = `
    precision highp float;

    uniform vec3 uCam;
    uniform vec3 uKeyDir;
    uniform vec3 uLightCol;
    uniform int uMat;
    uniform float uTime;

    varying vec3 vNormal;
    varying vec3 vWorld;
    varying vec2 vStraw;

    const float TAU = 6.2831853;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    vec3 finish(vec3 albedo, vec3 n, float gloss) {
      vec3 v = normalize(uCam - vWorld);
      float ndl = max(dot(n, uKeyDir), 0.0);
      float halo = max(dot(n, normalize(vec3(-0.35, 0.35, -0.9))), 0.0);
      float fill = max(dot(n, normalize(vec3(0.75, -0.1, 0.55))), 0.0);

      vec3 col = albedo * (uLightCol * (0.35 + 0.85 * ndl));
      col += albedo * vec3(0.30, 0.02, 0.06) * fill;
      col += albedo * vec3(0.10, 0.01, 0.03);

      // crimson rim from the Haki field behind the head
      float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6);
      col += vec3(0.92, 0.05, 0.16) * rim * (0.1 + 0.2 * halo);

      // pale edge so the crown separates from the black page
      col += vec3(0.85, 0.72, 0.62) * pow(1.0 - max(dot(n, v), 0.0), 4.5) * 0.14;

      vec3 h = normalize(uKeyDir + v);
      col += uLightCol * pow(max(dot(n, h), 0.0), gloss) * (uMat == 0 ? 0.1 : 0.45);

      return col;
    }

    void main() {
      vec3 n = normalize(vNormal);

      vec3 albedo;
      float gloss = 26.0;

      if (uMat == 0) {
        float u = vStraw.x;
        float raw = vStraw.y;
        float crown = step(1.5, raw);
        float w = raw - crown * 2.0;
        float rows = mix(27.0, 17.0, crown);
        float wobble = (vnoise(vec2(u * 6.0, w * 3.0)) - 0.5) * 0.22;
        float rp = w * rows + wobble;
        float f = fract(rp);
        float coil = sin(f * 3.14159);
        float groove = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.88, 1.0, f));
        float freq = mix(30.0, 17.0, crown);
        float braidA = 0.5 + 0.5 * sin((u * freq + rp * 0.9) * TAU);
        float braidB = 0.5 + 0.5 * sin((u * freq - rp * 0.9) * TAU);
        float weave = mix(braidA, braidB, 0.5);
        float stitch = smoothstep(0.35, 0.92, sin((u * 92.0 + rp * 3.4) * TAU) * 0.5 + 0.5);
        float fiber = vnoise(vec2(u * 190.0, w * 40.0));
        float mottle = vnoise(vec2(u * 9.0, w * 4.0));
        float strand = hash(vec2(floor(u * 34.0), floor(rp)));
        float shade = coil * 0.44 + weave * mix(0.3, 0.2, crown) + stitch * 0.16 +
                      fiber * 0.13 + mottle * 0.24 + strand * 0.1;
        vec3 dark = vec3(0.21, 0.16, 0.095);
        vec3 light = vec3(0.94, 0.86, 0.66);
        albedo = mix(dark, light, clamp(0.3 + shade * 0.76, 0.0, 1.0));
        albedo *= mix(0.76, 1.0, groove);
        albedo *= 0.86 + 0.26 * mottle;
        albedo *= 0.94 + 0.12 * strand;
        albedo = mix(albedo, albedo * vec3(1.0, 0.94, 0.9), 0.55);
        gloss = 24.0;
      } else {
        float warp = 0.5 + 0.5 * sin((vStraw.x * 130.0 + vStraw.y * 26.0) * TAU);
        float weft = 0.5 + 0.5 * sin((vStraw.x * 130.0 - vStraw.y * 26.0) * TAU);
        albedo = vec3(0.56, 0.008, 0.082) * (0.74 + 0.4 * mix(warp, weft, 0.5));
        gloss = 34.0;
      }

      // the underside of the brim drops into shadow
      float under = smoothstep(0.0, -0.55, n.y);
      albedo *= 1.0 - 0.4 * under;

      vec3 col = finish(albedo, n, gloss);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ----------------------------------------------------------
     Program
     ---------------------------------------------------------- */
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("hat shader", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("hat program", gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const U = {
    mvp: gl.getUniformLocation(program, "uMVP"),
    model: gl.getUniformLocation(program, "uModel"),
    cam: gl.getUniformLocation(program, "uCam"),
    key: gl.getUniformLocation(program, "uKeyDir"),
    light: gl.getUniformLocation(program, "uLightCol"),
    mat: gl.getUniformLocation(program, "uMat"),
    time: gl.getUniformLocation(program, "uTime"),
    scale: gl.getUniformLocation(program, "uFitScale"),
    offset: gl.getUniformLocation(program, "uFitOffset")
  };

  /* vertex data */
  const vertCount = P.length / 3;
  const packed = new Float32Array(vertCount * 9);
  for (let i = 0; i < vertCount; i += 1) {
    packed[i * 9] = P[i * 3];
    packed[i * 9 + 1] = P[i * 3 + 1];
    packed[i * 9 + 2] = P[i * 3 + 2];
    packed[i * 9 + 3] = N3[i * 3];
    packed[i * 9 + 4] = N3[i * 3 + 1];
    packed[i * 9 + 5] = N3[i * 3 + 2];
    packed[i * 9 + 6] = S2[i * 2];
    packed[i * 9 + 7] = S2[i * 2 + 1];
    packed[i * 9 + 8] = F[i];
  }

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(IDX), gl.STATIC_DRAW);

  function attribute(name, size, offset) {
    const loc = gl.getAttribLocation(program, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 36, offset);
  }
  attribute("aPos", 3, 0);
  attribute("aNormal", 3, 12);
  attribute("aStraw", 2, 24);
  attribute("aFlex", 1, 32);

  /* ----------------------------------------------------------
     Camera: framed around the hat, then fitted into the canvas
     ---------------------------------------------------------- */
  const FOV = (17.6 * Math.PI) / 180;
  const EYE = [0, 1.34, 3.46];
  const CENTER = [0, 0.1, 0];
  const VIEW = lookAt(mat4(), EYE, CENTER, [0, 1, 0]);

  const samples = [];
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * TAU;
    samples.push([Math.sin(a), brimY(1), Math.cos(a)]);
  }
  samples.push([0, 0.419, 0], [0, -0.08, 0]);


  function project(pv, x, y, z) {
    const cx = pv[0] * x + pv[4] * y + pv[8] * z + pv[12];
    const cy = pv[1] * x + pv[5] * y + pv[9] * z + pv[13];
    const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    return [cx / cw, cy / cw];
  }

  function measureBounds(pv) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let i = 0; i < samples.length; i += 1) {
      const s = samples[i];
      const p = project(pv, s[0], s[1], s[2]);
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return { minX, maxX, minY, maxY };
  }

  const probe = multiply(mat4(), perspective(mat4(), FOV, 1, 0.4, 12), VIEW);
  const square = measureBounds(probe);
  const NATURAL = (square.maxX - square.minX) / ((square.maxY - square.minY) * 1.16);

  const proj = perspective(mat4(), FOV, NATURAL, 0.4, 12);
  const pv = multiply(mat4(), proj, VIEW);
  const bounds = measureBounds(pv);

  const fill = Math.min(1.66 / (bounds.maxX - bounds.minX), 1.74 / (bounds.maxY - bounds.minY));
  const fitOffset = [
    -((bounds.minX + bounds.maxX) / 2) * fill,
    -((bounds.minY + bounds.maxY) / 2) * fill
  ];

  const fitted = (x, y, z) => {
    const p = project(pv, x, y, z);
    return [(p[0] * fill + fitOffset[0] + 1) / 2, (1 - (p[1] * fill + fitOffset[1])) / 2];
  };

  // lowest silhouette point of the brim, and the brim centre
  let front = { x: 0.5, y: -1e9 };
  const rimPts = [];
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * TAU;
    const p = fitted(Math.sin(a), brimY(1), Math.cos(a));
    rimPts.push(p);
    if (p[1] > front.y) front = { x: p[0], y: p[1] };
  }
  const side = rimPts.reduce(
    (acc, p) => [Math.min(acc[0], p[0]), Math.max(acc[1], p[0])],
    [1, 0]
  );
  const brimFrac = Math.max(0.2, side[1] - side[0]);
  const centre = fitted(0, 0, 0);

  if (DEBUG) {
    window.__hatFit = { NATURAL, bounds, fill, brimFrac, front, centre };
  }

  /* ----------------------------------------------------------
     Scene state
     ---------------------------------------------------------- */
  const MODEL = mat4();
  const MVP = mat4();
  const keyDir = [-0.42, 0.86, 0.46];
  const keyLen = Math.hypot(keyDir[0], keyDir[1], keyDir[2]);
  keyDir[0] /= keyLen;
  keyDir[1] /= keyLen;
  keyDir[2] /= keyLen;

  const ORDER = ["brim", "edge", "crown", "ribbon", "knot", "tail"];
  const MATERIAL = { brim: 0, edge: 0, crown: 0, ribbon: 1, knot: 1, tail: 1 };

  let time = 1.6;
  let last = 0;
  let raf = null;
  let boxW = 0;
  let boxH = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;

  /* ----------------------------------------------------------
     Placement: read the portrait's box, map the back anchor
     ---------------------------------------------------------- */
  function place() {
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) {
      layer.style.visibility = "hidden";
      return false;
    }
    if (r.bottom < -140 || r.top > window.innerHeight + 140) {
      layer.style.visibility = "hidden";
      return false;
    }
    layer.style.visibility = "visible";

    const s = Math.max(r.width / IMG_W, r.height / IMG_H);
    const ox = r.left + (r.width - IMG_W * s) / 2;
    const oy = r.top + Math.max(0, (r.height - IMG_H * s) / 2);

    // upper back of the figure, in image space
    const backX = ox + BACK_X * IMG_W * s;
    const backY = oy + BACK_Y * IMG_H * s;
    const headW = HEAD_W * s;

    let brim = headW * HAT_SCALE;
    const cw = brim / brimFrac;
    const ch = cw / NATURAL;
    const x = backX - cw / 2;
    const y = backY - centre[1] * ch;

    if (DEBUG) {
      window.__hatPlace = { backX, backY, headW, brim, cw, ch, s, x, y, cy: centre[1] };
    }

    if (Math.abs(cw - boxW) > 0.4 || Math.abs(ch - boxH) > 0.4) {
      boxW = cw;
      boxH = ch;
      box.style.width = cw.toFixed(2) + "px";
      box.style.height = ch.toFixed(2) + "px";
      resize(cw, ch);
    }
    box.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0)";
    return true;
  }

  function resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(dpr, Math.sqrt(520000 / Math.max(1, w * h)));
    canvas.width = Math.max(2, Math.round(w * scale));
    canvas.height = Math.max(2, Math.round(h * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  /* ----------------------------------------------------------
     Draw
     ---------------------------------------------------------- */
  function draw() {
    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    gl.uniform3f(U.cam, EYE[0], EYE[1], EYE[2]);
    gl.uniform3f(U.key, keyDir[0], keyDir[1], keyDir[2]);
    gl.uniform3f(U.light, 1.24, 1.09, 0.97);
    gl.uniform2f(U.scale, fill, fill);
    gl.uniform2f(U.offset, fitOffset[0], fitOffset[1]);
    gl.uniformMatrix4fv(U.mvp, false, MVP);
    gl.uniformMatrix4fv(U.model, false, MODEL);
    gl.uniform1f(U.time, time);

    for (let i = 0; i < ORDER.length; i += 1) {
      const key = ORDER[i];
      const part = parts[key];
      gl.uniform1i(U.mat, MATERIAL[key]);
      gl.drawElements(gl.TRIANGLES, part[1], gl.UNSIGNED_SHORT, part[0] * 2);
    }
  }

  /* The hat hangs on the upper back, crown tipped away from the
     camera, brim catching the Haki light. */
  const BASE_YAW = 0.34;
  const BASE_PITCH = 0.1;
  const BASE_ROLL = -0.34;

  function pose(t) {
    const orbit = window.__orbit || { y: 0, x: 0 };
    const orbitY = (orbit.y * Math.PI) / 180;
    const orbitX = (orbit.x * Math.PI) / 180;

    const bob = Math.sin(t * 0.78) * 0.007;
    const yaw = BASE_YAW + Math.sin(t * 0.31) * 0.045 + pointerX * 0.1 + orbitY * 1.1;
    const pitch = BASE_PITCH + Math.sin(t * 0.24 + 1.2) * 0.028 + pointerY * 0.05 - orbitX * 0.55;
    const roll = BASE_ROLL + Math.sin(t * 0.19 + 2.1) * 0.016 - pointerX * 0.03 - orbitY * 0.18;
    modelMatrix(MODEL, pitch, yaw, roll, bob);
    multiply(MVP, pv, MODEL);

    if (DEBUG) window.__hatPose = { yaw, pitch, roll, bob, px: pointerX, py: pointerY };
  }

  /* ----------------------------------------------------------
     Loop
     ---------------------------------------------------------- */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const limit = compact.matches ? 1000 / 32 : 1000 / 60;
    const elapsed = now - last;
    if (elapsed < limit - 1) return;
    last = now - (elapsed % limit);

    const dt = Math.min(0.05, elapsed / 1000);
    time += dt;

    pointerX += (targetX - pointerX) * 0.055;
    pointerY += (targetY - pointerY) * 0.055;

    if (!place()) return;
    pose(time);
    draw();
  }

  function start() {
    if (raf !== null) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }

  /* ----------------------------------------------------------
     Wiring
     ---------------------------------------------------------- */
  if (place()) document.documentElement.classList.add("has-hat");

  const shadow = document.querySelector("[data-hat-shadow]");
  if (shadow) shadow.style.top = (front.y * 100).toFixed(2) + "%";

  if (finePointer.matches) {
    window.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    document.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
    });
  }

  if (reduceMotion.matches) {
    pose(2.4);
    draw();
    const redraw = () => {
      if (!place()) return;
      pose(2.4);
      draw();
    };
    window.addEventListener("resize", redraw, { passive: true });
  } else {
    start();
  }

  reduceMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      stop();
      pose(2.4);
      draw();
    } else {
      start();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!reduceMotion.matches) start();
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (place() && !reduceMotion.matches) start();
    }, 180);
  }, { passive: true });

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop();
    layer.style.visibility = "hidden";
  });
})();
