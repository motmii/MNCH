"use strict";
/**
 * Phase 4 smoke test for MODULE 42 (ToolsEdu).
 * Validates the real assets:
 *   - TOOLS_META covers exactly the 12 tool cards; every entry has
 *     AR/EN name, valid level, bilingual purpose + safety, example,
 *     an owning path that EXISTS in LEARNING_PATHS, and quiz refs that
 *     resolve to the 5 current-semester banks (course codes)
 *   - with LESSONS = {} (migration 2) no tool carries a lesson chip —
 *     no dead #lesson/ links are rendered
 *   - required safety wording (Caesar/playground not secure, JWT is
 *     not signature verification, local-only password analysis,
 *     global no-real-secrets notice)
 *   - example fill/click/copy target ids all exist in index.html
 *   - LABS_META covers exactly the 4 lab mounts, live status,
 *     objective/skills/hints/explanation, completion toggle flow
 *     (aria-pressed, store write, explanation reveal) — behaviorally
 *   - dict keys used by MODULE 42 exist in BOTH dictionaries
 *   - HTML mounts + CSS wiring
 * Run: node tests/tools-labs-smoke.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

/* ---------- extract MODULE 42: consts boot + IIFE ---------- */
const mStart = js.indexOf("const TOOLS_META = {");
const mEnd = js.indexOf("/* @@TOOLS_D@@ */", mStart);
if (mStart < 0 || mEnd < 0) throw new Error("MODULE 42 not found");
const mSrc = js.slice(mStart, mEnd);
const iifeStart = mSrc.indexOf("(function initToolsEdu() {");
if (iifeStart < 0) throw new Error("initToolsEdu IIFE not found");
const bootSrc = mSrc.slice(0, iifeStart);
const iifeSrc = mSrc.slice(iifeStart);

