// Stage 1.2 / 1.3: pages, project.json, link resolution on export, report panel, zip.   Usage: node tests/project.test.js
const { open } = require('./harness'); const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['acme'] }); const { page } = t, q = s => page.locator(s);
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 40000 });
  const setup = () => page.evaluate(() => { const s = SiteKit.state.sites[0], P = SiteKit.project, ms = SiteKit.modsOf(s);
    SiteKit.state.blocks = ms.map((m, i) => ({ uid: 700 + i, site: s, item: m }));        // page 1 (Home) = whole site
    const ai = SiteKit.addPage('About', '/about'); SiteKit.switchPage(ai); SiteKit.state.blocks = ms.filter(m => /Forge|Acme/.test(m.x.html)).map((m, i) => ({ uid: 800 + i, site: s, item: m }));
    SiteKit.switchPage(0); return { pages: P.pages.map(p => p.id + ':' + p.file + ':' + p.sourceUrl), cur: P.cur, home: SiteKit.state.blocks.length }; });
  console.log('Pages');
  const s0 = await setup();
  ok(s0.pages.join() === 'home:index.html:/,about:about.html:/about', 'a second page is added with its own file and original address: ' + s0.pages.join());
  ok(s0.cur === 0 && s0.home >= 4, 'switching pages brings back each page\'s own parts (' + s0.home + ' on Home)');
  const pj = await page.evaluate(() => SiteKit.projectJson());
  ok(pj.pages.length === 2 && pj.products.length === 0 && pj.payments.enabled === false && pj.pages[1].sourceUrl === '/about', 'project.json lists pages, empty products, payments off');
  console.log('Link report (read-only)');
  const rep = await page.evaluate(() => { const r = SiteKit.linkReport(), S = SiteKit.summarizeLinks(r); return { origin: SiteKit.project.origin, sure: SiteKit.project.originSure, S, orig: [...new Set(r.filter(x => x.status === 'original').map(x => x.href))], miss: [...new Set(r.filter(x => x.status === 'anchor-missing').map(x => x.href))] }; });
  ok(rep.origin === 'https://www.acme.com' && rep.sure, 'original site found from the page\'s canonical link: ' + rep.origin);
  ok(rep.orig.sort().join() === '/blog/post,/contact,/privacy', 'links to pages that do not exist in the project are listed: ' + rep.orig.join(' '));
  ok(rep.miss.join() === '#pricing', 'a button pointing at a section that is not on the page is reported: ' + rep.miss.join(' '));
  ok(rep.S.page >= 3 && rep.S.external >= 1 && rep.S.contact >= 1 && rep.S.dead >= 1, 'summary counts pages/external/mail/dead (' + JSON.stringify(rep.S) + ')');
  console.log('Export, flag OFF');
  const off = await page.evaluate(() => { SiteKit.project.resolveLinks = false; return SiteKit.exportProject().map(f => [f.path, f.content.length, /href="\/about"/.test(f.content), /data-original-link/.test(f.content)]); });
  ok(off.map(f => f[0]).join() === 'index.html,about.html,project.json', 'files: ' + off.map(f => f[0]).join(', '));
  ok(off[0][2] && !off[0][3], 'with resolving off the page keeps its original links untouched');
  console.log('Export, flag ON');
  const on = await page.evaluate(() => { SiteKit.project.resolveLinks = true; const f = SiteKit.exportProject(), by = n => (f.find(x => x.path === n) || {}).content || ''; return { paths: f.map(x => x.path), idx: by('index.html'), csv: by('link-report.csv') }; });
  ok(on.paths.includes('link-report.csv'), 'a link-report.csv is added');
  ok(/href="about.html"/.test(on.idx) && !/href="\/about"/.test(on.idx), '/about now points at about.html');
  ok(/href="index.html"|href="#"/.test(on.idx), 'the home link points at this page');
  ok(/href="\/contact"[^>]*data-original-link="true"|data-original-link="true"[^>]*href="\/contact"/.test(on.idx), 'a link with no matching page is kept and marked data-original-link');
  ok(/href="https:\/\/twitter.com\/acme"[^>]*data-external|data-external[^>]*href="https:\/\/twitter.com\/acme"/.test(on.idx) && /mailto:hi@acme.com/.test(on.idx), 'external and mailto are untouched and marked data-external');
  ok(/data-sk-dead/.test(on.idx), 'javascript:void(0) and the missing #pricing are marked dead');
  console.log('Decisions');
  const dec = await page.evaluate(() => { const P = SiteKit.project; P.rules['/contact'] = { action: 'keep' }; P.rules['/blog/post'] = { action: 'page', target: 'about' }; P.rules['/privacy'] = { action: 'remove' }; P.rules['#pricing'] = undefined;
    const r = SiteKit.linkReport(), S = SiteKit.summarizeLinks(r); return { S, unack: [...new Set(r.filter(x => x.status === 'original').map(x => x.href))] }; });
  ok(dec.S['original-kept'] >= 1 && dec.unack.length === 0, 'after Keep / Point at a page / Remove, no link is left unacknowledged (' + dec.S.unacknowledged + ' = only the missing anchor)');
  console.log('Zip');
  const b64 = await page.evaluate(async () => { const blob = SiteKit.makeZip(SiteKit.exportProject()), buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; buf.forEach(b => s += String.fromCharCode(b)); return btoa(s); });
  const zf = path.join(os.tmpdir(), 'proj-' + Date.now() + '.zip'); fs.writeFileSync(zf, Buffer.from(b64, 'base64'));
  let zt = ''; try { zt = cp.execSync('unzip -t ' + zf + ' 2>&1').toString(); } catch (e) { zt = String(e.stdout || e); }
  ok(/No errors detected/.test(zt) && /index.html/.test(zt) && /project.json/.test(zt), 'the zip is valid (unzip -t: no errors) and holds the pages and project.json');
  console.log('Dialog');
  await q('#projBtn').click(); await page.waitForTimeout(400);
  ok(await q('#projDlg').evaluate(d => d.open), 'Project… opens the dialog');
  ok(await q('#projPages > div').count() === 2, 'both pages are listed');
  await q('#projNewName').fill('Pricing'); await q('#projAdd').click(); ok(await q('#projPages > div').count() === 3, 'adding a page from the dialog works');
  const rows = await q('#projReport select').count(); ok(rows >= 1, 'the report offers a decision for each unresolved link (' + rows + ' left)');
  await page.evaluate(() => { delete SiteKit.project.rules['/contact']; delete SiteKit.project.rules['/privacy']; });
  await q('#projNewName').fill('x'); await q('#projAdd').click();   // re-render
  await q('#projReport select').first().selectOption('keep'); await page.waitForTimeout(300);
  ok(Object.keys(await page.evaluate(() => SiteKit.project.rules)).length >= 1, 'choosing Keep in the dialog stores a rule');
  await q('#projLinks').check(); ok(await page.evaluate(() => SiteKit.project.resolveLinks), 'the Resolve links box turns the feature on');
  const [dl] = await Promise.all([page.waitForEvent('download'), q('#projZip').click()]); ok(/\.zip$/.test(dl.suggestedFilename()), 'the Download project button saves ' + dl.suggestedFilename());
  await q('#projX').click();
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
