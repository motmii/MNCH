"use strict";
/**
 * Semester dashboard RENDER test (regression for "blank Current Semester").
 * ------------------------------------------------------------
 * Unlike the static smoke test, this EXECUTES script.js MODULE 43 in a
 * vm context with the REAL current-semester.js data and asserts that:
 *   1. The module runs to completion (no throw).
 *   2. #semesterMeta receives the summary block (non-empty).
 *   3. #semesterGrid receives 5 subject cards (non-empty).
 *   4. Each card carries a real data-quiz-jump link.
 *   5. The honest empty-lessons state renders (no fake content).
 * Run: node tests/semester-render.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

/* ---- Minimal DOM elements that capture innerHTML ---- */
function makeEl(id) {
  const el = {
    id,
    _html: "",
    listeners: {},
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, contains(c){return this._s.has(c);} },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    scrollIntoView() {}, focus() {},
  };
  Object.defineProperty(el, "innerHTML", { get(){ return el._html; }, set(v){ el._html = String(v); } });
  return el;
}

const grid = makeEl("semesterGrid");
const meta = makeEl("semesterMeta");

/* Tool cards referenced by the semester data (7 unique data-tool-jump ids). */
const TOOL_IDS = ["tool-hash","tool-caesar","tool-playground","tool-vuln","tool-portscan","tool-cidr","tool-sniffer"];
const toolCards = {};
TOOL_IDS.forEach((id) => {
  toolCards[id] = Object.assign(makeEl(id), {
    querySelector(sel) { return sel === ".tool-title" ? { textContent: { trim: () => id } } : null; },
  });
});
const labViews = { cryptolab: makeEl("cryptolab"), redteam: makeEl("redteam") };

/* Bilingual dict — enough keys for MODULE 43's chrome. */
const DICT_AR = {
  "semester.program":"البرنامج","semester.subjectsCount":"المواد","semester.credits":"الساعات المعتمدة",
  "semester.code":"رمز المقرر","semester.creditHours":"ساعات معتمدة","semester.estHours":"ساعات دراسة تقديرية",
  "semester.prerequisites":"المتطلبات السابقة","semester.prerequisitesNone":"لا توجد متطلبات سابقة لهذه المادة.",
  "semester.outcomes":"مخرجات التعلم","semester.mistakes":"أخطاء شائعة","semester.terms":"مصطلحات أساسية",
  "semester.lessons":"الدروس","semester.lessonsSoon":"سيتم إضافة الدروس قريبًا.",
  "semester.quizChip":"بنك الأسئلة","semester.tools":"أدوات ذات صلة","semester.labs":"معامل ذات صلة",
  "semester.missingData":"بيانات الترم الحالي غير متوفرة حاليًا.",
  "nav.cryptolab":"مختبر التشفير","nav.redteam":"المختبر الهجومي",
  "paths.level.beginner":"مبتدئ","paths.level.intermediate":"متوسط","paths.level.advanced":"متقدم",
};
const LangStub = {
  current: "ar",
  t(key, params) {
    let s = DICT_AR[key] != null ? DICT_AR[key] : key;
    if (params) Object.keys(params).forEach((k) => { s = s.split("{" + k + "}").join(String(params[k])); });
    return s;
  },
  onSwitch() {},
};

const sandbox = {
  console,
  window: { PLATFORM_CURRENT_SEMESTER: cs, addEventListener() {} },
  document: {
    getElementById(id) {
      if (id === "semesterGrid") return grid;
      if (id === "semesterMeta") return meta;
      if (toolCards[id]) return toolCards[id];
      if (labViews[id]) return labViews[id];
      return null;
    },
    addEventListener() {},
  },
  Lang: LangStub,
  QUIZZES: {},
  TOOLS_META: undefined,
  escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  },
};
vm.createContext(sandbox);

/* Extract ONLY MODULE 43 (from its IIFE to the start of MODULE 47's IIFE).
   Anchored on the function names (not the "MODULE 47" label, which also
   appears inside an i18n comment block earlier in the file). */
const start = js.indexOf("(function initSemesterDashboard()");
const end = js.indexOf("(function initHeroDash()");
check("MODULE 43 block located", start >= 0 && end > start);
const mod = js.slice(start, end);

let threw = null;
try {
  vm.runInContext(mod, sandbox, { filename: "module43.js" });
} catch (e) { threw = e; }
check("MODULE 43 executes without throwing", !threw);
if (threw) { console.error("    → " + threw.message); }

check("#semesterMeta populated (non-empty)", meta.innerHTML.trim().length > 0);
check("#semesterGrid populated (non-empty)", grid.innerHTML.trim().length > 0);
check("5 subject cards rendered", (grid.innerHTML.match(/class="work-card sem-card"/g) || []).length === 5);
check("5 real quiz links (data-quiz-jump)", (grid.innerHTML.match(/data-quiz-jump="/g) || []).length === 5);
check("honest empty-lessons state ×5", (grid.innerHTML.match(/سيتم إضافة الدروس قريبًا/g) || []).length === 5);
check("no [object Object] leaked into the DOM", !grid.innerHTML.includes("[object Object]") && !meta.innerHTML.includes("[object Object]"));
check("summary shows 5 subjects + 15 credit hours", meta.innerHTML.includes("<dd>5</dd>") && meta.innerHTML.includes("<dd>15</dd>"));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
