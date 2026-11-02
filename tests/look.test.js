// Look dialog, extractor-on-Site-Kit-segments, sure/not-sure, approximate flags, font report.   Usage: node tests/look.test.js
const { open } = require('./harness');
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); };
(async () => {
  const t = await open({ sites: ['alpha', 'beta', 'gamma', 'delta', 'risky'] });
  const { page } = t, q = s => page.locator(s);

  console.log('Extractor runs on Site Kit\'s own segments');
  const ev = await page.evaluate(() => SiteKit.state.sites.map(s => { const mods = SiteKit.modsOf(s);
    return { name: s.name, state: s.xstate, rendered: !!s.rendered, n: mods.length, withX: mods.filter(m => m.x && !m.x.error).length, errs: mods.filter(m => m.x && m.x.error).map(m => m.x.error),
      idsMatch: mods.every(m => m.x && m.x.id === 'sk-' + m.id), htmlMatch: mods.every(m => m.x && m.x.html.replace(/ data-skpart=""/g, '').includes(m.html)) }; }));
  ev.forEach(e => ok(e.state === 'done' && e.withX === e.n && e.n >= 3, e.name + ': details for every part (' + e.withX + '/' + e.n + ')' + (e.rendered ? ' [script-built path]' : '') + (e.errs.length ? ' ERR ' + e.errs.join(';') : '')));
  ok(ev.every(e => e.idsMatch), 'part ids line up with Site Kit\'s (sk-<id>) on every site, both paths');
  ok(ev.every(e => e.htmlMatch), 'each extracted part contains exactly the markup Site Kit segmented');

  console.log('Pure helpers');
  const lab = await page.evaluate(() => [SiteKit.motionLabels({ keyframes: [], transitions: 0 }), SiteKit.motionLabels({ keyframes: ['ticker', 'fadeIn'], transitions: 3, dataW: 2 }), SiteKit.motionLabels({ keyframes: ['weird'], transitions: 0, aos: 1 }), SiteKit.motionLabels({ keyframes: [], transitions: 2 })]);
  ok(lab[0][0] === 'Still (no motion)', 'no motion → "Still (no motion)"');
  ok(lab[1].includes('Marquee / ticker') && lab[1].includes('Fade in') && lab[1].includes('Webflow interaction ×2'), 'keyframes and Webflow hooks become preset names: ' + lab[1].join(', '));
  ok(lab[2].includes('Custom animation (weird)') && lab[2].includes('Reveal on scroll (AOS)'), 'unknown keyframe is labelled custom, AOS named: ' + lab[2].join(', '));
  ok(lab[3][0] === 'Hover transitions', 'transitions only → "Hover transitions"');
  ok(!lab.flat().some(l => /[{};:]/.test(l)), 'no raw code appears in any motion label');

  console.log('Look dialog contents (every part of every site)');
  const idx = await page.evaluate(() => { const out = []; SiteKit.state.sites.forEach(s => SiteKit.modsOf(s).forEach((m, i) => out.push([s.name, i]))); return out; });
  let dialsOk = 0, slotsOk = 0, motionOk = 0, sureOk = 0, fontOk = 0, fidOk = 0, tot = 0, notSure = 0, approx = [], exact = [];
  // open via the real UI: click the Look button of each part in turn
  const total = await q('#parts .part').count();
  for (let k = 0; k < total; k++) {
    await q('#parts .part').nth(k).locator('button:has-text("Look")').click();
    await page.waitForFunction(() => { const b = document.getElementById('fidBadge'); return b && b.textContent !== 'checking…'; }, null, { timeout: 15000 }).catch(() => {});
    const r = await page.evaluate(() => ({ title: document.getElementById('dlgT').textContent, dials: document.querySelectorAll('#dlgS .dial').length, slots: document.querySelectorAll('#slotList .slot').length,
      slotKeys: [...document.querySelectorAll('#slotList .slot .k')].map(e => e.textContent).join('|'), motion: document.getElementById('motionList').textContent, sure: document.getElementById('sureBadge').textContent, fid: document.getElementById('fidBadge').textContent,
      font: document.getElementById('fontLine').textContent, dialKeys: [...document.querySelectorAll('#dlgS .dial .k')].map(e => e.textContent).join('|'), unsureText: /guess/.test(document.getElementById('dlgS').textContent) }));
    const exp = await q('#parts .part').nth(k).locator('.unsure').count();
    tot++; if (r.dials === 8) dialsOk++; if (r.slotKeys === 'Headline|Paragraph|Button|Image|Repeated card') slotsOk++; if (r.motion.length) motionOk++;
    if ((exp === 1) === (r.sure === 'not sure') && (r.sure === 'not sure') === r.unsureText) sureOk++; if (r.sure === 'not sure') notSure++; if (r.font.length) fontOk++; if (r.fid === 'exact' || r.fid === 'approximate') fidOk++;
    (r.fid === 'approximate' ? approx : exact).push(r.title);
    await q('#dlgX').click();
  }
  ok(dialsOk === tot, 'all 8 dials shown for every part (' + dialsOk + '/' + tot + ')');
  ok(slotsOk === tot, 'all 5 slots (headline, paragraph, button, image, repeated card) shown for every part');
  ok(motionOk === tot, 'a motion preset label is shown for every part');
  ok(sureOk === tot, '"not sure" appears in the dialog exactly when the list flags it, with the "this is a guess" note (' + notSure + ' of ' + tot + ' parts not sure)');
  ok(fontOk === tot, 'a font line is shown for every part');
  ok(fidOk === tot, 'every part gets an exact/approximate verdict (none left "checking…")');
  console.log('       approximate: ' + approx.length + ', exact: ' + exact.length);

  console.log('Known failure causes are flagged, not passed silently (risky.html)');
  const rk = await page.evaluate(async () => { const s = SiteKit.state.sites.find(x => x.name === 'risky'); const out = [];
    for (const m of SiteKit.modsOf(s)) { await SiteKit.checkFidelity(m); out.push({ role: m.role, tag: m.x.tag, h: m.height, reasons: SiteKit.approxReasons(s, m) }); } return out; });
  console.log('       ' + rk.map(r => r.role + '/' + r.tag + ':' + r.reasons.length).join('  '));
  ok(rk.some(r => r.reasons.some(x => /fixed layer/.test(x))), 'a fixed menu / fixed background layer is flagged');
  ok(rk.some(r => r.reasons.some(x => /load later/.test(x))), 'lazy images that cannot be promoted (no source at all) are still flagged');
  ok(rk.filter(r => r.reasons.length).length >= 2, 'at least the fixed-layer part and the lazy gallery are approximate');
  const plain = await page.evaluate(async () => { const out = []; for (const n of ['alpha', 'beta', 'delta']) { const s = SiteKit.state.sites.find(x => x.name === n); for (const m of SiteKit.modsOf(s)) { const f = await SiteKit.checkFidelity(m); out.push({ n, role: m.role, kind: m.kind, geom: f.geom, hErr: f.hErr, approx: SiteKit.approxReasons(s, m).length > 0 }); } } return out; });
  const flow = plain.filter(p => p.kind === 'module');
  ok(flow.every(p => !p.approx), 'plain in-flow parts (alpha, beta, delta) are NOT flagged: no false alarms (' + flow.map(p => Math.round(p.geom * 100) + '%').join(' ') + ')');
  await q('#clearPage').click();
  const badges = await q('#parts .badge.warn').count(); ok(badges >= 3, 'the parts list shows an "approximate" badge too (' + badges + ')');

  console.log('Setting the kind yourself');
  const sel = q('#parts .part select').first(); await sel.selectOption('cta');
  await q('#parts .part').first().locator('button:has-text("Look")').click();
  ok((await q('#sureBadge').textContent()) === 'sure (you set it)', 'a kind you set shows as sure (you set it)'); await q('#dlgX').click();

  console.log('Font report');
  const fr = await page.evaluate(() => { const R = SiteKit.fontReport(); return { decls: R.decls, wired: R.wired, hard: R.hardParts, parts: R.parts, names: R.sites.map(s => s.name) }; });
  ok(fr.decls > 0 && fr.wired <= fr.decls && fr.hard > 0, 'report counts font rules (' + fr.wired + '/' + fr.decls + ' wired) and parts with hard-coded fonts (' + fr.hard + ' of ' + fr.parts + ')');
  await q('#fontBtn').click();
  const ft = await q('#fontB').textContent();
  ok(/Georgia/.test(ft) && /Verdana/.test(ft), 'report names the hard-coded families (Georgia from a font: shorthand, Verdana from a font-family rule)');
  ok(/follow the font dials/.test(await q('#fontSum').textContent()), 'report states the overall share'); await q('#fontX').click();
  const csv = await page.evaluate(() => SiteKit.fontCsv()); ok(csv.split('\n').length > 5 && csv.startsWith('"site"'), 'CSV export has a row per part');

  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