/* ---------- fake DOM ---------- */
function stubEl(id) {
  return {
    id: id, value: "", textContent: "", hidden: false,
    dispatchEvent() {}, addEventListener() {},
    classList: { contains() { return false; } },
    style: { cssText: "" },
    setAttribute() {}, getAttribute() { return null; },
  };
}
const mounts = {};          /* labMeta-* stubs */
const elReg = {};           /* example/copy target stubs */
const cards = [];           /* fake .tool-card stubs */
const eduCaptured = {};     /* card id → captured edu html (last) */
const docListeners = {};    /* document.addEventListener capture */
function makeCard(id) {
  const card = { id, dispatched: [] };
  card.querySelectorAll = function () { return []; };
  card.dispatchEvent = function (e) { card.dispatched.push(e); };
  card.querySelector = function (sel) {
    if (sel === ".tool-title") {
      return {
        insertAdjacentHTML: function (pos, h) { eduCaptured[id] = h; },
      };
    }
    return null; /* ".tool-edu" never found → simple re-insert */
  };
  eduCaptured[id] = "";
  return card;
}
const sandbox = {
  console,
  __motivationCalls: [],
  $id: function (id) { return mounts[id] || elReg[id] || null; },
  document: {
    getElementById: function (id) { return mounts[id] || elReg[id] || null; },
    querySelectorAll: function (sel) { return sel === ".tool-card" ? cards : []; },
    querySelector: function () { return null; },
    createElement: function () { return stubEl("_tmp"); },
    addEventListener: function (type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
    body: { appendChild() {}, removeChild() {} },
  },
  navigator: { clipboard: { writeText: function (t) { sandbox.__copied = t; return { then: function (f) { f(); } }; } } },
  Event: function (type, opts) { this.type = type; },
  CustomEvent: function (type, opts) { this.type = type; this.detail = opts && opts.detail; },
  /* The real helper is hoisted outside MODULE 42; this isolated slice only
     needs a safe bridge so lab completion keeps executing unchanged. */
  awardMotivation: function (kind, id) { sandbox.__motivationCalls.push([kind, id]); },
  Store: {
    __data: {},
    get(k, f) { return (k in this.__data) ? this.__data[k] : f; },
    set(k, v) { this.__data[k] = v; sandbox.__storeWrites.push([k, v]); },
  },
  Lang: {
    current: "ar",
    t(k) { return k; },
    qt(k) { return k; },
    onSwitch() {},
  },
  __copied: null,
  setTimeout: function (fn) { fn(); return 0; },
  clearTimeout: function () {},
};
sandbox.__storeWrites = [];
Object.keys({
  "tool-hash": 1, "tool-caesar": 1, "tool-jwt": 1, "tool-cidr": 1, "tool-password": 1, "tool-encoders": 1,
  "tool-regex": 1, "tool-fw": 1, "tool-vuln": 1, "tool-sniffer": 1, "tool-portscan": 1, "tool-playground": 1,
}).forEach((id) => { var c = makeCard(id); cards.push(c); mounts[id] = c; });
["games", "redteam", "ir", "cryptolab"].forEach((v) => { mounts["labMeta-" + v] = { innerHTML: "" }; });

vm.createContext(sandbox);
vm.runInContext(bootSrc + "\n;this.TOOLS_META = TOOLS_META; this.LABS_META = LABS_META;\n", sandbox, { filename: "m42-boot.js" });
function runIife() { vm.runInContext(iifeSrc, sandbox, { filename: "m42-iife.js" }); }
runIife();

let failures = 0;
function check(name, cond) {
  if (cond) { console.log("  \u2713 " + name); }
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}
const TOOLS_META = sandbox.TOOLS_META;
const LABS_META = sandbox.LABS_META;

const idsFromHtml = [...new Set((html.match(/id="(tool-[a-z]+)"/g) || []).map((s) => s.slice(4, -1)))];
console.log("\u2014 meta coverage \u2014");
check("TOOLS_META covers exactly the 12 tool cards", JSON.stringify(Object.keys(TOOLS_META).sort()) === JSON.stringify(idsFromHtml.sort()));
const LEVELS = { beginner: 1, intermediate: 1, advanced: 1 };
let complete = true;
Object.keys(TOOLS_META).forEach((id) => {
  const t = TOOLS_META[id];
  if (!t.name || !t.name.ar || !t.name.en || !LEVELS[t.level] || !t.purpose || !t.purpose.ar || !t.purpose.en ||
      !t.safety || !t.safety.ar || !t.safety.en || !t.example || !t.path || !idsFromHtml.includes(id)) complete = false;
});
check("every tool meta: AR/EN name, level, purpose, safety, example, path", complete);

/* real-content resolution: LESSONS subjects + quiz subjects */
function braceSlice(str, anchor, openCh, closeCh) {
  const s = str.indexOf(anchor);
  const open = str.indexOf(openCh, s);
  let d = 0, q = null;
  for (let i = open; i < str.length; i++) {
    const c = str[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === "\"" || c === "'" || c === "`") { q = c; continue; }
    if (c === openCh) d++;
    else if (c === closeCh) { d--; if (d === 0) return str.slice(s, i + 1); }
  }
  throw new Error("unbalanced " + anchor);
}
const lessonsSrc = braceSlice(js, "const LESSONS = {", "{", "}");
const LSN = vm.runInNewContext("(" + lessonsSrc.slice(lessonsSrc.indexOf("{")) + ")", {});
const quizJson = JSON.parse(fs.readFileSync(path.join(root, "data", "quizzes.json"), "utf8"));
const quizSubjects = Object.keys(quizJson);
const pathIds = (function () {
  const s = js.indexOf("const LEARNING_PATHS = [");
  let depth = 0, end = -1;
  for (let i = js.indexOf("[", s); i < js.length; i++) {
    if (js[i] === "[") depth++;
    else if (js[i] === "]" && --depth === 0) { end = i + 1; break; }
  }
  return [...js.slice(s, end).matchAll(/\n\s+id: "([a-z\-]+)",/g)].map((m) => m[1]);
})();
let refsOk = true;
Object.keys(TOOLS_META).forEach((id) => {
  const t = TOOLS_META[id];
  if (t.lesson) { const p = t.lesson.split("/"); if (!LSN[p[0]] || !LSN[p[0]][p[1]]) refsOk = false; }
  if (t.quiz && quizSubjects.indexOf(t.quiz) < 0) refsOk = false;
  if (pathIds.indexOf(t.path) < 0) refsOk = false;
});
check("path + quiz refs resolve to real content (paths + current banks)", refsOk);
const withLesson = Object.keys(TOOLS_META).filter((id) => TOOLS_META[id].lesson);
check("no lesson refs while LESSONS is empty (migration 2)", Object.keys(LSN).length === 0 && withLesson.length === 0);
const withQuiz = Object.keys(TOOLS_META).filter((id) => TOOLS_META[id].quiz);
check("every quiz ref is a current-semester course code", withQuiz.length > 0 && withQuiz.every((id) => quizSubjects.indexOf(TOOLS_META[id].quiz) >= 0));
check("every owning path id exists in LEARNING_PATHS", Object.keys(TOOLS_META).every((id) => pathIds.indexOf(TOOLS_META[id].path) >= 0));

console.log("\u2014 example / copy targets exist in HTML \u2014");
let exOk = true;
Object.keys(TOOLS_META).forEach((id) => {
  const ex = TOOLS_META[id].example;
  (ex.fill || []).forEach((f) => { if (!html.includes('id="' + f.id + '"')) exOk = false; });
  if (ex.click && !html.includes('id="' + ex.click + '"')) exOk = false;
});
check("every example fill/click id exists in index.html", exOk);
let copyOk = true;
Object.keys(TOOLS_META).forEach((id) => { const c = TOOLS_META[id].copy; if (c && !html.includes('id="' + c + '"')) copyOk = false; });
check("every copy target id exists in index.html", copyOk);
const jwtEx = TOOLS_META["tool-jwt"].example.fill[0].value;
check("JWT safe example: 3 segments, canonical demo token", jwtEx.split(".").length === 3 && jwtEx.startsWith("eyJ") && jwtEx.indexOf("SflKxw") > 0);

console.log("\u2014 required safety wording \u2014");
const S = TOOLS_META;
check("Caesar: educational, not secure (AR+EN)", /\u062a\u0639\u0644\u064a\u0645\u064a/.test(S["tool-caesar"].safety.ar) && /NOT secure/i.test(S["tool-caesar"].safety.en));
check("Playground: never protect real data", /\u0644\u0627 \u062a\u0633\u062a\u062e\u062f\u0645/.test(S["tool-playground"].safety.ar) && /never protect real data/i.test(S["tool-playground"].safety.en));
check("JWT: decoding is NOT signature verification + never real tokens", S["tool-jwt"].safety.ar.indexOf("\u0627\u0644\u062a\u0648\u0642\u064a\u0639") >= 0 && S["tool-jwt"].safety.ar.indexOf("\u0631\u0645\u0648\u0632\u064b\u0627") >= 0 && /NOT signature verification/i.test(S["tool-jwt"].safety.en) && /Never paste real tokens/i.test(S["tool-jwt"].safety.en));
check("Password analyzer: local-only + demo-password advice", S["tool-password"].safety.ar.indexOf("100%") >= 0 && /Runs 100% locally/i.test(S["tool-password"].safety.en));
check("Vuln/portscan: permission + legality warnings", /\u0625\u0630\u0646|\u062a\u0645\u0644\u0643\u0647\u0627/.test(S["tool-vuln"].safety.ar) && /never scan/i.test(S["tool-vuln"].safety.en) && /illegal/i.test(S["tool-portscan"].safety.en));

console.log("\u2014 render scenario (AR) \u2014");
const allEdu = Object.keys(TOOLS_META).every((id) => eduCaptured[id] && eduCaptured[id].indexOf("tool-edu") >= 0);
check("edu block inserted into all 12 cards", allEdu);
const C = eduCaptured;
check("caesar card: level chip + example/reset + path/quiz chips",
  C["tool-caesar"].indexOf('data-tool-example="tool-caesar"') >= 0 && C["tool-caesar"].indexOf('data-tool-reset="tool-caesar"') >= 0 &&
  C["tool-caesar"].indexOf("path-level is-beginner") >= 0 && C["tool-caesar"].indexOf('href="#path/cryptography"') >= 0 &&
  C["tool-caesar"].indexOf('data-quiz-jump="260210031102"') >= 0);
check("jwt card: copy button targets payload", C["tool-jwt"].indexOf('data-tool-copy="jwtPayload"') >= 0);
check("no lesson chip on the hash card (no authored lessons)", C["tool-hash"].indexOf('href="#lesson/') < 0 && C["tool-hash"].indexOf('href="#path/cryptography"') >= 0 && C["tool-hash"].indexOf('data-quiz-jump="260210031102"') >= 0);
check("no lesson chip on the regex card (no authored lessons)", C["tool-regex"].indexOf('href="#lesson/') < 0 && C["tool-regex"].indexOf('data-quiz-jump="260210031102"') >= 0);
check("cidr card links to the networking path and its course bank", C["tool-cidr"].indexOf('href="#path/networking"') >= 0 && C["tool-cidr"].indexOf('data-quiz-jump="260210031002"') >= 0);
check("no dead lesson or legacy quiz links in ANY rendered card",
  Object.keys(C).every((id) => C[id].indexOf('href="#lesson/') < 0 && !/data-quiz-jump="(networks|os|crypto|db|secureCode|ethical)"/.test(C[id])));
check("no copy button when meta.copy is null", C["tool-cidr"].indexOf("data-tool-copy") < 0);
const G = mounts["labMeta-games"].innerHTML;
check("games panel: objective/skills/hints/responsible/toggle",
  G.indexOf("labs.objective") >= 0 && G.indexOf("labs.skills") >= 0 && G.indexOf("labs.hints") >= 0 &&
  G.indexOf("labs.responsibleUse") >= 0 && G.indexOf('data-lab-done="games"') >= 0 && G.indexOf('aria-pressed="false"') >= 0);
["redteam", "ir", "cryptolab"].forEach((v) => check("lab panel rendered: " + v, mounts["labMeta-" + v].innerHTML.indexOf("labs.responsibleUse") >= 0));

console.log("\u2014 behaviors \u2014");
const clickHandler = (docListeners.click || [])[0];
check("delegated click handler registered", typeof clickHandler === "function");
elReg.hashOut = stubEl("hashOut"); elReg.hashOut.textContent = "abc123";
clickHandler({ target: { closest: function (sel) { return sel === "[data-tool-copy]" ? { getAttribute: function () { return "hashOut"; } } : null; } } });
check("copy writes output text to clipboard", sandbox.__copied === "abc123");
const hashIn = stubEl("hashInput"); elReg.hashInput = hashIn;
let fired = 0; hashIn.dispatchEvent = function () { fired++; };
clickHandler({ target: { closest: function (sel) { return sel === "[data-tool-example]" ? { getAttribute: function () { return "tool-hash"; } } : null; } } });
check("safe example fills the input + fires events", hashIn.value === "hello world" && fired >= 1);
const hashCard = cards.filter(function (c) { return c.id === "tool-hash"; })[0];
clickHandler({ target: { closest: function (sel) { return sel === "[data-tool-reset]" ? { getAttribute: function () { return "tool-hash"; } } : null; } } });
check("reset dispatches nova:tool-reset with tool id", hashCard.dispatched.length === 1 && hashCard.dispatched[0].detail.id === "tool-hash");
const fwCard = cards.filter(function (c) { return c.id === "tool-fw"; })[0];
clickHandler({ target: { closest: function (sel) { return sel === "[data-tool-reset]" ? { getAttribute: function () { return "tool-fw"; } } : null; } } });
check("fw reset: listener + dispatch both present (2 sites)", (js.match(/nova:tool-reset/g) || []).length === 2 && fwCard.dispatched.length === 1);
const fakeEv = function (attr) { return { target: { closest: function (sel) { return sel === "[data-lab-done]" ? { getAttribute: function () { return attr; } } : null; } } }; };
clickHandler(fakeEv("games"));
const labWrite = sandbox.__storeWrites.filter(function (w) { return w[0] === "labs"; })[0];
check("completion writes the labs store entry", !!labWrite && labWrite[1].done.games === true);
const GD = mounts["labMeta-games"].innerHTML;
check("completed panel: badge + explanation + aria-pressed=true",
  GD.indexOf("labs.completed") >= 0 && GD.indexOf("labs.explainTitle") >= 0 && GD.indexOf('aria-pressed="true"') >= 0);
clickHandler(fakeEv("games"));
check("untoggle restores not-done state", mounts["labMeta-games"].innerHTML.indexOf('aria-pressed="false"') >= 0 && mounts["labMeta-games"].innerHTML.indexOf("labs.completed") < 0);

console.log("\u2014 EN locale repaint \u2014");
sandbox.Lang.current = "en";
runIife();
check("EN repaint: complement is the AR name (no ltr dir)", C["tool-caesar"].indexOf('dir="ltr"') < 0 && C["tool-caesar"].indexOf("tool-edu") >= 0);
sandbox.Lang.current = "ar";
runIife();

console.log("\u2014 LABS_META completeness \u2014");
check("labs cover exactly the 4 mounts in HTML", JSON.stringify(Object.keys(LABS_META).sort()) === JSON.stringify(["cryptolab", "games", "ir", "redteam"]) && (html.match(/lab-meta-mount/g) || []).length === 4);
let labOk = true;
Object.keys(LABS_META).forEach((v) => {
  const L = LABS_META[v];
  if (L.status !== "live" || !LEVELS[L.level] || !L.objective.ar || !L.objective.en || !L.explanation.ar || !L.explanation.en ||
      L.skills.length < 3 || L.hints.length < 2 || !L.skills.every((s) => s.ar && s.en) || !L.hints.every((h) => h.ar && h.en)) labOk = false;
});
check("every lab: live, level, bilingual objective/skills/hints/explanation", labOk);

console.log("\u2014 dict keys used by MODULE 42 exist in BOTH dicts \u2014");
const dictStart = js.indexOf("const DICT = {");
function sliceObject(src, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}
const dictSrc = js.slice(dictStart, sliceObject(js, js.indexOf("{", dictStart)));
const arSrc = dictSrc.slice(dictSrc.indexOf("ar: {"), dictSrc.indexOf("en: {"));
const enSrc = dictSrc.slice(dictSrc.indexOf("en: {"));
const NEW_KEYS = ["toolsEdu.notice", "toolsEdu.name", "toolsEdu.purpose", "toolsEdu.safety", "toolsEdu.tryExample", "toolsEdu.reset",
  "toolsEdu.copy", "toolsEdu.copied", "toolsEdu.related", "toolsEdu.lessonChip", "toolsEdu.pathChip", "toolsEdu.quizChip",
  "labs.objective", "labs.skills", "labs.hints", "labs.markDone", "labs.markUndone", "labs.completed", "labs.explainTitle", "labs.responsibleUse"];
let dictOk = true;
NEW_KEYS.forEach((k) => { if (arSrc.indexOf('"' + k + '"') < 0 || enSrc.indexOf('"' + k + '"') < 0) dictOk = false; });
check("all 20 new keys present in ar + en dicts", dictOk);
check("notice forbids real secrets (AR+EN)", arSrc.indexOf("\u0628\u064a\u0627\u0646\u0627\u062a \u0633\u0631\u064a\u0629") >= 0 && /confidential data/i.test(enSrc));

console.log("\u2014 HTML + CSS wiring \u2014");
check("12 tool cards unchanged in HTML", (html.match(/tool-card reveal" id="tool-/g) || []).length === 12);
check("safety-notice injection present (source-level)", /className = "tool-safety-notice/.test(mSrc));
check("CSS: tool-edu + lab-responsible + mobile rule", css.includes(".tool-edu {") && css.includes(".lab-responsible {") && /@media \(max-width: 700px\)[\s\S]*\.tool-edu-row \{ flex-direction: column/.test(css));

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);


