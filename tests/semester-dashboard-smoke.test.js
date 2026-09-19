"use strict";
/**
 * Semester dashboard smoke test (MODULE 43).
 * Validates the real assets:
 *   - index.html has the REAL <section id="semester"> dashboard view,
 *     loads current-semester.js BEFORE script.js, and mounts
 *     #semesterGrid / #semesterMeta
 *   - the #semester route is a registered ViewSwitcher view (no stale
 *     "semester → subjects" alias)
 *   - MODULE 43 renders EXACTLY the 5 official subjects from
 *     window.PLATFORM_CURRENT_SEMESTER — course codes, schedules,
 *     credit hours (15 total), difficulty, study hours
 *   - every card links to a REAL quiz bank (data-quiz-jump), tool card
 *     (data-tool-jump) and lab view — no fake links
 *   - honest empty states: lessons → «سيتم إضافة الدروس قريبًا»,
 *     empty prerequisites → explicit note (×5 each)
 *   - MODULE 22 dict: every "semester.*" key exists in BOTH ar & en
 * Run: node tests/semester-dashboard-smoke.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  \u2713 " + name);
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}

console.log("\u2014 static assets \u2014");
check("real #semester section exists", /<section class="section semester-dashboard" id="semester"/.test(html));
check("mounts #semesterMeta + #semesterGrid", html.includes('id="semesterMeta"') && html.includes('id="semesterGrid"'));
check("current-semester.js loads BEFORE script.js",
  html.indexOf('src="current-semester.js"') >= 0 &&
  html.indexOf('src="current-semester.js"') < html.indexOf('src="script.js"'));
check("#semester is a registered view", /const VIEWS = \[\s*\$id\("hero"\), \$id\("semester"\)/m.test(js));
check("no stale alias semester→subjects", !/VIEW_ALIASES = \{[^}]*semester/.test(js));

console.log("\u2014 official data \u2014");
const EXPECTED = ["260210030702", "260210030802", "260210030902", "260210031002", "260210031102"];
const TOOLS = ["tool-hash", "tool-caesar", "tool-playground", "tool-vuln", "tool-portscan", "tool-cidr", "tool-sniffer"];
check("5 official subjects in current-semester.js", cs.subjects.length === 5 && EXPECTED.every((c) => cs.subjects.some((s) => s.code === c)));
check("total credit hours = 15", cs.subjects.reduce((a, s) => a + s.meta.creditHours, 0) === 15);
check("all lesson arrays honestly empty", cs.subjects.every((s) => Array.isArray(s.lessons) && s.lessons.length === 0));

console.log("\u2014 MODULE 43 render (stubbed DOM) \u2014");
const modStart = js.indexOf("(function initSemesterDashboard()");
check("MODULE 43 found", modStart >= 0);
const mod = js.slice(modStart);

function makeEl() {
  return {
    _html: "",
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}
const grid = makeEl();
const meta = makeEl();
const toolCards = {};
TOOLS.forEach((id) => {
  toolCards[id] = Object.assign(makeEl(), {
    querySelector(sel) { return sel === ".tool-title" ? { textContent: { trim: () => id } } : null; },
  });
});
const labViews = { cryptolab: makeEl(), redteam: makeEl() };
const documentStub = {
  addEventListener() {},
  getElementById(id) {
    if (id === "semesterGrid") return grid;
    if (id === "semesterMeta") return meta;
    if (toolCards[id]) return toolCards[id];
    if (labViews[id]) return labViews[id];
    return null;
  },
};
const DICT_AR = {
  "semester.program": "البرنامج", "semester.subjectsCount": "المواد", "semester.credits": "الساعات المعتمدة",
  "semester.code": "رمز المقرر", "semester.creditHours": "ساعات معتمدة", "semester.estHours": "ساعات دراسة تقديرية",
  "semester.prerequisites": "المتطلبات السابقة", "semester.prerequisitesNone": "لا توجد متطلبات سابقة لهذه المادة.",
  "semester.outcomes": "مخرجات التعلم", "semester.mistakes": "أخطاء شائعة", "semester.terms": "مصطلحات أساسية",
  "semester.lessons": "الدروس", "semester.lessonsSoon": "سيتم إضافة الدروس قريبًا.",
  "semester.quizChip": "بنك الأسئلة", "semester.tools": "أدوات ذات صلة", "semester.labs": "معامل ذات صلة",
  "nav.cryptolab": "مختبر التشفير", "nav.redteam": "المختبر الهجومي",
  "paths.level.beginner": "مبتدئ", "paths.level.intermediate": "متوسط",
};
const LangStub = { current: "ar", t: (k) => (k in DICT_AR ? DICT_AR[k] : k), onSwitch() {} };
new Function("document", "window", "Lang", "TOOLS_META", "QUIZZES", "escHtml", mod)(
  documentStub, { PLATFORM_CURRENT_SEMESTER: cs }, LangStub, undefined, undefined,
  (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]))
);
const G = grid.innerHTML;
const M = meta.innerHTML;

check("summary: 5 subjects", M.includes("<dd>5</dd>"));
check("summary: 15 credit hours", M.includes("<dd>15</dd>"));
check("summary: program name", M.includes(cs.meta.program.ar));
check("summary: semester title", M.includes(cs.title.ar));
check("summary: description", M.includes(cs.description.ar));
check("5 cards rendered", (G.match(/class="work-card sem-card"/g) || []).length === 5);
check("all course codes", EXPECTED.every((c) => G.includes(c)));
check("all schedules (AM/PM times)", G.includes("09:00 AM") && G.includes("12:00 PM") && G.includes("03:00 PM"));
check("all AR subject names", cs.subjects.every((s) => G.includes(s.name.ar)));
check("5 real quiz links (#quiz + data-quiz-jump)", (G.match(/data-quiz-jump="/g) || []).length === 5 && G.includes('href="#quiz"'));
check("7 tool chips (data-tool-jump to real cards)", (G.match(/data-tool-jump="/g) || []).length === 7);
check("tool chips point to #tools", G.includes('href="#tools" data-tool-jump='));
check("lab links (#redteam + #cryptolab)", G.includes('href="#redteam"') && G.includes('href="#cryptolab"'));
check("lessons empty state ×5", (G.match(/سيتم إضافة الدروس قريبًا/g) || []).length === 5);
check("prerequisites empty state ×5", (G.match(/لا توجد متطلبات سابقة/g) || []).length === 5);
check("outcomes blocks", G.includes("مخرجات التعلم"));
check("mistakes blocks", G.includes("أخطاء شائعة"));
check("key terms blocks", G.includes("مصطلحات أساسية"));
check("difficulty labels via paths.level.*", G.includes("مبتدئ") && G.includes("متوسط"));
check("estimated study hours", G.includes("ساعات دراسة تقديرية") && G.includes("<b>18</b>"));

console.log("\u2014 i18n dictionary (MODULE 22) \u2014");
["ar", "en"].forEach((loc) => {
  ["semester.eyebrow", "semester.title", "semester.sub", "semester.program", "semester.subjectsCount",
    "semester.credits", "semester.code", "semester.creditHours", "semester.estHours", "semester.prerequisites",
    "semester.prerequisitesNone", "semester.outcomes", "semester.mistakes", "semester.terms", "semester.lessons",
    "semester.lessonsSoon", "semester.quizChip", "semester.tools", "semester.labs", "semester.missingData",
  ].forEach((key) => {
    const re = new RegExp('"' + key.replace(/\./g, "\\.") + '":');
    const scoped = js.slice(js.indexOf(loc + ": {", js.indexOf("const DICT")));
    check('"' + key + '" in ' + loc, re.test(scoped));
  });
});

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) failed" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);
