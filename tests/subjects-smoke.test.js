"use strict";
/**
 * Migration test — official current-semester study plan (MODULE 00b).
 * Validates the real assets:
 *   - SUBJECTS registry in script.js contains EXACTLY the 5 official
 *     current-semester subjects (course-code identified) and NOTHING else
 *     (migration 2 removed the previous-semester archive entirely)
 *   - current subjects carry official codes / credit hours / day / times
 *   - every current subject has an authored content status and a quizKey
 *     that RESOLVES to a real bank in data/quizzes.json
 *   - the rendered cards link to those banks (no dead "coming soon" links)
 *   - index.html mounts #subjectsGrid and no longer hard-codes cards
 *   - assistant.js reads window.PLATFORM_SUBJECTS (single source)
 *   - service worker precaches the 5 current subject SVGs, no longer
 *     precaches the 6 deleted legacy SVGs, and pins CACHE_VERSION v1.21.0
 * Run: node tests/subjects-smoke.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const assistant = fs.readFileSync(path.join(root, "assistant.js"), "utf8");
const quizzes = JSON.parse(fs.readFileSync(path.join(root, "data", "quizzes.json"), "utf8"));

let failures = 0;
const check = (name, cond) => {
  if (cond) { console.log("  \u2713 " + name); }
  else { failures++; console.error("  \u2717 FAIL: " + name); }
};

/* ---------- extract the real SUBJECTS registry ---------- */
const srcStart = js.indexOf("const SUBJECTS = [");
check("SUBJECTS registry found in script.js", srcStart >= 0);
let depth = 0, srcEnd = -1;
for (let i = js.indexOf("[", srcStart); i < js.length; i++) {
  if (js[i] === "[") depth++;
  else if (js[i] === "]" && --depth === 0) { srcEnd = i + 1; break; }
}
const src = js.slice(srcStart, srcEnd);
const SUBJECTS = new Function(src + "\nreturn SUBJECTS;")();
check("SUBJECTS parses to an array", Array.isArray(SUBJECTS));

/* ---------- official current-semester plan (5 subjects) ---------- */
const EXPECTED_CURRENT = [
  { code: "260210030702", name: "الخوارزميات", day: "الأحد", startTime: "09:00 AM", endTime: "12:00 PM" },
  { code: "260210030802", name: "مفاهيم نظم التشغيل", day: "الأحد", startTime: "12:00 PM", endTime: "03:00 PM" },
  { code: "260210030902", name: "السياسات والتشريعات والأخلاقيات والالتزام بها", day: "الاثنين", startTime: "09:00 AM", endTime: "12:00 PM" },
  { code: "260210031002", name: "مكونات أنظمة تقنية المعلومات", day: "الاثنين", startTime: "12:00 PM", endTime: "03:00 PM" },
  { code: "260210031102", name: "مبادئ التصميم في الأمن السيبراني", day: "الثلاثاء", startTime: "09:00 AM", endTime: "12:00 PM" }
];

if (Array.isArray(SUBJECTS)) {
  const current = SUBJECTS.filter((s) => s.semester === "current");
  const legacy = SUBJECTS.filter((s) => s.semester !== "current");

  check("current semester has exactly 5 subjects", current.length === 5);
  check("registry holds ONLY current-semester subjects (archive removed)", legacy.length === 0);
  check("registry size equals the current-semester count", SUBJECTS.length === 5);

  const codes = current.map((s) => s.code);
  check("current course codes are unique", new Set(codes).size === codes.length);

  for (const exp of EXPECTED_CURRENT) {
    const match = current.find((s) => s.code === exp.code);
    check(
      "code " + exp.code + " → «" + exp.name + "»" +
      (match && match.nameAr === exp.name ? "" : " (actual: " + (match ? match.nameAr : "MISSING") + ")"),
      !!match && match.nameAr === exp.name
    );
    check("code " + exp.code + " has 3 credit hours", !!match && match.creditHours === 3);
    check("code " + exp.code + " has day/time", !!match && match.day === exp.day && match.startTime === exp.startTime && match.endTime === exp.endTime);
    /* Content migration 2: current subjects ARE authored → quiz link must
       resolve to a real bank (no fake/empty content state). */
    check("code " + exp.code + " is available (authored content)", !!match && match.contentStatus === "available");
    check(
      "code " + exp.code + " quizKey resolves to a real bank",
      !!match && !!match.quizKey && match.quizKey === exp.code &&
      !!quizzes[match.quizKey] && quizzes[match.quizKey].questions.length > 0
    );
  }

  /* No legacy subject key may survive anywhere in the registry. */
  const LEGACY = ["networks", "os", "crypto", "db", "secureCode", "ethical"];
  check(
    "no legacy subject keys/codes remain in the registry",
    !current.some((s) => LEGACY.indexOf(s.code) >= 0 || LEGACY.indexOf(s.id) >= 0)
  );
}

