// Stage 2: single-page apps whose router shows one page by script (dria-ventures). The copy must carry the page the router would show.   Usage: node tests/router.test.js
const { open } = require('./harness');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['router', 'alpha', 'router2', 'router3'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 40000 });
  const r = await page.evaluate(() => { const s = SiteKit.state.sites.find(x => x.name === 'router'), mods = SiteKit.modsOf(s), all = mods.map(m => m.x ? m.x.html : '').join('');
    const bl = mods.filter(m => m.kind === 'module' || m.role === 'nav').map((m, i) => ({ uid: i + 1, site: s, item: m }));
    return { n: mods.length, roles: mods.map(m => m.role).join(','), home: /Home page heading/.test(all), second: /Home second block/.test(all), about: /About page heading/.test(all), activeHome: /id="page-home"[^>]*class="[^"]*active|class="[^"]*active[^"]*"[^>]*id="page-home"/.test(all), doc: SiteKit.composePage(bl, { mode: 'document' }), noted: s.spa || 0,
      alphaSpa: SiteKit.state.sites.find(x => x.name === 'alpha').spa || 0 }; });
  ok(r.home && r.second, 'the home route is in the extracted parts (' + r.roles + ')');
  ok(r.activeHome, 'it carries the "active" state, so the copy shows it without a script');
  ok(r.noted === 1, 'the tool records that it activated one route (' + r.noted + ')');
  const s2 = await page.evaluate(() => { const s = SiteKit.state.sites.find(x => x.name === 'router2'); return { spa: s.spa || 0, html: SiteKit.modsOf(s).map(m => m.x ? m.x.html : '').join('') }; });
  ok(s2.spa === 0 && !/class="route on"/.test(s2.html), 'a route group whose saved markup already marks a page (app-active) is left alone (activated: ' + s2.spa + ')');
  const s3 = await page.evaluate(() => { const s = SiteKit.state.sites.find(x => x.name === 'router3'); return { spa: s.spa || 0, rendered: !!s.rendered, n: SiteKit.modsOf(s).length }; });
  ok(s3.rendered && s3.spa === 0 && s3.n >= 1, 'a site that only exists after its scripts run keeps the scripted path, untouched (rendered: ' + s3.rendered + ', parts ' + s3.n + ')');
  ok(r.alphaSpa === 0, 'a normal site is untouched (alpha: ' + r.alphaSpa + ')');
  const f = require('path').join(require('os').tmpdir(), 'router-' + Date.now() + '.html'); require('fs').writeFileSync(f, r.doc);
  const p = await page.context().newPage(); await p.setViewportSize({ width: 1440, height: 900 }); await p.goto('file://' + f); await p.waitForTimeout(400);
  const v = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, text: document.body.innerText }));
  ok(v.h >= 1000 && /Home page heading/.test(v.text) && /Home second block/.test(v.text), 'the merged document shows the home route (' + v.h + 'px tall)');
  ok(!/About page heading/.test(v.text) && !/Contact page heading/.test(v.text), 'the other routes stay hidden, as on the live site');
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
