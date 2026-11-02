// Every slot, cards (add / remove / reorder), background gradient + picture, motion presets, the part-check export.   Usage: node tests/edit2.test.js
const { open } = require('./harness'); const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8Dwn4GBgQEAFAAB/2Wk3QAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const t = await open({ sites: ['pics', 'risky'] }); const { page } = t; const q = s => page.locator(s);
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 40000 });
  const roles = await page.evaluate(() => SiteKit.modsOf(SiteKit.state.sites[0]).map(m => m.role)); console.log('pics parts: ' + roles.join(', '));
  const look = async i => { await q('#parts .part').nth(i).locator('button:has-text("Look")').click(); await page.waitForTimeout(700); };
  const close = async () => { await q('#dlgX').click(); await page.waitForTimeout(200); };
  const inFrame = fn => q('#dlgB iframe').evaluate(fn);
  const wait = () => page.waitForTimeout(450);

  console.log('Every heading and paragraph, not just the first');
  await look(3);
  ok(await q('#slotList textarea').count() >= 5, 'headings and paragraphs each get a box (' + await q('#slotList textarea').count() + ' boxes for 4 headings + 3 paragraphs)');
  await q('textarea[aria-label="headings 2"]').fill('Basic'); await q('textarea[aria-label="paragraphs 3"]').fill('Built to last.'); await wait();
  let h3 = await inFrame(f => [...f.contentDocument.querySelectorAll('h3')].map(e => e.textContent.trim()));
  ok(h3.join() === 'Basic,Growth,Scale', 'second heading edited, the rest untouched: ' + h3.join(', '));
  ok((await inFrame(f => f.contentDocument.body.textContent)).includes('Built to last.'), 'the third paragraph is editable too');

  console.log('Pictures');
  ok(await q('#slotList input[aria-label="Picture 2 address"]').count() === 1, 'each picture has its own box (3 in this part)');
  const before = await inFrame(f => [...f.contentDocument.querySelectorAll('img')].map(i => i.getAttribute('src').slice(-12)));
  await q('input[aria-label="Choose picture 2"]').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG }); await wait(); await wait();
  const after = await inFrame(f => [...f.contentDocument.querySelectorAll('img')].map(i => i.getAttribute('src').slice(-12)));
  ok(after[1] !== before[1] && after[0] === before[0] && after[2] === before[2], 'uploading a picture replaces only the second one');
  await q('input[aria-label="Picture 3 address"]').fill('https://example.test/c.jpg'); await q('input[aria-label="Picture 3 address"]').dispatchEvent('change'); await wait();
  ok((await inFrame(f => f.contentDocument.querySelectorAll('img')[2].getAttribute('src'))) === 'https://example.test/c.jpg', 'typing a web address replaces the third picture');

  console.log('Cards');
  const rows = () => q('#cardList .cardrow').count(), cardTitles = () => inFrame(f => [...f.contentDocument.querySelectorAll('article.card h3')].map(e => e.textContent.trim()));
  ok(await rows() === 3, 'three cards listed');
  await q('#cardList button[aria-label="Duplicate card"]').nth(0).click(); await wait();
  ok(await rows() === 4 && (await cardTitles()).join() === 'Basic,Basic,Growth,Scale', 'duplicate adds a fourth card right after the first: ' + (await cardTitles()).join(', '));
  ok((await inFrame(f => new Set([...f.contentDocument.querySelectorAll('[id]')].map(e => e.id)).size === [...f.contentDocument.querySelectorAll('[id]')].length)), 'copies do not repeat ids');
  await q('#cardList button[aria-label="Remove card"]').nth(3).click(); await wait();
  ok((await cardTitles()).join() === 'Basic,Basic,Growth', 'remove takes the last card out: ' + (await cardTitles()).join(', '));
  await q('#cardList button[aria-label="Move card up"]').nth(2).click(); await wait();
  ok((await cardTitles()).join() === 'Basic,Growth,Basic', 'move up reorders: ' + (await cardTitles()).join(', '));
  await q('#cardList button[aria-label="Remove card"]').nth(0).click(); await q('#cardList button[aria-label="Remove card"]').nth(0).click(); await wait();
  ok(await rows() === 1 && await q('#cardList button[aria-label="Remove card"]').first().isDisabled(), 'the last remaining card cannot be removed');
  for (let i = 0; i < 24; i++) { if (await q('#cardList button[aria-label="Duplicate card"]').first().isDisabled()) break; await q('#cardList button[aria-label="Duplicate card"]').first().click(); }
  ok(await rows() === 24 && await q('#cardList button[aria-label="Duplicate card"]').first().isDisabled(), 'capped at 24 cards');
  await q('#editReset').click(); await wait(); ok(await rows() === 3 && (await cardTitles()).join() === 'Starter,Growth,Scale', 'Reset puts the three original cards back');
  await q('#cardList button[aria-label="Duplicate card"]').nth(2).click(); await wait();
  // card edits flow into the page + download
  await q('#dlgAdd').click(); await page.waitForTimeout(500);
  const html = await page.evaluate(() => SiteKit.composePage(SiteKit.state.blocks));
  ok((html.match(/<article/g) || []).length === 4 && !/<iframe/.test(html), 'the composed page has the four cards');
  await page.evaluate(() => SiteKit.state.blocks.length = 0);

  console.log('Background picture and gradient');
  await look(1); ok(await q('#bgMode').count() === 1, 'the hero offers a background control');
  const bgOf = () => inFrame(f => { const w = f.contentWindow, el = f.contentDocument.querySelector('.hero'); const s = w.getComputedStyle(el); return { img: s.backgroundImage.slice(0, 40), col: s.backgroundColor }; });
  ok(/url/.test((await bgOf()).img), 'it starts as a picture');
  await q('#bgMode').selectOption('gradient'); await wait(); ok(/linear-gradient/.test((await bgOf()).img), 'switching to a gradient paints one');
  await q('#bgLayer input[type=color]').nth(0).evaluate(e => { e.value = '#00ff00'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await q('#bgLayer input[type=color]').nth(1).evaluate(e => { e.value = '#0000ff'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait();
  ok(/rgb\(0, 255, 0\).*rgb\(0, 0, 255\)/.test(await inFrame(f => f.contentWindow.getComputedStyle(f.contentDocument.querySelector('.hero')).backgroundImage)), 'its two colours follow the pickers');
  await q('#bgMode').selectOption('color'); await q('#bgLayer input[type=color]').evaluate(e => { e.value = '#ff0000'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait();
  const c = await bgOf(); ok(c.img === 'none' && c.col === 'rgb(255, 0, 0)', 'flat colour replaces the picture');
  await q('#bgMode').selectOption('picture'); await q('#bgLayer input[type=file]').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG }); await wait(); await wait();
  ok(/data:image\/png/.test((await bgOf()).img) || /url\("data:/.test(await inFrame(f => f.contentDocument.querySelector('.hero').getAttribute('style') || '')), 'an uploaded picture becomes the background');
  const keepBack = await bgOf(); ok(/url/.test(keepBack.img), 'back to the original picture');
  await close();
  await look(2); ok(await q('#bgMode').count() === 1 && /gradient/.test(await q('#bgLayer').locator('option').first().textContent()), 'a gradient band offers "Keep the site’s gradient"');
  await q('#bgMode').selectOption('gradient'); await wait();
  ok(/rgb\(255, 154, 0\).*rgb\(255, 0, 102\)/.test(await inFrame(f => f.contentWindow.getComputedStyle(f.contentDocument.querySelector('.grad')).backgroundImage)), 'the gradient starts from the site’s own two colours');
  await q('#editReset').click(); await close();

  console.log('Motion presets');
  await look(3); const probes = { left: 'translateX(-60px)', right: 'translateX(60px)', zoom: 'scale(.92)', fade: 'translateY(0)', rise: 'translateY(40px)', hover: ':hover', still: 'animation:none' };
  ok((await q('#motionSel option').allTextContents()).length === 8, 'eight presets to choose from');
  for (const [k, want] of Object.entries(probes)) { await q('#motionSel').selectOption(k); await wait(); const css = await inFrame(f => f.contentDocument.querySelector('style').textContent); ok(css.includes(want), 'preset "' + k + '" is in the copy'); }
  await q('#motionSel').selectOption('keep'); await wait(); await q('#editReset').click(); await close();

  console.log('Part check export');
  const rowsCsv = await page.evaluate(() => SiteKit.checkAll());
  const total = await page.evaluate(() => SiteKit.state.sites.reduce((a, s) => a + SiteKit.modsOf(s).length, 0));
  ok(rowsCsv.length === total + 1, 'one row per part (' + total + ') plus a header');
  ok(rowsCsv.slice(1).every(r => ['exact', 'approximate', 'no copy'].includes(r[4])), 'every part is exact, approximate or "no copy": never blank');
  ok(rowsCsv.slice(1).some(r => r[0] === 'risky' && r[4] === 'approximate' && r[5]), 'known trouble parts (risky.html) are approximate, with the reason');
  const [dl] = await Promise.all([page.waitForEvent('download'), q('#checkBtn').click()]); const f = path.join(os.tmpdir(), 'check-' + Date.now() + '.csv'); await dl.saveAs(f);
  ok(dl.suggestedFilename() === 'part-check.csv' && fs.readFileSync(f, 'utf8').split('\n').length === total + 1, 'the button downloads part-check.csv');

  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
