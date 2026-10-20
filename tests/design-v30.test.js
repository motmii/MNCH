"use strict";
/**
 * Phase v3.0.0 design tests — MODULE 92 · Cyber OS hero & Command Deck.
 *
 * The design language of the rebuilt homepage: hero-scoped deck tokens,
 * the geometry background (.hero-fx orbs + dot matrix), the layer stack
 * contract, the asymmetric split, the Command Deck chrome / radar /
 * terminal / HUD gauge recipes, the Cyber Bento Matrix, RTL·LTR
 * discipline, focus & reduced-motion polish — and the bans that keep the
 * identity clean (no themes, no !important in the layer).
 * Run: node tests/design-v30.test.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const motionCss = fs.readFileSync(path.join(root, "motion.css"), "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

const L = css.indexOf("MODULE 92 · Cyber OS & Command Deck");
const END = css.indexOf("END MODULE 92 · Cyber OS & Command Deck");
const layer = L > -1 && END > L ? css.slice(L, END) : "";
check("MODULE 92 design layer located", layer.length > 2000);

console.log("— deck identity tokens (hero-scoped) —");
check("hero scopes the deck green", /\.hero \{[\s\S]{0,120}--deck-green: #3DF5A5/.test(layer));
check("hero scopes the deck cyan", /\.hero \{[\s\S]{0,200}--deck-cyan: #6EE7FF/.test(layer));
check("rgb triplets declared for alpha compositing",
  layer.includes("--deck-green-rgb: 61 245 165") && layer.includes("--deck-cyan-rgb: 110 231 255"));
check("deck padding token is fluid", layer.includes("--deck-pad: clamp(0.9rem, 2vw, 1.2rem)"));

console.log("— background geometry (.hero-fx) —");
check("backdrop is a quiet absolute plane",
  /\.hero-fx \{[\s\S]{0,160}z-index: 0;/.test(layer) &&
  /\.hero-fx \{[\s\S]{0,220}pointer-events: none;/.test(layer));
check("dot matrix uses the cyan triplet at 26px pitch",
  layer.includes("radial-gradient(rgb(var(--deck-cyan-rgb) / 0.14) 1px, transparent 1.3px)") &&
  layer.includes("background-size: 26px 26px"));
check("matrix fades out via a radial mask",
  (layer.match(/-webkit-mask-image: radial-gradient/g) || []).length === 1 &&
  layer.includes("mask-image: radial-gradient(85% 65% at 78% 24%, #000 0%, transparent 70%)"));
check("orbs are blurred and inert",
  /\.hero-orb \{[\s\S]{0,180}filter: blur\(72px\)/.test(layer));
check("each orb carries its own tint + tempo",
  /\.hero-orb-a \{[\s\S]{0,200}var\(--accent-rgb\) \/ 0\.17[\s\S]{0,200}orbDriftA 24s/.test(layer) &&
  /\.hero-orb-b \{[\s\S]{0,200}var\(--accent-2-rgb\) \/ 0\.13[\s\S]{0,200}orbDriftB 28s/.test(layer) &&
  /\.hero-orb-c \{[\s\S]{0,200}var\(--deck-green-rgb\) \/ 0\.10[\s\S]{0,200}32s ease-in-out infinite alternate-reverse/.test(layer));
check("orbs use logical start/end anchoring",
  layer.includes("inset-inline-start: -12%") && layer.includes("inset-inline-end: -10%"));
check("drift keyframes are transform-only (compositor friendly)", (() => {
  const kf = layer.slice(layer.indexOf("@keyframes orbDriftA"), layer.indexOf("@keyframes orbDriftB"));
  return kf.includes("translate3d") && !/(left|top|width|height):/.test(kf);
})());

console.log("— layer stack contract —");
check("stack order documented in the scrim comment", css.includes("→ .hero-content (3)"));
check("scrim paints above the geometry", /\.hero::before \{[\s\S]{0,400}z-index: 1;/.test(css));
check("hero content owns the top layer", css.includes(".hero-content {") && /\.hero-content \{[\s\S]{0,80}z-index: 3;/.test(css));
check("hero isolates its stacking context", /\.hero \{[\s\S]{0,300}isolation: isolate;/.test(css));

console.log("— asymmetric split —");
check("grid is weighted 1.02fr : 0.98fr",
  layer.includes("grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr)"));
check("copy column left-aligns its children",
  /\.hero-main \{[\s\S]{0,160}justify-items: start;/.test(layer));
check("deck column supplies the 3D perspective", /\.hero-side \{ min-width: 0; perspective: 1200px; \}/.test(layer));
check("deck keeps preserve-3d for the tilt",
  /\.cmd-deck \{[\s\S]{0,120}transform-style: preserve-3d;/.test(layer));

console.log("— telemetry pill + search trigger —");
check("pulse dot is a 10px deck-green beacon", /\.radar-pulse \{[\s\S]{0,260}background: var\(--deck-green\);/.test(layer));
check("pulse emits a 9px shadow wave", /@keyframes radarPulse \{[\s\S]{0,220}0 9px rgb\(var\(--deck-green-rgb\) \/ 0\)/.test(layer));
check("semester badge is a mono capsule",
  /\.radar-badge \{[\s\S]{0,260}font-family: var\(--font-mono\)/.test(layer) &&
  /\.radar-badge \{[\s\S]{0,340}border-radius: 999px;/.test(layer));
check("search shows a real keycap", /\.hero-search kbd \{[\s\S]{0,200}font-family: var\(--font-mono\)/.test(layer));
check("search focus ring uses accent-2", layer.includes(".hero-search:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 3px; }"));

console.log("— command deck chrome —");
check("chrome bar is an ink strip", /\.deck-chrome \{[\s\S]{0,340}background: rgb\(0 0 0 \/ 0\.42\);/.test(layer) &&
  /\.deck-chrome \{[\s\S]{0,420}border-bottom: 1px solid var\(--hairline\);/.test(layer));
check("chrome bleeds to the deck edge", layer.includes("margin: calc(var(--deck-pad) * -1);"));
check("three mac dots coloured", layer.includes(".deck-dot:nth-child(1) { background: #FF5F57; }") &&
  layer.includes(".deck-dot:nth-child(2) { background: #FEBC2E; }") &&
  layer.includes(".deck-dot:nth-child(3) { background: #28C840; }"));
check("led breathes in deck green",
  /\.deck-chrome-led \{[\s\S]{0,300}background: var\(--deck-green\);/.test(layer) &&
  layer.includes("animation: deckLed 2.4s ease-in-out infinite"));
check("chrome title is mono + dim", /\.deck-chrome-title \{[\s\S]{0,200}font-family: var\(--font-mono\)/.test(layer));
check("deck panels keep a stable floor on desktop", /@media \(min-width: 1021px\)[\s\S]{0,120}\.cmd-deck \.hero-panel \{ min-block-size: 320px; \}/.test(layer));

console.log("— radar recipe —");
check("radar row is a 4-track grid", /\.radar-item \{[\s\S]{0,140}grid-template-columns: auto minmax\(0, 1fr\) auto auto;/.test(layer));
check("row surfaces carry hairline cards", /\.radar-item \{[\s\S]{0,240}border: 1px solid var\(--hairline\);[\s\S]{0,200}border-radius: 12px;/.test(layer));
check("hover swaps to cyan", layer.includes(".radar-item:hover { border-color: rgb(var(--deck-cyan-rgb) / 0.4);"));
check("live chip flips to ink-on-green", layer.includes(".radar-item.is-live .radar-item-flag { color: #07120D; background: var(--deck-green); border-color: transparent; }"));
check("today chip wears accent-2", layer.includes(".radar-item.is-today .radar-item-flag { color: var(--accent-2);"));
check("next class gets the spotlight ring", layer.includes(".radar-item.is-next { box-shadow: var(--inner-hi), 0 0 0 1px rgb(var(--deck-cyan-rgb) / 0.25); }"));
check("day column is mono + fixed-ish", /\.radar-item-day \{[\s\S]{0,260}font-family: var\(--font-mono\)/.test(layer) && layer.includes("min-inline-size: 5.8rem"));
check("empty state is quiet, not shouty", /\.radar-empty \{[\s\S]{0,120}color: var\(--muted\);/.test(layer));

console.log("— terminal recipe —");
check("log reads LTR mono on ink", /\.deck-term-log \{[\s\S]{0,120}direction: ltr;/.test(layer) &&
  /\.deck-term-log \{[\s\S]{0,400}font-family: var\(--font-mono\);/.test(layer) &&
  /\.deck-term-log \{[\s\S]{0,700}background: rgb\(0 0 0 \/ 0\.38\);/.test(layer));
check("log scrolls inside itself", /\.deck-term-log \{[\s\S]{0,600}block-size: 230px;/.test(layer) &&
  /\.deck-term-log \{[\s\S]{0,640}overscroll-behavior: contain;/.test(layer));
check("line types share one palette", layer.includes(".deck-term-log .term-ok { color: var(--deck-green); }") &&
  layer.includes(".deck-term-log .term-err { color: #FF7A7A; }") &&
  layer.includes(".deck-term-log .term-cmd { color: var(--deck-cyan); }") &&
  layer.includes(".deck-term-log .term-dim { color: var(--dim); }"));
check("composer lights up on focus", /\.deck-term-form:focus-within \{ border-color: rgb\(var\(--deck-green-rgb\) \/ 0\.4\); \}/.test(layer));
check("prompt is a green mono glyph", /\.deck-term-prompt \{[\s\S]{0,160}color: var\(--deck-green\);/.test(layer));
check("terminal escape hatch styled", layer.includes(".deck-term-link:hover { color: var(--deck-green); }"));

console.log("— telemetry HUD recipe —");
check("gauges sit in a 3-up grid", /\.hud-gauges \{[\s\S]{0,160}grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/.test(layer));
check("gauge wells are pressed glass",
  /\.hud-gauge \{[\s\S]{0,340}background-image: var\(--spot\);/.test(layer) &&
  /\.hud-gauge \{[\s\S]{0,420}box-shadow: var\(--inner-hi\);/.test(layer));
check("track ring is a 9px hairline stroke", /\.hud-ring \{ stroke: rgb\(var\(--wash-hi-rgb\) \/ 0\.09\); stroke-width: 9; \}/.test(layer));
check("value rings animate dash from 100",
  /\.hud-ring\.is-value \{[\s\S]{0,220}stroke-dashoffset: 100;[\s\S]{0,260}transition: stroke-dashoffset 0\.9s var\(--ease-out\);/.test(layer));
check("arcs start at 12 o'clock", /\.hud-ring\.is-value \{[\s\S]{0,320}transform: rotate\(-90deg\);/.test(layer));
check("each gauge owns its hue", layer.includes("#heroGaugeLevelArc { stroke: var(--accent-3); }") &&
  layer.includes("#heroGaugeXpArc { stroke: var(--accent); }") &&
  layer.includes("#heroGaugeDoneArc { stroke: var(--deck-green); }"));
check("values are tabular mono", /\.hud-gauge-value \{[\s\S]{0,240}font-variant-numeric: tabular-nums;/.test(layer));

console.log("— Cyber Bento Matrix —");
check("matrix splits 1fr : 1.35fr with arsenal full-bleed",
  layer.includes("grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);") &&
  layer.includes(".bento-arsenal { grid-column: 1 / -1; }"));
check("cards are 20px glass slabs",
  /\.bento-card \{[\s\S]{0,260}border-radius: 20px;/.test(layer) &&
  /\.bento-card \{[\s\S]{0,600}box-shadow: var\(--elev-2\);/.test(layer));
check("cards wear a top sheen", /\.bento-card \{[\s\S]{0,420}linear-gradient\(180deg, rgb\(var\(--wash-hi-rgb\) \/ 0\.03\), transparent 34%\)/.test(layer));
check("hover lifts 3px with cyan aura",
  layer.includes("border-color: rgb(var(--deck-cyan-rgb) / 0.3);") &&
  layer.includes("transform: translateY(-3px);"));
check("glow layer is absolute cyan haze",
  /\.bento-glow \{[\s\S]{0,240}radial-gradient\(62% 72% at 30% 30%, rgb\(var\(--deck-cyan-rgb\) \/ 0\.15\)/.test(layer) &&
  /\.bento-glow \{[\s\S]{0,320}pointer-events: none;/.test(layer));
check("content rides above the glow", layer.includes(".bento-card > :not(.bento-glow) { position: relative; }"));
check("kickers are uppercase accent-2 tags", /\.bento-kicker \{[\s\S]{0,220}text-transform: uppercase;/.test(layer) &&
  /\.bento-kicker \{[\s\S]{0,260}color: var\(--accent-2\);/.test(layer));
check("titles scale with clamp", /\.bento-title \{[\s\S]{0,160}font-size: clamp\(1\.1rem, 2\.4vw, 1\.4rem\);/.test(layer));
check("schedule rows are hairline chips", /\.bento-sched-item \{[\s\S]{0,240}border: 1px solid var\(--hairline\);/.test(layer));
check("schedule days are mono", /\.bento-sched-day \{ font-family: var\(--font-mono\);/.test(layer));
check("bento CTA greens on hover", layer.includes(".bento-cta:hover { color: var(--deck-green); }"));
check("lab tiles grid 2-up", /\.bento-labs \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/.test(layer));

console.log("— focus · motion · responsive polish —");
check("deck controls share one focus ring",
  /\.soc-lab:focus-visible,[\s\S]{0,120}\.bento-cta:focus-visible,[\s\S]{0,120}\.deck-term-link:focus-visible \{[\s\S]{0,120}outline: 2px solid var\(--accent-2\);/.test(layer));
check("motion hooks reserve transforms", layer.includes("html.motion-on .cmd-deck,") &&
  layer.includes("html.motion-on .bento-card { will-change: transform; }"));
check("motion.css glow respects the three states",
  motionCss.includes("html.motion-on .bento-card {") &&
  motionCss.includes("html.motion-on .bento-card::after {") &&
  motionCss.includes("html.motion-on .bento-card:hover::after {"));
check("reduced motion kills orb + led loops",
  /prefers-reduced-motion[\s\S]{0,160}\.hero-orb,[\s\S]{0,80}animation: none;/.test(layer));
check("reduced motion stops ring easing + card lift",
  layer.includes(".hud-ring.is-value { transition: none; }") && layer.includes(".bento-card:hover { transform: none; }"));
check("1020px collapses split + matrix", /@media \(max-width: 1020px\) \{[\s\S]{0,120}\.hero-split \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(layer) &&
  /@media \(max-width: 1020px\) \{[\s\S]{0,220}\.bento-matrix \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(layer));
check("640px re-stacks radar rows + gauges",
  /@media \(max-width: 640px\)[\s\S]{0,600}\.radar-item \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/.test(layer) &&
  /@media \(max-width: 640px\)[\s\S]{0,700}\.hud-gauge \{ grid-template-rows: 72px auto; \}/.test(layer));
check("layer speaks logical properties", layer.includes("inline-size") && layer.includes("inset-inline") && layer.includes("margin-inline-start"));

console.log("— identity bans & markup order —");
check("no !important inside the design layer", !layer.includes("!important"));
check("no theme/palette experiments", !layer.includes("[data-theme=") && !layer.includes("prefers-color-scheme"));
check("geometry precedes content in the DOM",
  html.indexOf('class="hero-fx"') > -1 && html.indexOf('class="hero-fx"') < html.indexOf('class="hero-content"'));
check("main column precedes the deck column", html.indexOf('class="hero-main"') < html.indexOf('class="hero-side"'));
check("deck precedes the bento matrix", html.indexOf('id="heroDash"') < html.indexOf('id="bentoMatrix"'));

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);
