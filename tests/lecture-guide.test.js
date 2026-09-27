"use strict";
/**
 * Lecture access guide test (MODULE 61).
 * Validates the real assets:
 *   - index.html ships the standalone #guide view (section + #guideBody),
 *     the #semesterGuide inline mount OUTSIDE #semesterGrid, nav links in
 *     the desktop + mobile menus, and the contextual #heroNowGuide anchor
 *   - current-semester.js lectureGuide: bilingual {ar,en} everywhere,
 *     6 steps · 3 links · 5 problems, https-only real Microsoft endpoints
 *   - script.js: #guide registered in VIEWS, every guide.* / nav.guide key
 *     in BOTH dicts, MODULE 61 builds the DOM with createElement/textContent
 *     (no raw HTML strings, no network, never touches #semesterGrid),
 *     external links hardened with rel="noopener noreferrer"
 *   - MODULE 55 offers the strip link only for live/today/tomorrow classes
 *   - cache-bump consistency: style.css?v= ↔ sw.js CACHE_VERSION
 *   - live render in a stub DOM: timetable derived from meta.schedule,
 *     steps/links/problems present, locale switch re-renders
 * Run: node tests/lecture-guide.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  \u2713 " + name);
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}

/** True for a bilingual { ar, en } field with both sides non-empty. */
function biOk(v) {
  return !!v && typeof v === "object" &&
    typeof v.ar === "string" && !!v.ar.trim() &&
    typeof v.en === "string" && !!v.en.trim();
}

console.log("\u2014 index.html \u2014");
check("standalone #guide section", html.includes('<section class="section lecture-guide" id="guide"'));
check("#guideBody container inside it",
  html.indexOf('id="guide"') > -1 &&
  html.indexOf('id="guide"') < html.indexOf('id="guideBody"') &&
  html.indexOf('id="guideBody"') < html.indexOf('id="subjects"'));
check("guide head blocks use data-i18n (eyebrow/title/sub/back)",
  /data-i18n="guide\.eyebrow"/.test(html) &&
  /data-i18n-html="guide\.title"/.test(html) &&
  /data-i18n="guide\.sub"/.test(html) &&
  /data-i18n="guide\.back"/.test(html));
const semI = html.indexOf('id="semester"');
const mountI = html.indexOf('id="semesterGuide"');
const gridI = html.indexOf('id="semesterGrid"');
const semEnd = html.indexOf("</section>", semI);
check("#semesterGuide mount inside #semester but OUTSIDE #semesterGrid",
  semI > -1 && semI < mountI && mountI < gridI && gridI < semEnd &&
  html.includes('class="sem-guide-mount reveal" id="semesterGuide"'));
check("nav link in the desktop More menu",
  html.indexOf('href="#guide" data-i18n="nav.guide"') > -1);
check("nav link in the mobile menu", (html.match(/href="#guide"/g) || []).length >= 3);
check("contextual #heroNowGuide anchor (hidden by default, own route)",
  /id="heroNow"[\s\S]{0,700}?id="heroNowGuide" href="#guide" data-i18n="guide\.nowCta" hidden/.test(html));
check("current-semester.js still loads before script.js",
  html.indexOf('src="current-semester.js"') > -1 &&
  html.indexOf('src="current-semester.js"') < html.indexOf('src="script.js"'));

console.log("\u2014 current-semester.js \u00b7 lectureGuide data \u2014");
const g = cs.lectureGuide;
check("lectureGuide object exists", !!g && typeof g === "object");
check("bilingual warning + note", biOk(g && g.warning) && biOk(g && g.note));
check("6 steps, each bilingual (t + d)",
  Array.isArray(g.steps) && g.steps.length === 6 && g.steps.every((s) => biOk(s.t) && biOk(s.d)));
check("3 official links, each bilingual (title + desc)",
  Array.isArray(g.links) && g.links.length === 3 && g.links.every((l) => biOk(l.title) && biOk(l.desc)));
check("5 problems, each bilingual (q + a)",
  Array.isArray(g.problems) && g.problems.length === 5 && g.problems.every((p) => biOk(p.q) && biOk(p.a)));
