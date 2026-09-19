const fs = require('fs');
let s = fs.readFileSync('sw.js', 'utf8');

const expected = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./assistant.js",
  "./current-semester.js",
  "./manifest.json",
  "./data/quizzes.json",
  "./worker.js",
  "./images/icon.svg",
  "./images/icon-maskable.svg",
  "./images/algorithms.svg",
  "./images/os-concepts.svg",
  "./images/policies-ethics.svg",
  "./images/it-components.svg",
  "./images/security-design.svg",
  "./images/backweb.jpg",
  "./images/flashcards/firewall.svg",
  "./images/flashcards/vpn.svg",
  "./images/flashcards/hash.svg",
  "./images/flashcards/phishing.svg",
  "./images/flashcards/two-factor.svg",
  "./images/flashcards/sql-injection.svg",
  "./images/flashcards/confidentiality.svg",
  "./images/flashcards/integrity.svg",
  "./images/flashcards/availability.svg",
  "./images/flashcards/symmetric-encryption.svg",
  "./images/flashcards/asymmetric-encryption.svg",
  "./images/flashcards/ransomware.svg",
  "./images/flashcards/ddos.svg",
  "./images/flashcards/man-in-the-middle.svg",
  "./images/flashcards/social-engineering.svg",
  "./images/flashcards/vulnerability.svg",
  "./images/flashcards/reconnaissance.svg",
  "./images/flashcards/malware.svg"
];

const block =
  "const PRECACHE_ASSETS = [\n" +
  expected.map((v, i) => `  "${v}"${i < expected.length - 1 ? "," : ""}`).join("\n") +
  "];\n";

s = s.replace(/const PRECACHE_ASSETS = \[[\s\S]*?\];/m, block);

// Disable backend-only sync API constant
s = s.replace(
  'const SYNC_API_URL = "/api/v1/sync/progress";',
  '// disabled on GitHub Pages: const SYNC_API_URL = "/api/v1/sync/progress";'
);

// Neutralize backend-only SW functions safely
s = s.replace(
  'async function readAuthTokens() {',
  '// disabled on GitHub Pages: async function readAuthTokens() {'
);
s = s.replace(
  'async function refreshAccessToken(refreshToken) {',
  '// disabled on GitHub Pages: async function refreshAccessToken(refreshToken) {'
);
s = s.replace(
  'async function replayOutbox() {',
  '// disabled on GitHub Pages: async function replayOutbox() {'
);

// Update PRECACHE comment to mention disabled backend parts
s = s.replace(
  'Static app-shell assets precached at install time. @type {string[]} */',
  'Static app-shell assets precached at install time. Backend-only files (nova-api.js, nova-ui.css) are intentionally NOT precached because they are not loaded by the static site. @type {string[]} */'
);

fs.writeFileSync('sw.js', s, 'utf8');
console.log('sw.js patched OK');
