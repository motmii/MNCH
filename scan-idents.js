// scan-idents.js — precise old-subject identifier finder
const fs = require('fs'), path = require('path');
const targets = ['networks', 'secureCode', 'ethical', 'os', 'db', 'crypto'];
const arabicNames = ['الشبكات وأمنها', 'أمن أنظمة التشغيل', 'التشفير وتطبيقاته', 'قواعد البيانات وأمنها', 'البرمجة الآمنة', 'الاختراق الأخلاقي والفحص'];
const skipDirs = ['.git', '.agents', '.kerno', 'node_modules', 'images', 'data'];
const keepFiles = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!skipDirs.includes(e.name) && !e.name.startsWith('.')) walk(full);
    } else if (e.name.endsWith('.js') || e.name.endsWith('.json') || e.name.endsWith('.html') || e.name.endsWith('.css') || e.name.endsWith('.md') || e.name.endsWith('.webmanifest') || e.name.endsWith('.xml') || e.name.endsWith('.txt')) {
      keepFiles.push(full);
    }
  }
}
walk('.');
const results = [];
for (const f of keepFiles) {
  let t;
  try { t = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const lines = t.split('\n');
  for (const id of targets) {
    // Match as a JS identifier token: quoted, object key, bracket, #path/, or word boundary not part of a longer word
    const re = new RegExp('(?:["\']?' + id + '["\']?\\s*[:#]|["\'][\\s,]*' + id + '["\']|\\[\\s*["\']?' + id + '["\']?\\s*\\]|#path/' + id + '|\\b' + id + '\\b)', 'gi');
    let m;
    while ((m = re.exec(t)) !== null) {
      const lineNo = t.slice(0, m.index).split('\n').length;
      results.push({ file: f, id, line: lineNo, text: lines[lineNo - 1] ? lines[lineNo - 1].trim().slice(0, 220) : '' });
    }
  }
  // Arabic names
  for (const name of arabicNames) {
    let idx = 0;
    while ((idx = t.indexOf(name, idx)) !== -1) {
      const lineNo = t.slice(0, idx).split('\n').length;
      results.push({ file: f, id: name, line: lineNo, text: (lines[lineNo - 1] || '').trim().slice(0, 220) });
      idx += name.length;
    }
  }
}
// Dedupe
const seen = new Set();
const uniq = [];
for (const r of results) {
  const key = r.file + '|' + r.id + '|' + r.line;
  if (seen.has(key)) continue;
  seen.add(key);
  uniq.push(r);
}
for (const r of uniq) {
  console.log(r.file + '  L' + r.line + '  [' + r.id + ']');
  console.log('     ' + r.text);
}
console.log('\nTotal hits: ' + uniq.length);
