const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');

const oldFn =
`async function sha256Hex(text) {
    if (window.crypto && window.crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let out = "";
    for (let r = 0; r < 4; r++) {
      let h = (0x811c9dc5 ^ Math.imul(r + 1, 0x9e3779b9)) >>> 0;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i) + r;
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      out += h.toString(16).padStart(8, "0");
    }
    return out;
  }`;

const newFn =
`/**
 * Compute a SHA-256 hex digest via Web Crypto when available.
 *
 * IMPORTANT: If Web Crypto is unavailable, this function does NOT return a
 * SHA-256 result. Instead it returns a clearly-marked FNV-1a×4 fallback so
 * the UI never displays an FNV fingerprint as if it were SHA-256.
 *
 * This tool does not hash passwords for storage — passwords are analyzed
 * locally (entropy, rules, estimated crack time) in the Password Analyzer
 * (MODULE 18). No password is ever transmitted or stored by the hash tool.
 */
async function sha256Hex(text) {
  if (window.crypto && window.crypto.subtle && crypto.subtle.digest) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (err) {
      console.warn("[Tools.Hash] Web Crypto SHA-256 failed:", err && err.message);
    }
  }

  // Web Crypto unavailable or failed — do NOT pretend this is SHA-256.
  const fallback = fnv1a32x4(text);
  return "FNV-1a×4-FALLBACK:" + fallback;
}

/**
 * FNV-1a×4 fallback used only when Web Crypto is unavailable.
 * Returns 4 concatenated 32-bit FNV-1a fingerprints as hex.
 * This is NOT a cryptographic hash and is NOT SHA-256.
 * @param {string} text
 * @returns {string} hex fingerprint with FNV prefix
 */
function fnv1a32x4(text) {
  let out = "";
  for (let r = 0; r < 4; r++) {
    let h = (0x811c9dc5 ^ Math.imul(r + 1, 0x9e3779b9)) >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i) + r;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}`;

if (!s.includes(oldFn)) {
  console.error('sha256Hex block not found');
  process.exit(1);
}
s = s.replace(oldFn, newFn);
fs.writeFileSync('script.js', s, 'utf8');
console.log('sha256Hex patched');
