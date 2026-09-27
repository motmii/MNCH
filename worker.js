/* ============================================================
   Cyber Tools Worker — offloads CPU-intensive security
   computations from the main thread to prevent UI jank.
   ============================================================ */
"use strict";

/**
 * Compute SHA-256 hex digest using crypto.subtle.
 * @param {string} text Input text.
 * @returns {Promise<string>} Hex digest.
 */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute FNV-1a based fallback hash when crypto.subtle is unavailable.
 * @param {string} text Input text.
 * @returns {string} 64-char hex string (4 × 16 hex chars).
 */
function fnvFallback(text) {
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
}

/**
 * Analyse password strength: rules, entropy bits, crack-time estimate.
 * @param {string} pw Candidate password.
 * @returns {{rules:Object<string,boolean>,entropy:number,crackTime:string}}
 */
function analyzePassword(pw) {
  const COMMON = ["123456","password","qwerty","111111","abc123",
    "admin","letmein","iloveyou","000000","password1"];
  const rules = {
    len12: pw.length >= 12,
    case: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^A-Za-z0-9\s]/.test(pw),
    common: pw.length > 0 && !COMMON.some((c) => pw.toLowerCase().includes(c))
  };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9\s]/.test(pw)) pool += 33;
  if (/[\u0600-\u06FF]/.test(pw)) pool += 36;

  const bits = pool > 0 ? Math.log2(pool) : 0; // guard: zero-pool input
  const entropy = pw.length ? +(pw.length * bits).toFixed(1) : 0;
  const guesses = Math.pow(2, Math.min(entropy, 128));
  const seconds = guesses / 2 / 10000; // ~10k guesses/s offline attack

  /** Humanise seconds into Arabic duration. @param {number} s Seconds. @returns {string} */
  function human(s) {
    if (s < 1) return "أقل من ثانية";
    const u = [[31104000,"عام","أعوام"],[2592000,"شهر","أشهر"],[86400,"يوم","أيام"],
               [3600,"ساعة","ساعات"],[60,"دقيقة","دقائق"]];
    for (const [sec, one, many] of u) {
      if (s >= sec) { const v = Math.floor(s / sec); return v + " " + (v === 1 ? one : many); }
    }
    return Math.floor(s) + " ثانية";
  }
  return { rules, entropy, crackTime: human(seconds) };
}

/**
 * Calculate IPv4 subnet details from an IP and prefix length.
 * @param {string} ip Dotted IPv4 address.
 * @param {number} prefix CIDR prefix (0–32).
 * @returns {Object|null} Subnet breakdown or null on invalid input.
 */
function calcSubnet(ip, prefix) {
  const octets = ip.split(".");
  if (octets.length !== 4) return null;
  let n = 0;
  for (const o of octets) {
    if (!/^\d{1,3}$/.test(o)) return null;
    const v = Number(o);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  n >>>= 0;
  prefix = Math.min(32, Math.max(0, prefix | 0));

  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  const network = (n & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = Math.pow(2, 32 - prefix);

  /**
   * Convert integer back to dotted notation.
   * @param {number} x Integer address.
   * @returns {string} Dotted address.
   */
  function toIp(x) { return [(x>>>24),(x>>>16)&255,(x>>>8)&255,x&255].join("."); }

  return {
    network: toIp(network),
    mask: toIp(mask),
    wildcard: toIp(~mask >>> 0),
    broadcast: toIp(broadcast),
    firstHost: toIp(prefix >= 31 ? network : network + 1),
    lastHost: toIp(prefix >= 31 ? broadcast : broadcast - 1),
    totalHosts: total,
    usableHosts: prefix >= 31 ? total : total - 2
  };
}

/* ---------- Message router ---------- */
self.onmessage = async function (e) {
  const { id, type, payload } = e.data;
  let result = null;
  let error = null;

  try {
    switch (type) {
      case "hash":
        result = self.crypto && self.crypto.subtle
          ? await sha256Hex(payload.text)
          : fnvFallback(payload.text);
        break;
      case "password":
        result = analyzePassword(payload.password);
        break;
      case "cidr":
        result = calcSubnet(payload.ip, payload.prefix);
        if (!result) throw new Error("Invalid IP or prefix");
        break;
      default:
        throw new Error("Unknown task type: " + type);
    }
  } catch (err) {
    error = err.message;
  }

  self.postMessage({ id, type, result, error });
};