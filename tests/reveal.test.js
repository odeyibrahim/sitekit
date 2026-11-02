// Stage 2: text hidden only because a script has not faded it in (nova-dental). Revealed in the copy; things hidden ON PURPOSE stay hidden.   Usage: node tests/reveal.test.js
const { open } = require('./harness'); const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['reveal', 'alpha'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 40000 });
  const r = await page.evaluate(() => { const s = SiteKit.state.sites.find(x => x.name === 'reveal'), bl = SiteKit.modsOf(s).filter(m => m.kind === 'module' || m.role === 'nav').map((m, i) => ({ uid: i + 1, site: s, item: m }));
    const a = SiteKit.state.sites.find(x => x.name === 'alpha'), ab = SiteKit.modsOf(a).filter(m => m.kind === 'module' || m.role === 'nav').map((m, i) => ({ uid: i + 1, site: a, item: m }));
    return { n: bl.length, doc: SiteKit.composePage(bl, { mode: 'document' }), plain: SiteKit.composePage(bl, { mode: 'iframes' }), marked: s.revealed || 0, alphaMarked: a.revealed || 0, alphaDoc: SiteKit.composePage(ab, { mode: 'document' }) }; });
  ok(r.marked === 2, 'the tool found the 2 elements hidden only by an unrun script (headline + lede): ' + r.marked);
  ok(r.alphaMarked === 0 && !/data-sk-reveal=""/.test(r.alphaDoc), 'a normal site is untouched');
  ok(!/data-sk-reveal/.test(r.plain), 'the plain (flag-off) export carries no new attributes');
  const f = path.join(os.tmpdir(), 'reveal-' + Date.now() + '.html'); fs.writeFileSync(f, r.doc);
  const p = await page.context().newPage(); await p.setViewportSize({ width: 1440, height: 900 }); await p.goto('file://' + f); await p.waitForTimeout(400);
  const v = await p.evaluate(() => { const op = sel => { const e = document.querySelector(sel); return e ? +getComputedStyle(e).opacity : null; }; const T = t => [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.includes(t));
    return { h1: op('.text-display'), lede: op('.lede'), lt: getComputedStyle(document.querySelector('.lede')).transform, modal: +getComputedStyle(T('Subscribe')).opacity, slide2: +getComputedStyle(T('Slide two')).opacity, slide1: +getComputedStyle(T('Slide one')).opacity, tip: +getComputedStyle(T('Tooltip')).opacity }; });
  ok(v.h1 === 1 && v.lede === 1 && v.lt === 'none', 'headline and paragraph are visible in the merged document (opacity ' + v.h1 + '/' + v.lede + ', transform ' + v.lt + ')');
  ok(v.modal === 0, 'a modal that is hidden on purpose stays hidden (' + v.modal + ')');
  ok(v.slide2 === 0 && v.slide1 === 1, 'a non-current slide stays hidden, the current one is visible (' + v.slide2 + '/' + v.slide1 + ')');
  ok(v.tip === 0, 'aria-hidden content stays hidden (' + v.tip + ')');
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
