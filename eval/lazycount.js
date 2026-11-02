// Stage 0.3 measurement: how many lazy, unresolved <img> each real site has before and after unlazy(). Usage: node eval/lazycount.js <dir>
const fs = require('fs'), path = require('path'), { open } = require('../tests/harness');
(async () => {
  const dir = process.argv[2], t = await open({ tool: 'tool/index.html' }), rows = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort()) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const r = await t.page.evaluate(h => { const d = new DOMParser().parseFromString(h, 'text/html');
      const un = doc => [...doc.querySelectorAll('img')].filter(i => { const s = i.getAttribute('src') || ''; return (!s || /^data:image\/(gif|svg\+xml)/.test(s) && s.length < 400 || i.hasAttribute('data-src') || i.hasAttribute('data-lazy-src')) && !i.getAttribute('srcset'); }).length;
      const total = d.querySelectorAll('img').length, before = un(d), bgBefore = d.querySelectorAll('[data-bg],[data-background],[data-background-image]').length, n = unlazy(d), after = un(d);
      return { total, before, after, promoted: n, bgPromoted: bgBefore }; }, html);
    rows.push({ site: f, ...r }); console.log(JSON.stringify(rows[rows.length - 1]));
  }
  fs.writeFileSync(path.join(__dirname, 'lazycount.json'), JSON.stringify(rows, null, 1)); await t.close();
})();
