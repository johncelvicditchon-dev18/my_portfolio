# Johncel Vic C. Ditchon — Portfolio

A one-page, cinematic personal portfolio: black, white and maroon, editorial
typography, a centred 3D portrait stage, an oversized name behind the figure, a
Mugiwara straw hat carried on the character's back, and a live
Conqueror's-Haki-inspired energy field across the whole page.

Three sections — **About**, **Work**, **Contact** — with a floating three-link
navigation in the upper-right corner and a Thousand Sunny scrollbar that sails across
the bottom edge.

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

## The page

### Hero

- **Centred portrait.** The figure sits in the middle of the stage; the name is
  set in two oversized lines *behind* it, clipped by the portrait so the type
  reads as part of the environment rather than a heading on top.
- **Identity line.** `FULL STACK DEVELOPMENT` sits under the stage, followed by a
  short introduction: a Computer Science student focused on programming, software
  development and meaningful digital experiences.
- **Straw hat on the back.** `assets/hat.js` lofts a real 3D hat — woven brim,
  low crown, satin band and a trailing ribbon — and hangs it on the character's
  upper back at an anchor measured in image space (`BACK_X`, `BACK_Y`,
  `HAT_SCALE`). The hat layer sits *behind* the page shell, so the portrait's
  own silhouette occludes it: that is what makes it read as carried rather than
  pasted on.
- **Drag to inspect.** Dragging horizontally turns the composition through a
  controlled arc (±16° yaw, ±8° pitch) and the hat turns with it in 3D. Vertical
  drags are left to the browser, so scrolling still works. On release the frame
  eases back to the front view. No full turnaround is faked — the portrait is a
  single photograph, and the arc is honest about it.
- **Pointer depth.** The stage tilts with the cursor and the floating geometry
  drifts at different depths.

### About

`assets/source/who-am-i.png`, used exactly as supplied (same file, same
proportions, no retouching), presented as a transparent cut-out with no panel behind it — only a
soft floor light and a bottom fade into the page. A `picture` element serves the
optimised `assets/about-cutout.webp` (same pixels, 191 KB instead of 1.4 MB) with
the original PNG as the fallback. The frame is gently turned in 3D and carries two
lighting passes masked to the cut-out itself — a soft highlight from the upper left
and a restrained shade on the lower right — plus a grounding shadow and ambient
crimson halo. Under the heading the section carries the full introduction —
student, builder of practical software, and AI-assisted developer — followed by
an open invitation for freelance projects, commissions and collaborations.

### Work

Five project cards, three on the first row and two centred beneath:

| Project | Link |
| --- | --- |
| TCGC Library Management System | live demo not published yet |
| Grading Management System | live demo not published yet |
| Rubric System | https://rubric-system-tcgc.vercel.app/ |
| SSG Voting System (Fast-Result Electoral System) | https://fresys-tcnhs.vercel.app/ |
| Personal Portfolio | this page |

Each card has generated cover art, an honest description and scope tags. **No
repository URLs are invented**: only the two published systems carry a
`LIVE DEMO` link, and both open in a new tab. Under the grid a single
`VIEW MY GITHUB REPOSITORIES` button points at the public repository list.

### Contact

An editorial header — the statement on the left, the invitation set against its
baseline on the right — opens onto the contact directory. The six real rows
(phone, email, Instagram, Facebook, LinkedIn, GitHub) sit in a balanced 2 × 3
grid on desktop and collapse to one column on narrow screens. Each row opens
with a glossy 3D brand tile in its real palette: Gmail's multicolor envelope on
white, the Instagram gradient, Facebook blue, LinkedIn blue, GitHub graphite and
a green call tile. The shared treatment — top highlight, inner bevel, floating
shadow and colored glow — gives them depth without changing the contact layout.
Every row has a copy button that writes the phone number, address, handle or
profile URL to the clipboard (async Clipboard API, with a hidden-textarea
fallback), swaps its icon for a check, and announces the result in a polite live
region. There is no contact form: the rows themselves are the action, keeping
the section direct and uncluttered.

### Navigation

Exactly three links, glass pill, sliding maroon marker, active section tracking
via `IntersectionObserver`, `aria-current` on the active link, and full keyboard
support. Fixed to the upper-right of the viewport, aligned with the content gutter and
sitting just below the editorial corner bracket, so the layout keeps the same anchor
at every size. Hovering a link fades in a faint glass tint under the marker.

### The ship scrollbar

The bottom edge is a deep horizontal ocean, and **`sunny mugiwara.png`** is its
scrollbar thumb. The artwork is used exactly as supplied — same sideways
formation, wisecracking lion figurehead pointing down, sails and masts above,
wooden hull on the right. It is never rotated or mirrored: the ship stays upright
on the waterline while it sails from left to right, so scrolling down moves it
toward the right end and scrolling up brings it back.

