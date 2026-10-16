"use strict";
/* v2.0.0 — ONE identity. The theme switch (MODULE 36) and the second
   palette (MODULE 36b) were removed in the V0 OBSIDIAN overhaul: the
   platform now always renders the obsidian dark identity, so this suite
   guards that the switchers are gone AND that the replacement identity
   layer (ambient CyberField canvas + GitHub CTA + frosted chrome) is
   actually wired up. */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
let failures = 0;
function check(name, cond) {
  if (cond) console.log("  PASS " + name);
  else { failures++; console.error("  FAIL: " + name); }
}

console.log("— switchers fully removed —");
check("no #themeToggle mount", !html.includes('id="themeToggle"'));
check("no #paletteToggle mount", !html.includes('id="paletteToggle"'));
check("no pre-paint theme restore", !html.includes("motmi-portal:theme"));
check("no pre-paint palette restore", !html.includes("motmi-portal:palette"));
check("no theme CSS anywhere", !css.includes("data-theme"));
check("no palette CSS anywhere", !css.includes("data-palette"));
check("toggle chrome CSS removed", !css.includes(".theme-toggle") && !css.includes(".palette-toggle"));
check("theme module gone from script.js", !js.includes("ThemeSwitch") && !js.includes("36b"));
check("no runtime toggle lookups", !js.includes("themeToggle") && !js.includes("paletteToggle"));

console.log("— single identity is pinned —");
check("html ships data-theme=\"dark\"", /<html[^>]*data-theme="dark"/.test(html));
check("obsidian base token declared", css.includes("--bg: #09090B;"));
check("neon accent family declared", css.includes("--accent: #3DF5A5;") && css.includes("--accent-2: #6EE7FF;"));
check("glass tokens declared", css.includes("--glass: rgba(255, 255, 255, 0.03);") && css.includes("--glass-blur:"));
check("Inter + JetBrains Mono self-hosted", css.includes('font-family: "Inter";') && css.includes('font-family: "JetBrains Mono";'));

console.log("— CyberField canvas layer —");
check("canvas mounted above the fold (first body element)", /<body[^>]*>[\s\S]{0,240}?<canvas id="cyberCanvas"/.test(html));
check("canvas is aria-hidden and inert", /id="cyberCanvas"[^>]*aria-hidden="true"/.test(html));
check("canvas CSS plane declared", css.includes(".cyber-canvas {") && /\.cyber-canvas\s*\{[\s\S]{0,200}z-index: -1;/.test(css));
check("body is transparent so the canvas reads through", /body \{\s*background-color: transparent;\s*background-image: none;\s*\}/.test(css));
check("CyberField module shipped", js.includes("MODULE 80 · CyberField") && js.includes("window.PlatformCyberField"));
check("canvas module guards for reduced motion", /prefers-reduced-motion/.test(js.slice(js.indexOf("MODULE 80 · CyberField"))));
check("canvas module pauses when hidden", /visibilitychange/.test(js.slice(js.indexOf("MODULE 80 · CyberField"))));
check("canvas module caps DPR (perf guard)", /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/.test(js));
check("accent colours read from the live tokens", /--accent-rgb/.test(js.slice(js.indexOf("MODULE 80 · CyberField"))));

console.log("— View on GitHub CTA —");
check("GitHub CTA mounted in the navbar", html.includes('class="btn btn-ghost btn-sm nav-gh"'));
check("CTA targets the repository", html.includes('href="https://github.com/motmii/MNCH"'));
check("external link is safely attributed", html.includes('rel="noopener noreferrer"'));
check("CTA styled per chrome state", css.includes(".nav:not(.is-scrolled) .nav-gh") && css.includes(".nav.is-scrolled .nav-gh"));

const m = /CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/.exec(sw);
check("cache bumped to >= v2.0.0", !!m && +m[1] >= 2);
check("new typefaces precached",
  sw.includes('"./fonts/inter-latin.woff2"') && sw.includes('"./fonts/jetbrains-mono-latin.woff2"'));
console.log(failures ? "FAIL " + failures : "ALL PASS");
process.exit(failures ? 1 : 0);
