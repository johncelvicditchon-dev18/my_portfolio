# Johncel Vic C. Ditchon — Portfolio

A one-page, cinematic personal portfolio built around a single hero composition:
black, white and maroon, editorial typography, a 3D portrait stage, and a live
Conqueror's-Haki-inspired energy field.

No frameworks, no build step, no external requests.

---

## Run it

```bash
npm run dev      # http://localhost:4173
```

or double-click **`preview.cmd`** (Windows). Any static host works too — upload the folder as-is.

`index.html` also opens directly from disk, because the fonts are inlined in `assets/fonts.css`.
A local server is still recommended for correct caching and consistent rendering.

---

## The energy field

The storm is two cooperating layers — both dependency-free:

1. **Portrait field (WebGL, `assets/aura.js`)** — a screen-blended canvas wrapped around
   the figure.
2. **Page storm (2D canvas, `assets/storm.js`)** — a fixed full-viewport layer behind the
   content that keeps black-and-crimson lightning, embers and pressure flashes alive across
   the entire site, and reacts to scrolling with extra strikes.

### Portrait field

- **Silhouette mask:** a 548 × 731 texture baked from the portrait's own alpha channel.
  R is the sharp silhouette, G a 14 px blur and B an 80 px blur. This is what lets the
  energy wrap the real body instead of a generic oval.
- **Layers:** dark burgundy pressure cloud → crimson field and rising flame tongues →
  expanding shockwave rings with air shimmer → drifting embers → black lightning.
- **Lightning:** procedurally generated jagged bolts with sharp bends, a black core,
  a crimson rim and a soft red bloom. Three strike bolts plus two continuous arcs
  surround the figure; extra bolts fire during bursts.
- **Pressure:** bursts every 5.5–9.7 s raise the field, trigger a brief camera shake on the
  portrait stage, and add large discharges.
- **Pointer:** moving near the portrait intensifies the field; the stage tilts with the
  cursor as before.
- **Performance:** the canvas renders at a capped pixel budget (≈700k desktop / 220k mobile),
  30 fps on small or touch devices, pauses off-screen and when the tab is hidden.
  WebGL failure falls back to a CSS-only glow; `prefers-reduced-motion` renders a single
  static frame with no shake or animation.

### Page storm

- Fixed canvas behind all content, so the field is present at every scroll position.
- Black lightning with a glowing crimson rim, branches, embers and crimson pressure flashes.
- Strikes it draws over the text column are deliberately dimmed; the white typography stays
  above the storm.
- Extra strikes fire while scrolling; the canvas is pixel-budgeted and capped at 30 fps.
- Static frame under `prefers-reduced-motion`.

Debug hooks: `?auraTime=5` freezes the portrait field at a given second, `?auraBurst=0.8`
sets its burst level, and `?auraDebug=1` shows the silhouette mask.

The portrait and the aura mask are a matched pair. If you replace the portrait, the mask
data near the top of `assets/aura.js` must be regenerated from the new cut-out (or hide the
canvas and let the CSS fallback carry the scene).

---

## Before you publish

| What | Where |
| --- | --- |
| Email address | `index.html` → the `mailto:` on **Contact me** (search `your.email@example.com`) |
| Profile link | `index.html` → the `href` on **View profile** (search `your-profile`) |
| Portrait | `assets/portrait-cutout.webp` |
| Social preview | `assets/og-cover.jpg` |
| Document metadata | `index.html` → `<title>`, description, Open Graph tags |

After deploying, make `og:image` an absolute URL (`https://your-domain/assets/og-cover.jpg`) —
most social platforms will not resolve a relative path.

The portrait is a cut-out of the supplied photograph, graded in the site's maroon light and
faded into the page at the bottom. The source photograph is untouched in `developerpic.png`.

---

## Structure

```
index.html                 single page, semantic, no navigation
assets/
  styles.css               layout, scene, aura chrome and motion
  fonts.css                Sora / Inter / Instrument Serif, inlined as WOFF2 data URIs
  main.js                  entrance timing, pointer depth, spotlight (≈4 KB)
  aura.js                  WebGL Haki field, mask and burst/shake system
  storm.js                 page-wide lightning / embers / scroll reactivity
  portrait-cutout.webp     graded portrait with alpha
  og-cover.jpg             1200 × 630 social preview (rendered from the page)
  favicon.svg
  fonts/                   original WOFF2 files (source for fonts.css)
server.mjs                 zero-dependency static server for local preview
preview.cmd                Windows double-click preview
```

---

## Design notes

- **Palette:** `#080808` black, `#FFFFFF` white, `#800020` maroon, `#3D0015` burgundy,
  `#B00020` crimson, `#FF1744` lightning.
- **Type:** Sora for display and interface, Inter for body copy, Instrument Serif italic
  as an optional accent face. All three are self-hosted and subset to Latin.
- **Portrait stage:** layered maroon bloom, glass arch, orbit rings, floating orbs,
  wireframe cube, soft "shadow twin" and the energy field. The stage tilts in 3D with
  the pointer and the geometry drifts at different depths.
- **Motion:** staggered entrance (name tracking, blur-to-focus reveals), a 9 s portrait
  float, drifting atmosphere, lightning strikes, pressure bursts and a pulsing status dot.
- **Responsive:** two columns above 900 px; below that the portrait becomes a
  head-and-shoulders crop above the actions. Tuned down to 320 px.
- **Accessibility:** semantic landmarks, a skip link, visible focus rings, a descriptive
  `alt`, AA-level text contrast, readable text above the aura layer, and a full
  `prefers-reduced-motion` fallback.
- **Performance:** zero dependencies, self-hosted fonts, one image, explicit dimensions
  (no layout shift), a capped WebGL render budget and animation limited to
  `transform`, `opacity` and shader work.

Deliberately absent, per the brief: navigation, menus, skills, projects, services and extra sections.