It is a real scrollbar, not decoration: the thumb follows `scrollY` exactly,
can be dragged (`pointer` events, 1:1 mapping on the X axis), and clicking the
strip sails smoothly to that position. Wheel, trackpad, keyboard, anchors and
touch scrolling all keep the browser's native behaviour, because the page itself
is never re-scrolled or wrapped — only the native scrollbar's paint is hidden.
The page reserves `--shipbar-reserve` at its bottom padding so the footer and the
last row of content never sit under the strip. Below 900px the ship steps aside
and the browser's own scrollbar returns.

The ocean is an 18px-tall 2D canvas over a cylindrical CSS gradient: swell crests
travelling along the surface with shaded troughs, surface glints and drifting
currents, rising bubbles, a hull reflection in the water, a wake trailing behind
the stern, foam and spray that pulse against the hull, and extra speed streaks
when the page is scrolling fast. The water reacts to scroll velocity and runs at
~30 fps on a tiny pixel budget, paused when the tab is hidden or reduced motion
is requested (it then paints a single static frame).
The ship is `aria-hidden`: native scroll semantics remain, so screen readers are
not given a duplicate slider.

---

## The energy field

The aura is three cooperating layers — all dependency-free:

1. **Portrait field (WebGL, `assets/aura-field.js` mounted by `assets/aura.js` and
   `assets/aura-about.js`)** — one screen-blended shader mounted twice: on the hero portrait
   and on the "Who I am" cut-out. Both use the same palette, flame crown, shockwave rings,
   black lightning, rim light and burst rhythm, each driven by its own baked silhouette mask.
2. **Page storm (2D canvas, `assets/storm.js`)** — a fixed full-viewport layer behind the
   content that keeps black-and-crimson lightning, embers, upward discharges and pressure
   flashes alive across the entire site, and reacts to scrolling with extra strikes. Soft
   crimson flame columns in the ambient layer carry the low ground fire.

### Portrait fields

- **One engine:** `assets/aura-field.js` holds the fragment shader and the whole render,
  sizing, burst and lifecycle system. `aura.js` and `aura-about.js` only supply the canvas,
  the mask and the layer geometry, so both sections stay pixel-identical in style.
- **Silhouette masks:** baked from each cut-out's own alpha channel. R is the sharp
  silhouette, G a 14 px blur and B an 80 px blur, all padded by ~41 % of the image width so
  the energy can bloom past the body. Hero: 548 × 731. About: 548 × 569. This is what lets
  the energy wrap the real body instead of a generic oval.
- **Layers:** dark burgundy pressure cloud → crimson field → a tall Super-Saiyan-inspired
  crown of tapered flame tongues and radial spikes → expanding shockwave rings with air
  shimmer → drifting embers and fast vertical sparks → black lightning.
- **Rim light:** a silhouette-gradient sample gives directional crimson edge light that
  follows the real outline of the portrait, backed by crimson drop-shadows in CSS.
- **Lightning:** procedurally generated jagged bolts with sharp bends, a black core,
  a crimson rim and a soft red bloom. Four strike bolts plus two continuous arcs
  surround the figure; extra bolts fire during bursts.
- **Pressure:** bursts every 5.5–9.7 s raise the field and add large discharges; on the
  hero they also trigger a brief camera shake on the portrait stage.
- **Pointer:** moving near either portrait intensifies that field; the hero stage still
  tilts with the cursor.
- **Performance:** each canvas renders at a capped pixel budget (≈520k desktop / 190k
  mobile), 30 fps on small or touch devices and 45 fps elsewhere, pauses off-screen and when
  the tab is hidden. WebGL failure falls back to a CSS-only glow and hides that canvas;
  `prefers-reduced-motion` renders a single static frame with no shake or animation.

### About portrait field

- Runs the same shader above `assets/about-cutout.webp` (never behind it), so the rim light
  and flames sit on the figure's edge and read as radiating from the body.
- The card is a wide bust crop, so the field is not widened past the photo: the canvas
  edges coincide with the photo edges and the shader's own edge fade closes the frame.
- Tuned to the same intensity as the hero (1.15 desktop / 0.9 touch), with its own mask,
  burst cadence and paused-off-screen behaviour.

### Page storm

- Fixed canvas behind all content, so the field is present at every scroll position.
- Black lightning with a glowing crimson rim, branches, embers and crimson pressure flashes.
- Strikes it draws over the text column are deliberately dimmed; the white typography stays
  above the storm.
- Extra strikes fire while scrolling; the canvas is pixel-budgeted and capped at 30 fps.
- Static frame under `prefers-reduced-motion`.

Debug hooks: `?auraTime=5` freezes the hero field at a given second, `?auraBurst=0.8`
sets its burst level and `?auraDebug=1` shows its silhouette mask. The About field reads
`?aboutTime`, `?aboutBurst` and `?aboutDebug` the same way. `?hatDebug=1` exposes
`window.__hatFit`, `window.__hatPlace` and `window.__hatPose`. `?shipAt=0.6` parks the
Thousand Sunny at 60% along the bottom strip for inspection.

