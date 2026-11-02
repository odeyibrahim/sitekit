// Part check over a folder of sites. Usage: node eval/partcheck.js <dir> <out.csv> [only-substring]
const fs = require('fs'), path = require('path'), { open } = require('../tests/harness');
const dir = process.argv[2], out = process.argv[3], only = process.argv[4];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).filter(f => !only || f.includes(only)).sort((a, b) => fs.statSync(path.join(dir, a)).size - fs.statSync(path.join(dir, b)).size);
(async () => {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['site', 'bytes', 'status', 'rendered_by_script', 'part', 'kind', 'sure', 'copy', 'why', 'boxes_line_up_%', 'styles_match_%']];
  const summary = [];
  for (const f of files) {
    const t = await open({ tool: 'tool/index.html' }); t.page.setDefaultTimeout(0);
    const html = fs.readFileSync(path.join(dir, f), 'utf8'); const t0 = Date.now();
    let r;
    try {
      r = await t.page.evaluate(async ([n, h]) => {
        const s = await SiteKit.addSite(n, h);
        if (s.status !== 'ready') return { status: s.status + ' ' + (s.error || ''), rows: [] };
        const rows = await SiteKit.checkAll(); return { status: 'ready', rendered: !!s.rendered, xstate: s.xstate, rows: rows.slice(1) };
      }, [f, html]);
    } catch (e) { r = { status: 'crash ' + String(e).slice(0, 100), rows: [] }; }
    await t.close();
    const ex = r.rows.filter(x => x[4] === 'exact').length, ap = r.rows.filter(x => x[4] === 'approximate').length, no = r.rows.filter(x => x[4] === 'no copy').length;
    summary.push({ site: f, status: r.status, parts: r.rows.length, exact: ex, approx: ap, nocopy: no, secs: Math.round((Date.now() - t0) / 1000), scripted: !!r.rendered });
    console.log(JSON.stringify(summary[summary.length - 1]));
    r.rows.forEach(x => rows.push([f, html.length, r.status, !!r.rendered, ...x.slice(1)]));
    fs.writeFileSync(out, rows.map(x => x.map(q).join(',')).join('\n'));
    fs.writeFileSync(out.replace(/\.csv$/, '.summary.json'), JSON.stringify(summary, null, 1));
  }
})();
