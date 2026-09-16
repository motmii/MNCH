"use strict";
/**
 * Phase 2 wiring test — complements paths-smoke.test.js (which runs the
 * module against a STUB dictionary). This one validates the REAL assets:
 *   - every Lang.t() key used by MODULE 39 exists in BOTH ar & en dicts
 *   - every data-i18n / data-i18n-html key in index.html exists in both dicts
 *   - ViewSwitcher wiring: #path view, path/<id> deep links, hash preservation
 *   - mounts + recommended CTA + 12 tool ids present in index.html
 *   - CSS: responsive auto-fill grid, mobile rules, reduced-motion, and the
 *     view-switcher rule that hides the new #path section when inactive
 *   - Service Worker cache version bumped
 * Run: node tests/paths-i18n.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

let failures = 0;
const check = (name, cond) => {
  if (cond) { console.log("  \u2713 " + name); }
  else { failures++; console.error("  \u2717 FAIL: " + name); }
};

/** Index just past the "}" matching the "{" at startIdx (raw brace counting). */
function sliceObject(src, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

/* ---------- Extract the real DICT (ar + en ranges) ---------- */
const dictStart = js.indexOf("const DICT = {");
check("Lang DICT found in script.js", dictStart >= 0);
const dictSrc = js.slice(dictStart, sliceObject(js, js.indexOf("{", dictStart)));

const arStart = dictSrc.indexOf("ar: {");
const arEnd = sliceObject(dictSrc, dictSrc.indexOf("{", arStart));
const arSrc = dictSrc.slice(arStart, arEnd);
const enStart = dictSrc.indexOf("en: {");
const enEnd = sliceObject(dictSrc, dictSrc.indexOf("{", enStart));
const enSrc = dictSrc.slice(enStart, enEnd);
check("ar dict range extracted", arStart >= 0 && arEnd > arStart);
check("en dict range extracted", enStart >= 0 && enEnd > enStart);

/* ---------- MODULE 39 → dict keys ---------- */
const modStart = js.indexOf("(function initLearningPaths() {");
const modEnd = js.indexOf("/* @@TOOLS_D@@ */", modStart);
const modSrc = js.slice(modStart, modEnd);
check("MODULE 39 source extracted", modStart >= 0 && modEnd > modStart);

const used = new Set();
let m;
const keyRe = /Lang\.t\(\s*"([^"]+)"/g;
while ((m = keyRe.exec(modSrc))) used.add(m[1]);
/* Drop concat-call prefixes ("labs." / "paths.level.") — the dynamic
   expansion below covers their full keys. */
for (const k of [...used]) { if (k.endsWith(".")) used.delete(k); }
/* Dynamic keys: expand from the data actually used in the module */
const levelRe = /level: "(\w+)"/g;
while ((m = levelRe.exec(modSrc))) used.add("paths.level." + m[1]);
/* Lab views route through the module's LP_LAB_KEYS label map
   (cryptolab → the pre-existing "labs.crypto" key) */
const mMap = /LP_LAB_KEYS = \{([^}]*)\}/.exec(modSrc);
const labMap = {};
if (mMap) {
  const pairRe = /(\w+):\s*"([^"]+)"/g;
  while ((m = pairRe.exec(mMap[1]))) labMap[m[1]] = m[2];
}
const labRe = /view: "(\w+)"/g;
while ((m = labRe.exec(modSrc))) used.add(labMap[m[1]] || ("labs." + m[1]));

console.log("\u2014 every Lang.t key used by MODULE 39 exists in BOTH dicts \u2014");
for (const key of [...used].sort()) {
  check('ar  \u2190 "' + key + '"', arSrc.includes('"' + key + '"'));
  check('en  \u2190 "' + key + '"', enSrc.includes('"' + key + '"'));
}

/* ---------- index.html → dict keys (whole page regression) ---------- */
console.log("\u2014 every data-i18n key in index.html exists in BOTH dicts \u2014");
const htmlKeys = new Set();
const i18nRe = /data-i18n(?:-html)?="([^"]+)"/g;
while ((m = i18nRe.exec(html))) htmlKeys.add(m[1]);
const missingAr = [];
const missingEn = [];
for (const key of htmlKeys) {
  if (!arSrc.includes('"' + key + '"')) missingAr.push(key);
  if (!enSrc.includes('"' + key + '"')) missingEn.push(key);
}
check("all " + htmlKeys.size + " html i18n keys present in ar dict" + (missingAr.length ? " \u2014 missing: " + missingAr.join(", ") : ""), missingAr.length === 0);
check("all html i18n keys present in en dict" + (missingEn.length ? " \u2014 missing: " + missingEn.join(", ") : ""), missingEn.length === 0);
check("no stale paths.found/prac/exam keys in HTML", !/paths\.(found|prac|exam)\./.test(html));

/* ---------- ViewSwitcher + mount wiring ---------- */
console.log("\u2014 view-switcher & mount wiring \u2014");
check("VIEWS registers the #path detail view", js.includes('$id("paths"), $id("path"), $id("subjects")'));
check("resolveViewId maps the path/ prefix", js.includes('if (/^path\\//.test(id)) return "path";'));
check("activate() preserves #path/<id> deep-link hashes", js.includes('/^#path\\//.test(location.hash)'));
check("pathsGrid mount present", html.includes('id="pathsGrid"'));
check("pathDetailBody mount present", html.includes('id="pathDetailBody"'));
check("back link targets #paths", html.includes('href="#paths" class="btn btn-ghost btn-sm path-back"'));
check("recommended-path CTA deep-links fundamentals", html.includes('href="#path/fundamentals"'));
check("12 tool cards carry jump ids", (html.match(/tool-card reveal" id="tool-/g) || []).length === 12);
check("MODULE 39 registered before the tools marker", modEnd > modStart && modEnd < js.length);

/* ---------- CSS wiring (responsive / RTL / view hiding) ---------- */
console.log("\u2014 CSS wiring \u2014");
check("auto-fill grid adapts to any width", css.includes("repeat(auto-fill, minmax(min(100%, 280px), 1fr))"));
check("mobile rules for detail view exist", /@media \(max-width: 700px\)[\s\S]*\.path-detail-head \{ flex-direction: column/.test(css));
check("reduced-motion guard covers path UI", css.includes(".path-card, .path-chip, .path-topic, .path-topic-check { transition: none; }"));
check("view-switcher hides the inactive #path section", css.includes(".js-view-switcher .section:not(.is-active)"));
check("arrows are direction-aware (RTL default, LTR override)", css.includes('[dir="ltr"] .path-card-cta::after') && css.includes('[dir="ltr"] .path-back::before'));
check("MODULE 39 layer is closed", css.includes("END MODULE 39"));

/* ---------- Service Worker ---------- */
console.log("\u2014 service worker \u2014");
/* Assert a MINIMUM cache version (Phase 5 baseline v1.17.0) instead of an
   exact string, so legitimate future bumps don't stale-fail the suite.
   A rollback below the baseline (lost fixes) is still caught. */
const verMatch = sw.match(/CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/);
const verOk = !!verMatch && (
  (+verMatch[1] > 1) ||
  (+verMatch[1] === 1 && +verMatch[2] > 17) ||
  (+verMatch[1] === 1 && +verMatch[2] === 17 && +verMatch[3] >= 0)
);
check("cache version >= v1.17.0 (Phase 5 baseline)", verOk);
check("cache name derived from CACHE_VERSION", sw.includes("motmi-portal-${CACHE_VERSION}"));

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);