const linksOk = g.links.every((l) => {
  if (!/^https:\/\/[^\s"']+$/i.test(l.url)) return false;
  let host = "";
  try { host = new URL(l.url).hostname; } catch (e) { return false; }
  return !!l.host && host.endsWith(l.host) && /(^|\.)microsoft\.com$|(^|\.)microsoftonline\.com$|(^|\.)aka\.ms$/.test(host);
});
check("links are https-only real Microsoft endpoints (no invented URLs)", linksOk);

console.log("\u2014 script.js \u00b7 router, i18n & MODULE 61 \u2014");
check("#guide registered in the ViewSwitcher VIEWS list",
  /const VIEWS = \[[\s\S]{0,220}?\$id\("guide"\)/.test(js));
/* Scoped dict extraction — same technique as paths-i18n.test.js */
const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
const guideKeys = [
  "nav.guide",
  "guide.eyebrow", "guide.title", "guide.sub", "guide.back",
  "guide.warning", "guide.scheduleTitle",
  "guide.thSubject", "guide.thCode", "guide.thDay", "guide.thTime",
  "guide.stepsTitle", "guide.linksTitle", "guide.open",
  "guide.copy", "guide.copied", "guide.copyFailed",
  "guide.problemsTitle", "guide.nowCta",
  "guide.cardTitle", "guide.cardDesc", "guide.cardCta", "guide.cardChip",
];
guideKeys.forEach((key) => {
  check("dict key \"" + key + "\" in ar + en",
    arSrc.includes("\"" + key + "\"") && enSrc.includes("\"" + key + "\""));
});
check("guide.title carries the grad accent in BOTH dicts",
  /"guide\.title": "[^"]*<em class=\\?"grad\\?">/.test(arSrc) &&
  /"guide\.title": "[^"]*<em class=\\?"grad\\?">/.test(enSrc));

const modAt = js.indexOf("(function initLectureGuide()");
check("MODULE 61 present with a defensive boot", modAt > -1 && js.includes("MODULE 61"));
const mod = modAt > -1 ? js.slice(modAt) : "";
check("builds DOM with createElement + textContent (never raw HTML)",
  mod.includes("document.createElement") && mod.includes("textContent") && !mod.includes("innerHTML"));
check("no network at all", !/fetch\s*\(|XMLHttpRequest/.test(mod));
check("never touches #semesterGrid", !mod.includes("semesterGrid"));
check("external links open safely (noopener noreferrer)",
  mod.includes("\"noopener noreferrer\"") && mod.includes("target = \"_blank\""));
check("clipboard: modern API + legacy fallback", mod.includes("navigator.clipboard.writeText") && mod.includes("execCommand(\"copy\")"));
check("re-renders on locale switch", mod.includes("L10N.onSwitch(render)"));
check("exposes window.PlatformLectureGuide", mod.includes("window.PlatformLectureGuide"));
check("empty-data state uses the shared honest fallback", mod.includes("semester.missingData"));

console.log("\u2014 entry points (MODULE 00b / 43 / 55 / 58) \u2014");
check("subject cards carry the guide chip (MODULE 00b)", js.includes("data-i18n=\"guide.cardChip\"") && js.includes("href=\"#guide\""));
check("semester subject cards carry the guide chip (MODULE 43)", js.includes("class=\"path-chip is-guide\" href=\"#guide\""));
check("hero strip offers the guide only for live/today/tomorrow classes",
  js.includes("guideEl.hidden = !(found.status === \"ongoing\" || found.daysAway <= 1)"));
check("hero strip hides the guide when there is no timetable",
  js.includes("if (guideEl) guideEl.hidden = true;"));
check("WhatsNew entry dated 2026-09-27", js.includes("date: \"2026-09-27\"") && js.includes("Lecture access guide"));

console.log("\u2014 style.css & cache bump \u2014");
[".hero-now-guide", ".sem-guide-mount", ".sem-guide {", ".guide-body", ".guide-warning",
 ".guide-table", ".guide-steps", ".guide-link", ".guide-faq", ".path-chip.is-guide"
].forEach((sel) => check("style for " + sel, css.includes(sel)));
check("layer closed with END MODULE 61 marker", css.includes("END MODULE 61 \u00b7 LectureGuide"));
check("reduced-motion guard", /prefers-reduced-motion: reduce[\s\S]{0,4000}?\.hero-now-guide/.test(css));
const cssVer = (html.match(/style\.css\?v=([\d.]+)/) || [])[1];
const swVer = (sw.match(/CACHE_VERSION\s*=\s*"v([\d.]+)"/) || [])[1];
check("cache bump consistent (style.css?v \u2194 sw.js CACHE_VERSION)", !!cssVer && cssVer === swVer);

console.log("\u2014 live render in a stub DOM \u2014");

/* Minimal DOM that supports exactly what MODULE 61 does:
   appendChild / removeChild / firstChild / setAttribute / textContent. */
function makeNode(tag) {
  return {
    tagName: String(tag || "").toUpperCase(),
    className: "", textContent: "", type: "", href: "", target: "", rel: "",
    hidden: false,
    attrs: {},
    children: [],
    parentNode: null,
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i > -1) this.children.splice(i, 1);
      return c;
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener() {}
  };
}
function walk(node, out) {
  (node.children || []).forEach((c) => { out.push(c); walk(c, out); });
  return out;
}
function clsOf(root, cls) {
  return walk(root, []).filter((n) => String(n.className || "").split(/\s+/).includes(cls));
}

const guideView = makeNode("section");
const guideBody = makeNode("div");
const semMount = makeNode("div");
const docListeners = [];
const documentStub = {
  getElementById(id) {
    if (id === "guide") return guideView;
    if (id === "guideBody") return guideBody;
    if (id === "semesterGuide") return semMount;
    return null;
  },
  createElement(tag) { return makeNode(tag); },
  addEventListener(type, fn) { docListeners.push([type, fn]); },
  body: makeNode("body")
};
const LangStub = {
  current: "ar",
  t(key) { return "[" + key + "]"; },
  onSwitch(fn) { LangStub.__switchers.push(fn); },
  __switchers: []
};
const windowStub = { PLATFORM_CURRENT_SEMESTER: cs };

new Function("document", "window", "Lang", "navigator", js.slice(modAt))(
  documentStub, windowStub, LangStub, {}
);

const api = windowStub.PlatformLectureGuide;
check("window.PlatformLectureGuide published with data/schedule/render/copy",
  !!api && typeof api.data === "function" && typeof api.schedule === "function" &&
  typeof api.render === "function" && typeof api.copy === "function");
check("locale-switch hook registered", LangStub.__switchers.length === 1);

const expectedRows = cs.subjects.filter(
  (s) => s.meta && s.meta.schedule && s.meta.schedule.startTime).length;
check("schedule() derives one row per official timetable slot",
  !!api && api.schedule().length === expectedRows && expectedRows === 5);

const inlineCards = clsOf(semMount, "sem-guide");
check("inline card rendered into #semesterGuide (mount untouched elsewhere)",
  semMount.children.length === 1 && inlineCards.length === 1);
const inlineCtas = walk(semMount, []).filter((n) => n.tagName === "A" && n.href === "#guide");
check("inline card CTA routes to #guide", inlineCtas.length >= 1);

const warning = clsOf(guideBody, "guide-warning");
check("warning rendered in AR with its label",
  warning.length === 1 && warning[0].children.length === 2 &&
  warning[0].children[1].textContent === cs.lectureGuide.warning.ar);
const tbodies = walk(guideBody, []).filter((n) => n.tagName === "TBODY");
check("weekly timetable rendered (5 rows, no invented slots)",
  tbodies.length === 1 && tbodies[0].children.length === expectedRows);
const stepsBox = clsOf(guideBody, "guide-steps");
check("6 ordered steps rendered", stepsBox.length === 1 && stepsBox[0].children.length === 6);
const linksBox = clsOf(guideBody, "guide-links");
check("3 official link rows rendered", linksBox.length === 1 && linksBox[0].children.length === 3);
check("5 troubleshooting disclosures rendered", clsOf(guideBody, "guide-faq").length === 5);
check("honest data-source note rendered", clsOf(guideBody, "guide-note").length === 1);

const extAnchors = walk(guideBody, []).filter((n) => n.tagName === "A" && n.target === "_blank");
check("external anchors: https + _blank + noopener noreferrer",
  extAnchors.length === 3 &&
  extAnchors.every((a) => a.rel === "noopener noreferrer" && /^https:\/\//.test(a.href)));
const copyBtns = walk(guideBody, []).concat(walk(semMount, [])).filter((n) => n.attrs["data-guide-copy"] !== undefined);
check("copy buttons carry https URLs (3 links + inline card)",
  copyBtns.length === 4 && copyBtns.every((n) => /^https:\/\//.test(n.attrs["data-guide-copy"])));
check("one delegated document click listener", docListeners.some((l) => l[0] === "click"));

LangStub.current = "en";
api.render();
const warningEn = clsOf(guideBody, "guide-warning");
check("switching locale re-renders the warning in EN",
  warningEn.length === 1 && warningEn[0].children[1].textContent === cs.lectureGuide.warning.en);

function report() {
  console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
  process.exit(failures ? 1 : 0);
}
Promise.resolve()
  .then(() => api.copy("https://teams.microsoft.com/"))
  .then((r) => { check("copy() resolves honestly (false) without a clipboard API", r === false); })
  .catch(() => { check("copy() resolves honestly (false) without a clipboard API", false); })
  .then(report, report);

