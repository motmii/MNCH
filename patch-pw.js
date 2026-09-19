const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');

// Add pattern-based strength downgrade before verdict assignment.
const oldBlock = `    var crackLabel = analysis.crackTime || crackTime(Math.pow(2, Math.min(entropy, 128)) / 2 / 10000);
    verdict.textContent = pw
      ? \`\${label} — الإنتروبيا: \${entropy} بت · زمن الكسر التقديري: \${crackLabel}\`
      : label;`;

const newBlock = `    var crackLabel = analysis.crackTime || crackTime(Math.pow(2, Math.min(entropy, 128)) / 2 / 10000);
    // Downgrade strength when predictable patterns exist, even if entropy is high.
    if (pw && (rules.keyboardPattern || rules.sequentialPattern || rules.repeatedChars || !rules.common)) {
      if (cls === "is-strong") { cls = "is-fair"; label = "مقبولة 🟠 (ب 현존 أنماط متوقعة)"; }
      else if (cls === "is-good") { cls = "is-fair"; label = "مقبولة 🟠 (ب 현존 أنماط متوقعة)"; }
    }
    verdict.textContent = pw
      ? \`\${label} — الإنتروبيا: \${entropy} بت · زمن الكسر التقديري: \${crackLabel} (تقديري — يعتمد على قوة الجهاز وهجوم القاموس)\`
      : label;`;

if (!s.includes(oldBlock)) {
  console.error('verdict block not found');
  process.exit(1);
}
s = s.replace(oldBlock, newBlock);
fs.writeFileSync('script.js', s, 'utf8');
console.log('patched verdict');
