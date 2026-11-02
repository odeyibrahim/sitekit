// Stage 2: merged single-document export (flag export.mode = "document").   Usage: node tests/document.test.js
const { open } = require('./harness'); const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['alpha', 'beta', 'delta', 'risky'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 40000 });
  const mix = await page.evaluate(() => { const S = SiteKit.state.sites, pick = (n, role) => { const s = S.find(x => x.name === n); return { site: s, item: SiteKit.modsOf(s).find(m => m.role === role) }; };
    const bl = [pick('alpha', 'nav'), pick('beta', 'hero'), pick('alpha', 'features'), pick('alpha', 'nav'), pick('risky', 'nav'), pick('beta', 'nav'), pick('beta', 'footer')].map((b, i) => Object.assign({ uid: 50 + i }, b));
    const off = SiteKit.composePage(bl), doc = SiteKit.composePage(bl, { mode: 'document' }), rep = SiteKit.composeDocument.last;
    const d = new DOMParser().parseFromString(doc, 'text/html'), ids = [...d.querySelectorAll('[id]')].map(e => e.id);
    return { offFrames: (off.match(/<iframe/g) || []).length, doc, rep, frames: d.querySelectorAll('iframe').length, dupIds: ids.length - new Set(ids).size, roots: d.querySelectorAll('[data-skpart]').length, faces: (doc.match(/@font-face/g) || []).length, scripts: d.querySelectorAll('script').length,
      leftover: (doc.match(/(?<![\w-])sk-\d+(?![A-Za-z0-9-])/g) || []).length, flat: (doc.match(/position:static!important;top:auto!important/g) || []).length }; });
  console.log('Mixed page (3 sites, one part used twice)');
  ok(mix.offFrames >= 3, 'flag OFF: today\'s export still uses frames (' + mix.offFrames + ')');
  ok(mix.frames === 0 && mix.doc.length > 500, 'flag ON: one document, no iframes');
  ok(mix.roots === 7 && mix.rep.blocks === 7, 'all seven blocks are in it');
  ok(mix.dupIds === 0, 'no duplicate element ids, even with the same part twice (' + mix.rep.idsRenamed + ' renamed)');
  ok(mix.leftover === 0, 'every part id was namespaced (no bare sk-<n> left)');
  ok(mix.scripts === 0, 'no scripts (site scripts stay out; behaviours are a separate flag)');
  ok(mix.rep.flattened.length >= 1 && mix.flat === mix.rep.flattened.length, 'extra fixed layers are flattened and reported: ' + JSON.stringify(mix.rep.flattened));
  console.log('Renders');
  const f = path.join(os.tmpdir(), 'doc-' + Date.now() + '.html'); fs.writeFileSync(f, mix.doc);
  const p = await page.context().newPage(); await p.setViewportSize({ width: 1440, height: 900 }); await p.goto('file://' + f); await p.waitForTimeout(500);
  const r = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, text: document.body.innerText.replace(/\s+/g, ' '), fixed: [...document.querySelectorAll('[data-skpart],[data-skpart] *')].filter(e => getComputedStyle(e).position === 'fixed').length }));
  ok(r.h > 1000 && /Gentle care/.test(r.text) && /Wander further/.test(r.text), 'it renders with content from both sites (' + r.h + 'px tall)');
  ok(r.fixed <= 1, 'at most one fixed layer is left on the page (' + r.fixed + ')');
  console.log('Whole single site');
  const one = await page.evaluate(() => { const s = SiteKit.state.sites[0], bl = SiteKit.modsOf(s).filter(m => m.kind === 'module' || m.role === 'nav').map((m, i) => ({ uid: 1 + i, site: s, item: m })); return { doc: SiteKit.composePage(bl, { mode: 'document' }), plain: SiteKit.composePage(bl, { mode: 'iframes' }) }; });
  ok(!/<iframe/.test(one.doc) && !/<iframe/.test(one.plain), 'single site: document mode and the old plain page are both frameless');
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
