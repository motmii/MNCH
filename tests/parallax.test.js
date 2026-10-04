"use strict";
/**
 * DepthScene — the scroll-driven parallax section (MODULE 71 · #depth).
 *
 * The effect is pure CSS, so there is no runtime to boot: this suite reads
 * the shipped files and proves the four things that actually break a
 * scroll-driven section.
 *   1. markup — the #depth view, its three plates, the decorative planes
 *      hidden from assistive tech, an i18n key on every string, the view
 *      registered in the ViewSwitcher and linked from both nav menus.
 *   2. styles — the effect is opt-in twice (@supports + no-preference),
 *      `animation-timeline` is declared AFTER the `animation` shorthand
 *      (which would otherwise reset it to `auto`), only transform/opacity
 *      are animated, the layer never uses `background-attachment: fixed`,
 *      the tall runway exists ONLY inside the feature query, and the
 *      reduce query resets the plates to their layout position.
 *   3. honesty — no JavaScript drives the effect (no scroll listener, no
 *      class hooks, no timeline strings in script.js), and every px.* key
 *      exists in BOTH dictionaries.
 *   4. release — style.css?v= ↔ sw.js CACHE_VERSION ↔ package.json agree.
 * Run: node tests/parallax.test.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  \u2713 " + name);
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}

/* ---------- slices ---------- */
const headerAt = css.indexOf("MODULE 71 \u00b7 DepthScene");
const layer = headerAt < 0 ? "" : css.slice(css.lastIndexOf("/* =", headerAt),
  css.indexOf("*/", css.indexOf("END MODULE 71 \u00b7 DepthScene")) + 2);
const gatedAt = layer.indexOf("@supports (animation-timeline: view())");
const gated = gatedAt < 0 ? "" : layer.slice(gatedAt);
const beforeGated = gatedAt < 0 ? layer : layer.slice(0, gatedAt);
const sec = (html.match(/<section class="section px-sec"[\s\S]*?<\/section>/) || [""])[0];

/** The first declaration block whose selector matches, braces balanced. */
function block(src, selector) {
  const at = src.indexOf(selector);
  if (at < 0) return "";
  const open = src.indexOf("{", at);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return "";
}
/** Same, but skipping selectors that repeat (e.g. a shared will-change
    rule) until the block that actually declares `needle` is found. */
function blockWith(src, selector, needle) {
  for (let at = src.indexOf(selector); at >= 0; at = src.indexOf(selector, at + 1)) {
    const b = block(src.slice(at), selector);
    if (!needle || b.includes(needle)) return b;
  }
  return "";
}
/* Declarations only: the prose in this layer's comments explains WHY
   `background-attachment: fixed` is avoided, and a naive substring check
   would trip over that explanation instead of the code. */