Each portrait and its aura mask are a matched pair. If you replace a cut-out, regenerate
the matching mask data at the top of `assets/aura.js` or `assets/aura-about.js` (R = alpha,
G = 14 px blur, B = 80 px blur, padded by ~41% of the image width), or hide that canvas and
let the CSS fallback carry the scene. The hero hat anchors (`HEAD_X`, `HEAD_W`, `BACK_X`,
`BACK_Y`) also assume the current hero cut-out's framing.

---

## Before you publish

| What | Where |
| --- | --- |
| Portrait | `assets/portrait-cutout.webp` (hero) and `assets/source/who-am-i.png` (about) |
| Social preview | `assets/og-cover.jpg` |
| Contact details | `index.html` → the `#contact` list |
| Document metadata | `index.html` → `<title>`, description, Open Graph tags, JSON-LD |

After deploying, make `og:image` an absolute URL (`https://your-domain/assets/og-cover.jpg`) —
most social platforms will not resolve a relative path.

The hero portrait is a cut-out of the supplied photograph, graded in the site's maroon light
and faded into the page at the bottom. Background contamination baked into the cut-out's
semi-transparent edge was removed in straight alpha — the alpha channel itself is untouched,
so the hairstyle, hairline, face and head shape are exactly as supplied. The source
photograph is untouched in `assets/source/developer-photo.png`.

---

## Structure

```
index.html                 single page: hero, about, work, contact, ship scrollbar
assets/
  styles.css               layout, hero, sections, cards, contact directory, copy buttons, navigation, motion
  fonts.css                Sora / Inter / Instrument Serif, inlined as WOFF2 data URIs
  main.js                  entrance, pointer depth, drag-to-inspect, nav, reveals, copy
  aura-field.js            shared WebGL energy-field engine (shader, masks, bursts)
  aura.js                  mounts the field on the hero portrait + its mask
  aura-about.js            mounts the same field on the About portrait + its mask
  storm.js                 page-wide lightning / embers / scroll reactivity
  hat.js                   procedural WebGL straw hat, anchored to the back
  shipbar.js               Thousand Sunny scrollbar: drag, track clicks, ocean canvas
  portrait-cutout.webp     graded portrait with alpha (hero)
  sunny-mugiwara.png       supplied Thousand Sunny artwork, trimmed and scaled (scrollbar thumb)
  about-cutout.webp        optimised copy of who-am-i.png with alpha (about)
  og-cover.jpg             1200 × 630 social preview (rendered from the page)
  favicon.svg
  fonts/                   original WOFF2 files (source for fonts.css)
  source/                  raw source images, kept out of the page itself
    developer-photo.png    original photograph behind the hero cut-out
    who-am-i.png           about-section photograph, used unmodified
    supersaiyan.jpg        reference image for the energy field
    sunny-mugiwara-source.png  original uploaded ship artwork (untrimmed)
server.mjs                 zero-dependency static server for local preview
preview.cmd                Windows double-click preview
```

---

## Design notes

- **Palette:** `#080808` black, `#151515` charcoal, `#FFFFFF` white, `#800020` maroon,
  `#3D0015` burgundy, `#B00020` crimson, `#FF1744` lightning.
- **Type:** Sora for display and interface, Inter for body copy, Instrument Serif italic
  as an optional accent face. All three are self-hosted and subset to Latin.
- **Hero stage:** layered maroon bloom, glass arch, orbit rings, floating orbs, wireframe
  cube and the energy field. The stage tilts in 3D with the pointer and the geometry
  drifts at different depths.
- **Motion:** staggered entrance, a 9 s portrait float, drifting atmosphere, lightning
  strikes, pressure bursts, scroll reveals and the navigation marker.
- **Responsive:** a centred hero at every size; the about/contact grids collapse to one
  column below 900 px and the card grid steps 3 → 2 → 1. Below 900 px the portrait becomes a
  head-and-shoulders crop; the navigation stays a fixed pill in the upper-right corner
  down to 320 px, and the ocean strip retires below 900 px.
  No horizontal overflow at any breakpoint.
- **Accessibility:** semantic landmarks and section headings, a skip link, visible focus
  rings, descriptive `alt` text, AA-level text contrast, readable text above the aura
  layer, `aria-current` on the active nav link, labelled copy buttons with a polite live
  region, and a full `prefers-reduced-motion` fallback. The ship scrollbar is
  `aria-hidden` — native wheel, keyboard and touch scrolling keep their own semantics —
  hides below 900px, and renders a single static ocean frame under reduced motion.
- **Performance:** zero dependencies, self-hosted fonts, one hero image, explicit
  dimensions (no layout shift), capped WebGL render budgets, a 30 fps ocean canvas on a
  16px strip, and animation limited to `transform`, `opacity` and shader work.
