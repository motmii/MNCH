"use strict";
/**
 * Phase v2.2.0 source tests — MODULE 81 · V0 Obsidian 2.0 Craft Layer
 * and MODULE 91 · SkillGraph connected-node edges.
 * Verifies version agreement, the craft tokens (hairlines, inner
 * highlights, spotlights), mono telemetry, the command-palette kbd
 * chrome, the announcements telemetry treatment, the connected-node
 * wiring, and that identity/motion/DOM contracts are untouched.
 * Run: node tests/design-v22.test.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const motionCss = fs.readFileSync(path.join(root, "motion.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

console.log("— version agreement (" + pkg.version + ") —");
check("package.json version is semver", /^\d+\.\d+\.\d+$/.test(pkg.version));
check("index.html links style.css?v=" + pkg.version, html.includes("style.css?v=" + pkg.version));
check("sw.js cache is v" + pkg.version, sw.includes('CACHE_VERSION = "v' + pkg.version + '"'));

const L81 = css.indexOf("MODULE 81 · V0 OBSIDIAN 2.0");
const L81END = css.indexOf("END MODULE 81 · V0 OBSIDIAN 2.0");
const layer = L81 >= 0 && L81END > L81 ? css.slice(L81, L81END) : "";
check("MODULE 81 layer exists with end marker", L81 >= 0 && L81END > L81);

console.log("— craft tokens (hairlines · inner highlight · spotlight) —");
check("hairline token is 0.08 white", /--hairline:\s*rgb\(var\(--wash-hi-rgb\)\s*\/\s*0\.08\)/.test(layer));
check("inner top highlight token exists", layer.includes("--inner-hi: inset 0 1px 0 rgb(var(--wash-hi-rgb) / 0.07)"));
check("radial spotlight token exists", /--spot:\s*radial-gradient\(/.test(layer));
check("elevation tokens exist", layer.includes("--elev-1:") && layer.includes("--elev-2:"));
check("focus ring token exists", layer.includes("--ring: 0 0 0 3px rgb(var(--accent-2-rgb) / 0.28)"));
check("frosted glass uses --glass-blur", layer.includes("backdrop-filter: var(--glass-blur)"));
check("identity tokens are not redefined", !/--bg:\s*#|--surface:\s*#101014|--accent:\s*#3DF5A5\s*;/.test(layer.slice(layer.indexOf(":root"), layer.indexOf("}"))));

console.log("— typography · kbd · telemetry —");
check("kbd keycap styling exists", /kbd \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));
check("section titles keep Arabic letter-spacing at 0", layer.includes("letter-spacing: 0"));
check("mono telemetry on tool outputs", /\.tool-out, \.hash-hex \{ font-family: var\(--font-mono\)/.test(layer));
check("mono telemetry on course codes", /\.sem-code \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));
check("course code chip is LTR-embedded", /\.sem-code \{[\s\S]*direction: ltr/.test(layer));
check("mono numerals on dash values", /\.hero-dash-value \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));

console.log("— A · navbar / updates / announce / command palette —");
check("nav cluster is a capsule", /\.nav-cluster \{[\s\S]*border-radius: 999px/.test(layer));
check("active nav link gets gradient indicator", layer.includes(".nav-links a.is-active::after"));
check("updates dot pulses (unique keyframes)", (css.match(/@keyframes navPulse/g) || []).length === 1);
check("live chip has a pulsing dot", layer.includes(".announce-chip--live::before") && (css.match(/@keyframes liveBlink/g) || []).length === 1);
check("announce metadata renders as mono pills", /\.announce-meta > \* \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));
check("announce bar keeps status rails", layer.includes('.announce-bar[data-status="live"] .announce-row'));
check("search panel is frosted with elev-2", /\.search-panel \{[\s\S]*var\(--elev-2\)/.test(layer));
check("search options glow when selected", layer.includes('.search-option[aria-selected="true"]'));
check("search group labels are instrument tags", layer.includes(".search-group::before"));
check("search foot hosts kbd hint cluster", layer.includes(".search-kbds") && html.includes('class="search-kbds"'));
check("kbd cluster is decorative for AT", /class="search-kbds" aria-hidden="true"/.test(html));

console.log("— B · hero + bento HUD —");
check("hero brand is a glass pill", /\.hero-brand \{[\s\S]*border-radius: 999px/.test(layer));
check("Now strip chips use mono", /\.hero-now-chip \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));
check("hero stats use tabular mono numerals", /\.hero-stat strong \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));
check("hero stats keep hairline separators", layer.includes(".hero-stat + .hero-stat"));
check("dash meters glow with gradient fill", layer.includes(".hero-dash-bar i") && layer.includes(".hero-dash-bar.is-path i"));
check("bento tiles carry spotlight + inner highlight", /\.hero-dash-cell \{[\s\S]*background-image: var\(--spot\)/.test(layer));
check("tab bar is a segmented control", /\.hero-tabs \{[\s\S]*border-radius: 999px/.test(layer));
check("continue tile is accent-tinted", layer.includes(".hero-dash-cell.is-continue"));

console.log("— C · semester / paths / skill graph —");
check("semester summary is a HUD panel", /\.semester-summary \{[\s\S]*var\(--elev-1\)/.test(layer));
check("semester empty state is dashed glass", /\.sem-empty \{[\s\S]*border: 1px dashed/.test(layer));
check("semester link chips have hover language", layer.includes(".sem-links a:hover"));
check("path cards wear the instrument recipe", /\.path-card \{[\s\S]*background-image: var\(--spot\)/.test(layer));
check("path topics draw a connected rail", layer.includes(".path-topic::before") && layer.includes(".path-topic-num"));
check("path rail nodes are mono", /\.path-topic-num \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));
check("skill tree is a positioned graph host", /\.skill-tree \{ position: relative/.test(layer));
check("skill graph svg sits behind cards", layer.includes(".skill-graph") && /\.skill-card \{[\s\S]*z-index: 1/.test(layer));
check("edges inherit accent-2 hairline color", /\.skill-graph \{[\s\S]*color: rgb\(var\(--accent-2-rgb\) \/ 0.22\)/.test(layer));

console.log("— D/E/F · tools, labs, quiz, lesson, overlays —");
check("tool inputs get the unified focus ring", layer.includes(".tool-input:focus-visible") && layer.includes("var(--ring)"));
check("quiz option keys reuse the keycap look", /\.q-option-key \{[\s\S]*font-family: var\(--font-mono\)/.test(layer));
check("lab icon wells use accent-2", /\.lab-link-ico \{[\s\S]*var\(--accent-2-rgb\)/.test(layer));
check("lesson English terms are mono", /\.lesson-term-en \{ font-family: var\(--font-mono\)/.test(layer));
check("assistant panel is frosted with elev-2", /\.assistant-panel \{[\s\S]*var\(--elev-2\)/.test(layer));
check("material viewer stays glass", layer.includes(".mat-viewer-panel"));
check("canva studio keeps its border rail", layer.includes(".canva-studio-panel"));
check("footer hairline present", /\.footer \{ border-top: 1px solid var\(--hairline\)/.test(layer));

console.log("— responsive · motion guards · identity bans —");
check("announce bar has a 560px mobile rule", /@media \(max-width: 560px\)[\s\S]*\.announce-bar/.test(layer));
check("bento collapses on small screens", /@media \(max-width: 640px\)[\s\S]*\.hero-dash-grid\.is-3 \{ grid-template-columns: 1fr; \}/.test(layer));
check("reduced motion stops pulses", /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/.test(layer));
check("no palette/theme CSS introduced", !layer.includes("[data-theme=") && !layer.includes("prefers-color-scheme") && !/--palette/.test(layer));
check("logical RTL properties used", layer.includes("border-inline-start") && layer.includes("inset-inline") && layer.includes("padding-inline-start"));

console.log("— MODULE 91 · skill graph wiring —");
const G1 = js.indexOf("/* @@SKILL_GRAPH_START@@ */");
const G2 = js.indexOf("/* @@SKILL_GRAPH_END@@ */");
const graph = G1 >= 0 && G2 > G1 ? js.slice(G1, G2) : "";
check("MODULE 91 exists with markers", G1 >= 0 && G2 > G1);
check("uses createElementNS only (no HTML-string writes)", graph.includes("createElementNS"));
check("reads the real PREREQS edge map", graph.includes("window.PlatformSkillTree") && graph.includes("PREREQS"));
check("anchors edges to data-skill-id cards", graph.includes('data-skill-id'));
check("recomputes on view switch and progress", graph.includes("nova:view-changed") && graph.includes("nova:progress-changed"));
check("recomputes on resize and tree mutations", graph.includes('"resize"') && graph.includes("MutationObserver"));
check("redraws after fonts settle", graph.includes("document.fonts"));
check("exposes PlatformSkillGraph surface", graph.includes("window.PlatformSkillGraph"));
check("hidden or tiny trees stay empty", graph.includes("tree.offsetParent") && graph.includes("ids.length < 2"));

/* The hero-wave1 invariant applies to everything after initHeroNow(). */
const w1 = js.indexOf("(function initHeroNow()");
const tail = w1 > -1 ? js.slice(w1) : "";
check("hero-wave1 invariant intact (no innerHTML after initHeroNow)", !tail.includes("innerHTML"));
check("hero-wave1 invariant intact (no network calls after initHeroNow)", !/fetch\s*\(|XMLHttpRequest/.test(tail));

console.log("— DOM + motion contracts preserved —");
["heroDashPct", "semesterGrid", "skillsTree", "announceBar", "searchResults", "heroNowText", "searchInput"].forEach((id) => {
  check("#" + id + " still present", html.includes('id="' + id + '"'));
});
check("motion.css still linked after style.css", html.indexOf("motion.css") > html.indexOf("style.css?v=" + pkg.version));
check("motion word units untouched", motionCss.includes(".m-word"));
check("motion card glow untouched", motionCss.includes("html.motion-on .skill-card::after"));
check("motion.js loader untouched", html.includes("vendor/gsap.min.js") && html.includes("motion.js"));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
