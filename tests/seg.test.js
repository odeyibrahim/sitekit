// Segmentation coverage: pages whose content only exists after a script runs (client-side routes) must not collapse to their header.   Usage: node tests/seg.test.js
const { open } = require('./harness');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['spa', 'alpha'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.status === 'ready' && s.xstate), null, { timeout: 60000 });
  const r = await page.evaluate(() => SiteKit.state.sites.map(s => ({ n: s.name, rendered: !!s.rendered, mods: SiteKit.modsOf(s).length, pageH: s.pageH, words: SiteKit.modsOf(s).reduce((a, m) => a + ((m.features && m.features.words) || 0), 0), text: SiteKit.modsOf(s).map(m => (m.x && m.x.html || '').replace(/<[^>]+>/g, ' ')).join(' '), why: s.coverage || null })));
  const spa = r.find(x => x.n === 'spa'), alpha = r.find(x => x.n === 'alpha');
  console.log('Script-routed page');
  ok(spa.rendered, 'noticed that most of the page is hidden until a script runs, and read the finished page instead');
  ok(spa.mods >= 4, 'the routed content comes out as parts (' + spa.mods + ')');
  ok(/Route headline that only a script reveals/.test(spa.text) && /Ready to talk/.test(spa.text), 'hero and call-to-action text are in the parts');
  ok(!/Another route that stays hidden/.test(spa.text), 'the route that was NOT active stays out');
  ok(spa.why && /hidden/.test(spa.why), 'the reason is recorded: ' + spa.why);
  console.log('Ordinary page is left alone');
  ok(!alpha.rendered && alpha.mods >= 4 && !alpha.why, 'alpha.html is still read the normal way (' + alpha.mods + ' parts)');
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