const layerCode = layer.replace(/\/\*[\s\S]*?\*\//g, "");

/* ---------- index.html ---------- */
console.log("\u2014 index.html: the #depth view \u2014");
check("section#depth ships as a real view", sec.includes('id="depth"') && sec.includes('aria-labelledby="depthTitle"'));
check("its heading carries the bilingual (html) key", /<h2 class="section-title" id="depthTitle" data-i18n-html="px\.title">/.test(sec));
check("three plates, one per depth", (sec.match(/class="px-plate px-plate--(back|mid|front)"/g) || []).length === 3);
check("the decorative planes are hidden from assistive tech",
  /<div class="px-decor" aria-hidden="true">/.test(sec) && sec.includes('class="px-grid"') && sec.includes('class="px-halo"'));
check("the layer numbers are decorative too", (sec.match(/class="px-depth" aria-hidden="true"/g) || []).length === 3);
check("every visible string is keyed (no hard-coded orphans)",
  (sec.match(/<(p|h3)\b[^>]*>/g) || []).every((tag) => /data-i18n(-html)?=/.test(tag)));
check("the section adds no inline style and no extra asset",
  !/\sstyle=/.test(sec) && !/<(img|video|iframe)\b/.test(sec));
check("linked from BOTH nav menus", (html.match(/href="#depth" data-i18n="nav\.depth"/g) || []).length === 2);

/* ---------- script.js ---------- */
console.log("\n\u2014 script.js: registration, keys, and no JS-driven motion \u2014");
check("#depth registered in the ViewSwitcher VIEWS list", /\$id\("depth"\)/.test(js));
const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
function hasKey(src, key) { return new RegExp('"' + key.replace(/\./g, "\\.") + '":').test(src); }
const PX_KEYS = [
  "nav.depth", "px.eyebrow", "px.title", "px.sub", "px.legend",
  "px.back", "px.backNote", "px.mid", "px.midNote", "px.front", "px.frontNote",
  "px.note", "px.still",
];
check("all DepthScene keys exist in Arabic", PX_KEYS.every((k) => hasKey(arSrc, k)));
check("all DepthScene keys exist in English", PX_KEYS.every((k) => hasKey(enSrc, k)));
check("the effect is carried by CSS, not by script",
  !/px-(plate|stage|runway|decor|deck)/.test(js) && !/animation-timeline/.test(js));
check("no scroll listener was introduced for it",
  !/addEventListener\(\s*["']scroll["'][\s\S]{0,120}px-/.test(js));

/* ---------- style.css: the opt-in contract ---------- */
console.log("\n\u2014 style.css: opt-in twice, transform/opacity only \u2014");
check("the layer exists between its markers", layer.length > 0 && layer.includes("END MODULE 71"));
check("gated on real timeline support", gated.startsWith("@supports (animation-timeline: view())"));
check("gated on the visitor allowing motion", gated.includes("@media (prefers-reduced-motion: no-preference)"));
check("the tall runway exists ONLY inside the feature query",
  /min-height:\s*135vh;/.test(gated) && !/min-height:\s*135vh;/.test(beforeGated));
check("the fallback stays a compact, plain list",
  /\.px-deck \{[^}]*display: grid/.test(beforeGated) && !/position: sticky/.test(layer));
check("will-change is spent only where the effect runs", gated.includes("will-change: transform"));

const animated = [".px-decor", ".px-plate--back", ".px-plate--mid", ".px-plate--front"];
const animBlock = (sel) => blockWith(gated, sel, "animation:");
check("every plate gets its own scroll-driven animation",
  animated.every((sel) => {
    const b = animBlock(sel);
    return b.includes("animation:") && b.includes("animation-timeline: view()");
  }));
/* The documented trap: the `animation` shorthand resets animation-timeline,
   so a timeline declared before it is silently dropped. */
check("animation-timeline comes AFTER the animation shorthand",
  animated.every((sel) => {
    const b = animBlock(sel);
    return b.indexOf("animation:") >= 0 && b.indexOf("animation-timeline:") > b.indexOf("animation:");
  }));
check("every animation is linear (scroll-linked, never eased) and filled",
  animated.every((sel) => /animation:\s*px-[\w-]+ linear both;/.test(animBlock(sel))));
check("an explicit animation-range is given (no ambiguous default)",
  animated.every((sel) => animBlock(sel).includes("animation-range: cover 0% cover 100%")));

const keyframes = layer.match(/@keyframes\s+px-[\w-]+\s*\{[\s\S]*?\n\}/g) || [];
const props = keyframes.flatMap((k) => [...k.matchAll(/[{;\s]([a-z][a-z-]*)\s*:/g)].map((m) => m[1]));
check("four keyframes are declared", keyframes.length === 4);
check("only transform/opacity are animated",
  props.length > 0 && props.every((p) => p === "transform" || p === "opacity"));
check("the deepest plate travels least and the closest one most", (function () {
  const amp = (name) => {
    const b = block(layer, name);
    const m = /to \{ transform: translate3d\(0, -([\d.]+)rem/.exec(b);
    return m ? Number(m[1]) : NaN;
  };
  return amp("@keyframes px-plate-far") < amp("@keyframes px-plate-mid") &&
         amp("@keyframes px-plate-mid") < amp("@keyframes px-plate-near");
})());

/* ---------- style.css: platform rules ---------- */
console.log("\n\u2014 style.css: platform rules & the reduced-motion fallback \u2014");
check("no background-attachment: fixed anywhere in the layer (iOS ignores it)",
  !/background-attachment\s*:/.test(layerCode));
check("logical properties only (RTL-safe mirroring)",
  layer.includes("margin-inline-start") && layer.includes("inset-inline-start") &&
  !/\b(margin-left|margin-right|padding-left|padding-right)\s*:/.test(layer));
check("the decorative planes cannot bleed out of the panel",
  /\.px-stage \{[\s\S]*?overflow: hidden;/.test(layer) && block(layer, ".px-decor").includes("z-index: -1"));
const reduceAt = layer.lastIndexOf("@media (prefers-reduced-motion: reduce)");
const reduce = reduceAt < 0 ? "" : layer.slice(reduceAt);
check("the reduce query resets the plates and the decor",
  /\.px-decor,\s*\n\s*\.px-plate \{ animation: none; transform: none; \}/.test(reduce));
check("the reduce query tells the visitor why nothing moves",
  block(reduce, ".px-still").includes("display: block"));
check("a phone rule keeps the reading width",
  /@media \(max-width: 720px\)[\s\S]*\.px-plate--front \{ width: calc\(100% - 2rem\)/.test(layer));

/* ---------- release wiring ---------- */
console.log("\n\u2014 release wiring \u2014");
const swCache = (sw.match(/CACHE_VERSION\s*=\s*"v([\d.]+)"/) || [])[1];
check("cache version bumped for the new asset", (function () {
  const m = /CACHE_VERSION = "v(\d+)\.(\d+)\.(\d+)"/.exec(sw);
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  return v[0] > 1 || (v[0] === 1 && (v[1] > 24 || (v[1] === 24 && v[2] >= 0)));
})());
check("index.html, sw.js and package.json agree on the version",
  !!swCache && pkg.version === swCache && html.includes("style.css?v=" + swCache));

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);

