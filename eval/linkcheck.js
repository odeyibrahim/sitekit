// Stage 1.3 acceptance: run the link report over each real site (one page = the whole site). Usage: node eval/linkcheck.js <dir> <out.csv>
const fs = require('fs'), path = require('path'), { open } = require('../tests/harness');
(async () => {
  const dir = process.argv[2], out = process.argv[3], rows = [['site', 'origin', 'origin_sure', 'links', 'to_pages', 'anchor_ok', 'anchor_missing', 'original', 'original_distinct', 'external', 'contact', 'dead']];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort()) {
    const t = await open({ tool: 'tool/index.html' }); t.page.setDefaultTimeout(0); const html = fs.readFileSync(path.join(dir, f), 'utf8');
    try { const r = await t.page.evaluate(async ([n, h]) => { const s = await SiteKit.addSite(n, h); if (s.status !== 'ready') return null; SiteKit.state.blocks = SiteKit.modsOf(s).map((m, i) => ({ uid: i + 1, site: s, item: m }));
      const rep = SiteKit.linkReport(), S = SiteKit.summarizeLinks(rep); return { o: SiteKit.project.origin, sure: SiteKit.project.originSure, S, dist: new Set(rep.filter(x => x.status === 'original').map(x => x.href)).size }; }, [f, html]);
      if (r) rows.push([f, r.o, r.sure, r.S.total, r.S.page, r.S.anchor, r.S['anchor-missing'], r.S.original, r.dist, r.S.external, r.S.contact, r.S.dead]); else rows.push([f, 'unreadable']);
    } catch (e) { rows.push([f, 'crash ' + String(e).slice(0, 60)]); }
    console.log(rows[rows.length - 1].join(' | ')); await t.close();
    fs.writeFileSync(out, rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n'));
  }
})();
