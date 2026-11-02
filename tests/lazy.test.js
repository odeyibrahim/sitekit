// Stage 0.3: lazy-load promotion. Unit tests on unlazy() plus the tool end to end.   Usage: node tests/lazy.test.js
const { open } = require('./harness');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['lazy', 'risky'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 40000 });
  console.log('unlazy() on a parsed document');
  const u = await page.evaluate(() => {
    const raw = SiteKit.state.sites.find(s => s.name === 'lazy').html, d = new DOMParser().parseFromString(raw, 'text/html');
    const unresolved = doc => [...doc.querySelectorAll('img')].filter(i => { const s = i.getAttribute('src') || ''; return (!s || /^data:image\/gif/.test(s) || i.hasAttribute('data-src')) && !i.getAttribute('srcset'); }).length;
    const before = unresolved(d), n = unlazy(d), after = unresolved(d);
    return { before, n, after, dsLeft: d.querySelectorAll('[data-src],[data-srcset],[data-bg]').length, bg: d.querySelector('.band').getAttribute('style'), eager: d.querySelectorAll('img[loading=lazy][src]').length, again: unlazy(d) };
  });
  ok(u.n >= 5, 'promotes the lazy images, picture source and background (' + u.n + ' changes)');
  ok(u.after === 1 && u.before > u.after, 'only the image that never had a source stays unresolved (' + u.before + ' → ' + u.after + ')');
  ok(u.dsLeft === 0, 'no data-src / data-srcset / data-bg left behind');
  ok(/background-image:url\("data:image\/png/.test(u.bg), 'data-bg becomes a real background-image');
  ok(u.eager === 0, 'loading="lazy" images that now have a source are set to eager');
  ok(u.again === 0, 'running it twice changes nothing');
  console.log('In the tool (extracted parts)');
  const x = await page.evaluate(() => { const s = SiteKit.state.sites.find(s => s.name === 'lazy'); const html = SiteKit.modsOf(s).map(m => m.x.html).join(''); const d = new DOMParser().parseFromString(html, 'text/html');
    return { withSrc: [...d.querySelectorAll('img')].filter(i => /data:image\/png/.test((i.getAttribute('src') || '') + ' ' + (i.getAttribute('srcset') || ''))).length, left: d.querySelectorAll('[data-src],[data-srcset]').length, risks: SiteKit.modsOf(s).flatMap(m => m.x.risks || []) }; });
  ok(x.withSrc === 5, 'extracted gallery has real pictures (' + x.withSrc + ' of 6, the 6th has no source at all)');
  ok(x.left === 0, 'extracted markup carries no lazy attributes');
  ok(x.risks.some(r => /load later \(1\)/.test(r)), 'the one picture that cannot be resolved is still flagged: ' + x.risks.join(' / '));
  const rk = await page.evaluate(() => { const s = SiteKit.state.sites.find(s => s.name === 'risky'); return SiteKit.modsOf(s).flatMap(m => m.x.risks || []); });
  ok(rk.some(r => /load later \(1\)/.test(r)), 'risky.html: its 3 data-src pictures are promoted, only the one with no source is flagged: ' + rk.join(' / '));
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
