// Stage 2 bug found on dallasvc: a wrapper that every part carries (main.page{min-height}) was applied once PER PART instead of once.   Usage: node tests/wrapper.test.js
const { open } = require('./harness'); const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['wrap'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 30000 });
  const r = await page.evaluate(() => { const s = SiteKit.state.sites[0], bl = SiteKit.modsOf(s).filter(m => m.kind === 'module' || m.role === 'nav').map((m, i) => ({ uid: i + 1, site: s, item: m }));
    return { n: bl.length, doc: SiteKit.composePage(bl, { mode: 'document' }), plain: SiteKit.composePage(bl, { mode: 'iframes' }) }; });
  ok(r.n >= 4, 'the sections inside main come out as separate parts (' + r.n + ')');
  const height = async html => { const f = path.join(os.tmpdir(), 'wrap-' + Math.random().toString(36).slice(2) + '.html'); fs.writeFileSync(f, html); const p = await page.context().newPage(); await p.setViewportSize({ width: 1440, height: 900 }); await p.goto('file://' + f); await p.waitForTimeout(400);
    const h = await p.evaluate(() => document.documentElement.scrollHeight); await p.close(); return h; };
  const hp = await height(r.plain), hd = await height(r.doc);
  ok( hp >= 1700, 'the original (plain) page is the sum of its sections (wrapper min-height 70vh counted once) (' + hp + ')');
  ok(hd >= 800 && hd <= hp + 5, 'merged document is not taller than the original: ' + hd + ' vs ' + hp + ' (was ~2700 when the wrapper repeated per part)');
  ok(/data-sk-wrap/.test(r.doc), 'shared wrappers are marked in the merged document');
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
