const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');

// Add English translations for the new password rules after the existing pwVerdict entry.
const oldEntry = `"pwVerdict": "Password strength verdict"`;
const newEntries = `"pwVerdict": "Password strength verdict",
      "pwRule.keyboardPattern": "No keyboard patterns",
      "pwRule.sequentialPattern": "No common sequences",
      "pwRule.repeatedChars": "No repeated characters"`;

if (!s.includes(oldEntry)) {
  console.error('pwVerdict entry not found in English dictionary');
  process.exit(1);
}

s = s.replace(oldEntry, newEntries);
fs.writeFileSync('script.js', s, 'utf8');
console.log('English password rule translations added');
