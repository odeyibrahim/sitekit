// Stage 1.1: edits address elements by stable position, never by matching their text.   Usage: node tests/ids.test.js
const { open } = require('./harness');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['dup'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 30000 });
  const run = (edit) => page.evaluate(edit => { const s = SiteKit.state.sites[0], m = SiteKit.modsOf(s).find(m => /Plan/.test(m.x.html) && m.x.slots.headAll.length >= 3);
    SiteKit.resetEdits(m); const out0 = new DOMParser().parseFromString(m.x.html, 'text/html'); eval(edit); const c = SiteKit.editedCopy(m), d = new DOMParser().parseFromString(c.html, 'text/html');
    const r = { h3: [...d.querySelectorAll('h3')].map(e => e.textContent.trim()), p: [...d.querySelectorAll('article p')].map(e => e.textContent.trim()), a: [...d.querySelectorAll('article a')].map(e => e.textContent.trim() + '|' + e.getAttribute('href')), n: m.x.slots.buttons.length, ord: m.x.slots.headOrd }; SiteKit.resetEdits(m); return r; }, edit);
  console.log('Identical text in several places');
  let r = await run("SiteKit.setSlot(m, 'paragraphs', { 1: { from: 'Same words here.', to: 'Only the middle one' } })");
  ok(r.p.join('|') === 'Same words here.|Only the middle one|Same words here.', 'editing paragraph 2 changes ONLY the 2nd of three identical paragraphs: ' + r.p.join(' | '));
  r = await run("SiteKit.setSlot(m, 'headings', { 3: { from: 'Plan', to: 'Last plan' } })");
  ok(r.h3.join('|') === 'Plan|Plan|Last plan', 'editing the last identical heading changes only that one: ' + r.h3.join(' | '));
  r = await run("SiteKit.setSlot(m, 'buttons', { 2: { from: 'Learn more', to: 'Buy', href: '/buy' } })");
  ok(r.a.join(' ') === 'Learn more|/one Learn more|/two Buy|/buy', 'editing button 3 changes only the 3rd identical button and its link: ' + r.a.join(' '));
  r = await run("SiteKit.setSlot(m, 'paragraphs', { 0: { from: 'Same words here.', to: 'A' }, 2: { from: 'Same words here.', to: 'C' } })");
  ok(r.p.join('|') === 'A|Same words here.|C', 'two edits among identical paragraphs both land on the right ones: ' + r.p.join(' | '));
  console.log('Stability');
  r = await run("SiteKit.setSlot(m, 'paragraphs', { 1: { from: 'text that no longer matches', to: 'Still found by position' } })");
  ok(r.p[1] === 'Still found by position', 'an edit still lands when the remembered original wording differs (position, not text): ' + r.p.join(' | '));
  ok(Array.isArray(r.ord) && r.ord.length >= 3, 'extractor records element positions for slots (headOrd: ' + JSON.stringify(r.ord) + ')');
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
