"use strict";
/**
 * PWA + social-preview hardening for release v3.1.1.
 *
 * Guards the release wiring that is easy to break silently:
 *   - package version ↔ style.css?v= ↔ sw.js CACHE_VERSION
 *   - fresh precache reads (no stale HTTP cache during SW install)
 *   - query-string-safe cache matching for versioned styles/scripts
 *   - the page-loaded ui-overhaul layer is actually precached
 *   - manifest icons/screenshots exist and match their declared dimensions
 *   - the 1200x630 social card and its OG/Twitter metadata stay in sync
 *
 * Run: node tests/pwa-hardening.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}
function pngSize(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
function sameSize(rel, width, height) {
  const s = pngSize(rel);
  return !!s && s.width === width && s.height === height;
}

console.log("— release wiring —");
check("package release is 3.1.1", pkg.version === "3.1.1");
check("index.html style.css?v matches the release", html.includes("style.css?v=" + pkg.version));
check("sw.js CACHE_VERSION matches the release", sw.includes('CACHE_VERSION = "v' + pkg.version + '"'));

console.log("— service worker cache correctness —");
check("ui-overhaul.css is precached", sw.includes('"./ui-overhaul.css"'));
check("ui-overhaul.js is precached", sw.includes('"./ui-overhaul.js"'));
check("precache bypasses the HTTP cache on install", /cache:\s*"reload"/.test(sw) && /addAll\(PRECACHE_REQUESTS\)/.test(sw));
check("stale-while-revalidate ignores asset query strings",
  /cache\.match\(request,\s*\{\s*ignoreSearch:\s*true\s*\}\)/.test(sw));
check("offline fallback ignores asset query strings",
  /cache\.match\(fallbackUrl,\s*\{\s*ignoreSearch:\s*true\s*\}\)/.test(sw));

const assetsBlock = (sw.match(/PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/) || [])[1];
const assets = assetsBlock
  ? [...assetsBlock.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean)
  : [];
const missingAssets = assets.filter((a) => !fs.existsSync(path.join(root, a)));
check("PRECACHE_ASSETS parsed", assets.length > 50);
check("every precached asset exists on disk" + (missingAssets.length ? " (missing: " + missingAssets.join(", ") + ")" : ""),
  assets.length > 0 && missingAssets.length === 0);

console.log("— manifest icons + screenshots —");
const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
const icon192 = icons.find((i) => i.sizes === "192x192" && i.type === "image/png");
const icon512 = icons.find((i) => i.sizes === "512x512" && i.type === "image/png" && i.purpose === "any");
const maskable = icons.find((i) => i.sizes === "512x512" && i.type === "image/png" && i.purpose === "maskable");
check("manifest declares a 192x192 PNG icon", !!icon192);
check("manifest declares a 512x512 PNG icon", !!icon512);
check("manifest declares a 512x512 maskable PNG icon", !!maskable);
check("192 icon file is exactly 192x192", icon192 && sameSize(icon192.src, 192, 192));
check("512 icon file is exactly 512x512", icon512 && sameSize(icon512.src, 512, 512));
check("maskable icon file is exactly 512x512", maskable && sameSize(maskable.src, 512, 512));
check("all manifest icon files exist", icons.every((i) => fs.existsSync(path.join(root, i.src))));
check("shortcut icons resolve", (manifest.shortcuts || []).every((s) => (s.icons || []).every((i) => fs.existsSync(path.join(root, i.src)))));
check("wide screenshot exists at 1280x720",
  sameSize("images/screenshots/home-wide.png", 1280, 720));
check("narrow screenshot exists at 720x1280",
  sameSize("images/screenshots/home-narrow.png", 720, 1280));
check("apple touch icon is 180x180", sameSize("images/apple-touch-icon.png", 180, 180));
check("favicon is a 32x32 PNG wired from index.html",
  html.includes('href="images/icon-32.png" sizes="32x32" type="image/png"') &&
  sameSize("images/icon-32.png", 32, 32));

console.log("— social preview —");
check("OG image points at the social card", html.includes('property="og:image" content="https://motmii.github.io/MNCH/images/og-cover.png"'));
check("OG image declares 1200x630 PNG",
  html.includes('property="og:image:type" content="image/png"') &&
  html.includes('property="og:image:width" content="1200"') &&
  html.includes('property="og:image:height" content="630"'));
check("OG image file is exactly 1200x630", sameSize("images/og-cover.png", 1200, 630));
check("Twitter uses the large-image card", html.includes('name="twitter:card" content="summary_large_image"'));
check("Twitter image matches the OG card", html.includes('name="twitter:image" content="https://motmii.github.io/MNCH/images/og-cover.png"'));
check("both social images carry Arabic alt text",
  html.includes('property="og:image:alt"') && html.includes('name="twitter:image:alt"'));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
