// probe-quiz-loading.js
const fs = require('fs');
const js = fs.readFileSync('script.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const lines = js.split('\n');
function occ(re) {
  const out = []; let m;
  while ((m = re.exec(js)) !== null) {
    const ln = js.slice(0, m.index).split('\n').length;
    out.push('L' + ln + ': ' + lines[ln - 1].trim().slice(0, 190));
  }
  return out.join('\n');
}
console.log('--- QUIZZES ---'); console.log(occ(/\bQUIZZES\b/g));
console.log('--- quizzes.json ---'); console.log(occ(/quizzes\.json/g));
console.log('--- MOCK_QUIZZES ---'); console.log(occ(/\bMOCK_QUIZZES\b/g));
console.log('--- LESSONS usages ---'); console.log(occ(/\bLESSONS\b/g));
const s = js.indexOf('const LESSONS = {'); console.log('LESSONS decl:', js.slice(s, s + 240));
console.log('--- nova-api / nova-ui in index.html? ---');
console.log('nova-api.js:', html.includes('nova-api'), 'nova-ui.css:', html.includes('nova-ui'));
console.log('--- index.html script/style includes ---');
{
  let m; const re = /<(script|link)[^>]*>/g; const hlines = html.split('\n');
  while ((m = re.exec(html)) !== null) {
    if (m[0].includes('src') || m[0].includes('href')) {
      const ln = html.slice(0, m.index).split('\n').length;
      console.log('L' + ln + ': ' + hlines[ln - 1].trim());
    }
  }
}