/* ---------- renderer output validation (MODULE 00b) ---------- */
/* Simulate the grid render with a stubbed document to prove the cards
   that users actually see are correct: 5 current cards, each carrying its
   official course code and a REAL "بنك الأسئلة" jump link, no "undefined". */
const renderSrc = js.slice(
  js.indexOf("(function renderSubjectsGrid() {"),
  js.indexOf("/* ---------- 02a · IdbStore") 
);
check("renderer source extracted", renderSrc.indexOf("renderSubjectsGrid") >= 0);
if (renderSrc.indexOf("renderSubjectsGrid") >= 0) {
  let renderedHtml = "";
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  /* Capture innerHTML via a stub so the real module builds real card HTML. */
  const stub = { get innerHTML() { return renderedHtml; }, set innerHTML(v) { renderedHtml = v; } };
  const docStub = { getElementById: function (id) { return id === "subjectsGrid" ? stub : null; } };
  try {
    new Function("document", "escHtml", "SUBJECTS", renderSrc)(docStub, esc, SUBJECTS);
  } catch (e) {
    check("renderer executes without throwing" + (e && e.message ? " — " + e.message : ""), false);
  }
  check("renderer produced 5 cards", (renderedHtml.match(/class="work-card reveal tilt"/g) || []).length === 5);
  check("renderer produced 5 current cards", (renderedHtml.match(/data-tags="current /g) || []).length === 5);
  check("renderer produced no archive cards", !/data-tags="previous /.test(renderedHtml));
  check("current cards carry official course codes", EXPECTED_CURRENT.every((e) => renderedHtml.includes('data-subj-code="' + e.code + '"')));
  check(
    "every card has a real quiz jump link",
    EXPECTED_CURRENT.every((e) => renderedHtml.includes('data-quiz-jump="' + e.code + '"'))
  );
  check("no 'coming soon' quiz placeholder on any card", (renderedHtml.match(/بنك الأسئلة/g) || []).length === 5 && !/data-quiz-jump="(networks|os|crypto|db|secureCode|ethical)"/.test(renderedHtml));
  check("no undefined in rendered cards", !renderedHtml.includes("undefined") && !renderedHtml.includes("NaN"));
  check("cards show the official course code meta", EXPECTED_CURRENT.every((e) => renderedHtml.includes("رمز المقرر " + e.code)));
}

/* ---------- index.html mounts the JS grid (no hard-coded cards) ---------- */
check("index.html mounts #subjectsGrid", html.includes('class="work-grid" id="subjectsGrid"'));
check("index.html no longer hard-codes old cards", !html.includes('data-quiz="networks"') && !html.includes("3</span></a><span class=\"card-link is-soon\""));
check("empty state preserved for Subjects", html.includes('id="emptyState"'));
check("tag chips match the registry tags", html.includes('data-tag="osconcepts"') && !/data-tag="os"[ >]/.test(html));
check("no previous-semester archive chip or copy", !html.includes('data-tag="previous"') && !html.includes("الترم السابق"));
check("onboarding step 2 offers the 5 course codes", EXPECTED_CURRENT.every((e) => html.includes('data-os-subj="' + e.code + '"')));
check("no legacy onboarding subject keys", !/data-os-subj="(networks|crypto|secureCode|ethical)"/.test(html));
check("stale archive wording gone from the dictionaries", !js.includes("ومواد الفصل السابق") && !js.includes("archived at the end of the list"));

/* ---------- assistant reads the registry ---------- */
check("assistant.js prefers window.PLATFORM_SUBJECTS", assistant.includes("window.PLATFORM_SUBJECTS"));
check("assistant.js no longer claims six subject cards of the term", !assistant.includes("المواد الست للترم"));

/* ---------- service worker ---------- */
const NEW_SVGS = ["algorithms", "os-concepts", "policies-ethics", "it-components", "security-design"];
for (const n of NEW_SVGS) {
  check("sw.js precaches images/" + n + ".svg", sw.includes('"./images/' + n + '.svg"'));
}
const verMatch = sw.match(/CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/);
check("cache version is exactly v1.21.0 (current revision)", !!verMatch && verMatch[0] === 'CACHE_VERSION = "v1.21.0"');
const DELETED_SVGS = ["network-sec", "os-sec", "crypto-viz", "db-sec", "secure-code", "hack-viz"];
for (const n of DELETED_SVGS) {
  check("sw.js no longer precaches the deleted images/" + n + ".svg", sw.indexOf("./images/" + n + ".svg") < 0);
}

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);