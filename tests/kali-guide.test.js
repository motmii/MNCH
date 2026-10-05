"use strict";
/**
 * KaliGuide — the #kali install-guide view (MODULE 72).
 *
 * Static copy only (no JS behaviour to boot): this suite reads the
 * shipped files and proves the things that actually break a new view.
 *   1. markup — the #kali section exists with figures + honest captions,
 *      and is linked from desktop nav, mobile menu AND footer.
 *   2. wiring — the view is registered in the ViewSwitcher VIEWS list.
 *   3. honesty — every kali.* key exists in BOTH dictionaries; every
 *      external link carries rel="noopener noreferrer"; every figure
 *      is labelled as an illustration, not a real screenshot.
 *   4. release — the 6 SVG figures exist, are precached in sw.js, and
 *      the version triple (package/sw/css?v) agrees on v1.25.0.
 * Run: node tests/kali-guide.test.js
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
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

function sliceObject(src, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}
const dictStart = js.indexOf("const DICT = {");
const dictSrc = dictStart < 0 ? "" : js.slice(dictStart, sliceObject(js, js.indexOf("{", dictStart)));
const arStart = dictSrc.indexOf("ar: {");
const arSrc = arStart < 0 ? "" : dictSrc.slice(arStart, sliceObject(dictSrc, dictSrc.indexOf("{", arStart)));
const enStart = dictSrc.indexOf("en: {");
const enSrc = enStart < 0 ? "" : dictSrc.slice(enStart, sliceObject(dictSrc, dictSrc.indexOf("{", enStart)));

const KALI_KEYS = [
  "nav.kali", "kali.eyebrow", "kali.title", "kali.sub",
  "kali.reqCpu", "kali.reqCpuD", "kali.reqRam", "kali.reqRamD",
  "kali.reqDisk", "kali.reqDiskD", "kali.reqNet", "kali.reqNetD",
  "kali.dlVbox", "kali.dlVboxD", "kali.dlKali", "kali.dlKaliD",
  "kali.dlVm", "kali.dlVmD", "kali.dlHash", "kali.dlHashD",
  "kali.figCap",
  "kali.s1t", "kali.s1d", "kali.s2t", "kali.s2d",
  "kali.s3t", "kali.s3d", "kali.s4t", "kali.s4d",
  "kali.s5t", "kali.s5d", "kali.s6t", "kali.s6d",
  "kali.s7t", "kali.s7d", "kali.s8t", "kali.s8d",
  "kali.errT", "kali.e1t", "kali.e1d", "kali.e2t", "kali.e2d",
  "kali.e3t", "kali.e3d", "kali.e4t", "kali.e4d",
  "kali.e5t", "kali.e5d", "kali.ethT", "kali.ethD",
];
const FIGS = [
  "images/kali/vbox-download.svg", "images/kali/kali-download.svg",
  "images/kali/vbox-newvm.svg", "images/kali/vbox-storage-iso.svg",
  "images/kali/kali-installer.svg", "images/kali/kali-firstboot.svg",
];

console.log("— markup —");
check("the #kali section exists", html.includes('id="kali"'));
check("linked right after #quiz in desktop nav",
  /href="#quiz"[\s\S]*?href="#kali"/.test(html));
check("linked in the mobile menu", (html.match(/href="#kali"/g) || []).length >= 3);
check("8 numbered steps present", (html.match(/class="kali-step[ "]|class="kali-step reveal"/g) || []).length === 8);
check("every step has a figure + honest caption",
  (html.match(/<figure class="kali-fig">/g) || []).length === 8 &&
  html.includes("ليست لقطات حقيقية"));
check("codes are LTR", (html.match(/<code class="kali-code" dir="ltr">/g) || []).length >= 3);
check("official download links present",
  html.includes("https://www.virtualbox.org/wiki/Downloads") &&
  html.includes("https://www.kali.org/get-kali/") &&
  html.includes("verify-kali-linux-checksums"));

console.log("— wiring —");
check("VIEWS registers #kali", js.includes('$id("kali")'));
check("WhatsNew entry dated 2026-10-04", js.includes('date: "2026-10-04"'));

console.log("— honesty —");
const missingAr = KALI_KEYS.filter((k) => !arSrc.includes('"' + k + '"'));
const missingEn = KALI_KEYS.filter((k) => !enSrc.includes('"' + k + '"'));
check("all " + KALI_KEYS.length + " kali keys in ar dict" + (missingAr.length ? " — missing: " + missingAr.join(", ") : ""), missingAr.length === 0);
check("all kali keys in en dict" + (missingEn.length ? " — missing: " + missingEn.join(", ") : ""), missingEn.length === 0);
check("external links hardened", (function () {
  const secs = html.split('id="kali"')[1] || "";
  const ext = secs.match(/<a[^>]*href="https?:\/\/[^"]*"[^>]*>/g) || [];
  return ext.length >= 4 && ext.every((a) => /rel="noopener noreferrer"/.test(a) && /target="_blank"/.test(a));
})());

console.log("— release —");
check("all 6 figures exist on disk", FIGS.every((f) => fs.existsSync(path.join(root, f))));
check("all 6 figures precached in sw.js", FIGS.every((f) => sw.includes("./" + f)));
/* Release consistency: derive the expected version from package.json rather
   than pinning a literal, so bumping the release never has to edit this file
   (every other suite in tests/ uses the same version-agnostic pattern). */
const REL = pkg.version;
check("cache version matches the release", sw.includes('CACHE_VERSION = "v' + REL + '"'));
check("package version is a sane semver", /^\d+\.\d+\.\d+$/.test(REL));
check("index.html css?v matches", html.includes("style.css?v=" + REL));
check("MODULE 72 layer closed", css.includes("END MODULE 72"));
check("phone rule stacks steps", /@media \(max-width: 900px\)[\s\S]*\.kali-step \{ grid-template-columns: 1fr/.test(css));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
