// Editing: dials, slots, motion, applied to the extracted copy and carried into the page and the download.  Usage: node tests/edit.test.js
const { open } = require('./harness'); const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
(async () => {
  const t = await open({ sites: ['alpha', 'beta'] }); const { page } = t; const q = s => page.locator(s);
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 30000 });
  const heroIdx = await page.evaluate(() => SiteKit.modsOf(SiteKit.state.sites[0]).findIndex(m => m.role === 'hero'));
  console.log('Opening the hero of alpha');
  await q('#parts .part:has(.label:text-is("Big banner"))').first().locator('button:has-text("Look")').click(); await page.waitForTimeout(800);
  ok(await q('#dlgS .dial input').count() >= 4, 'dials are inputs now (' + await q('#dlgS .dial input').count() + ')');
  ok(await q('#slotList textarea').count() >= 1 && await q('#slotList input[type=text]').count() >= 1, 'slots are editable (headline, paragraph, button)');
  ok(await q('#motionSel').count() === 1, 'a motion preset menu is there');
  ok((await q('#slotList .slot .k').allTextContents()).join('|') === 'Headline|Paragraph|Button|Image|Repeated card', 'the five slots keep their names and order');

  console.log('Slots');
  const orig = await page.evaluate(() => { const m = SiteKit.modsOf(SiteKit.state.sites[0]).find(m => m.role === 'hero'); return { head: m.x.slots.headFull, btn: m.x.slots.buttons[0].label, par: m.x.slots.paragraphFull }; });
  await q('#slotList textarea').first().fill('Brand new headline'); await q('#slotList input[type=text]').first().fill('Call us today');
  await page.waitForTimeout(500);
  const txt = () => q('#dlgB iframe').evaluate(f => f.contentDocument.body.textContent.replace(/\s+/g, ' '));
  let t1 = await txt(); ok(t1.includes('Brand new headline') && !t1.includes(orig.head), 'preview shows the new headline in place of "' + orig.head + '"');
  ok(t1.includes('Call us today') && !t1.includes(orig.btn), 'preview shows the new button label');
  ok(t1.includes(orig.par.slice(0, 30)), 'the paragraph, untouched, is still there');
  ok((await q('#dlgS .seg2 button').nth(1).getAttribute('aria-pressed')) === 'true', 'view switched to the edited copy');
  ok((await q('#editBadge').textContent()) === 'edited', 'panel says "edited"');

  console.log('Dials');
  await q('#dlgS .dial input[type=color]').first().evaluate(e => { e.value = '#ff0066'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const num = q('#dlgS .dial input[type=number]'); const nn = await num.count();
  if (nn) { await num.first().fill('3'); await num.first().dispatchEvent('change'); }
  await q('#dlgS .dial').filter({ hasText: 'Heading size' }).locator('input[type=number]').fill('80'); await q('#dlgS .dial').filter({ hasText: 'Heading size' }).locator('input[type=number]').dispatchEvent('change');
  await page.waitForTimeout(500);
  const st = await q('#dlgB iframe').evaluate(f => { const d = f.contentDocument, w = f.contentWindow; const h = d.querySelector('h1,h2,h3'); const els = [...d.querySelectorAll('*')]; return { hs: h ? w.getComputedStyle(h).fontSize : null, bg: els.some(e => w.getComputedStyle(e).backgroundColor === 'rgb(255, 0, 102)') || els.some(e => w.getComputedStyle(e).color === 'rgb(255, 0, 102)') || els.some(e => w.getComputedStyle(e).borderColor === 'rgb(255, 0, 102)') }; });
  ok(st.hs === '80px', 'heading size dial changes the heading to 80px (got ' + st.hs + ')');
  ok(st.bg, 'the first colour dial recolours the part (#ff0066 appears)');

  console.log('Motion');
  await q('#motionSel').selectOption('rise'); await page.waitForTimeout(500);
  const hasAnim = await q('#dlgB iframe').evaluate(f => /_in/.test(f.contentDocument.querySelector('style').textContent) && !!f.contentDocument.querySelector('[id^=sk-]'));
  ok(hasAnim, 'the "Rise and fade in" preset is applied to the copy');
  await q('#motionSel').selectOption('still'); await page.waitForTimeout(400);
  const still = await q('#dlgB iframe').evaluate(f => { const d = f.contentDocument, w = f.contentWindow; return [...d.querySelectorAll('[id^=sk-] *')].every(e => w.getComputedStyle(e).animationName === 'none' && w.getComputedStyle(e).transitionDuration === '0s'); });
  ok(still, '"Still" turns every animation and transition off inside the part');

  console.log('Into the page and the download');
  await q('#motionSel').selectOption('fade');
  await q('#dlgAdd').click(); await page.waitForTimeout(600);
  ok((await q('.block .s').first().textContent()).includes('edited'), 'the page outline marks the part as edited');
  ok(await q('#parts .part .badge:has-text("edited")').count() === 1, 'the parts list marks it as edited');
  const html1 = await page.evaluate(() => SiteKit.composePage(SiteKit.state.blocks));
  ok(html1.includes('Brand new headline') && html1.includes('Call us today') && !html1.includes(orig.head), 'composed single-part page carries the edits (not the original text)');
  ok(!/<iframe/.test(html1), 'a single edited part is a plain page, no frames');
  // add an unedited part from the OTHER site
  await page.evaluate(() => { const s = SiteKit.state.sites[1]; SiteKit.state.blocks.push({ uid: 99, site: s, item: SiteKit.modsOf(s).find(m => m.role === 'footer') }); });
  const html2 = await page.evaluate(() => SiteKit.composePage(SiteKit.state.blocks));
  ok((html2.match(/<iframe/g) || []).length === 2 && html2.includes('Brand new headline'), 'mixed with another site: two frames, edits still there');
  // unedited same-site parts are still grouped the old way
  const g = await page.evaluate(() => { const s = SiteKit.state.sites[0], ms = SiteKit.modsOf(s).filter(m => m.role !== 'hero').slice(0, 2); return SiteKit.composePage(ms.map((m, i) => ({ uid: 200 + i, site: s, item: m }))); });
  ok(!/<iframe/.test(g), 'unedited parts of one site are untouched by all this (still one plain page)');
  await q('#stage').scrollIntoViewIfNeeded(); await page.waitForTimeout(2000);
  const [dl] = await Promise.all([page.waitForEvent('download'), q('#download').click()]); const file = path.join(os.tmpdir(), 'edit-' + Date.now() + '.html'); await dl.saveAs(file);
  const dtxt = fs.readFileSync(file, 'utf8'); ok(dtxt.includes('Brand new headline'), 'downloaded file contains the edited headline');
  ok(!/<script(?![^>]*nonce)[^>]*>[^<]*gsap/i.test(dtxt), 'no site scripts are in the edited copy');
  const p2 = await page.context().newPage(); await p2.setViewportSize({ width: 1440, height: 900 }); await p2.goto('file://' + file); await p2.waitForTimeout(1500);
  const shown = await p2.evaluate(() => [...document.querySelectorAll('iframe')].map(f => f.contentDocument.body.textContent).join(' '));
  ok(/Brand new headline/.test(shown), 'the downloaded page renders the edit');

  console.log('Reset and the API');
  await page.evaluate(() => SiteKit.state.blocks.length = 0);
  await q('#parts .part:has(.label:text-is("Big banner"))').first().locator('button:has-text("Look")').click(); await page.waitForTimeout(600);
  ok((await q('#slotList textarea').first().inputValue()) === 'Brand new headline', 'edits are remembered when the dialog is reopened');
  await q('#editReset').click(); await page.waitForTimeout(500);
  ok((await q('#slotList textarea').first().inputValue()) === orig.head && (await q('#editBadge').textContent()) === 'not edited', 'Reset my edits restores the original words');
  const api = await page.evaluate(() => { const m = SiteKit.modsOf(SiteKit.state.sites[0]).find(m => m.role === 'hero'); SiteKit.setDial(m, 'radius', 30); SiteKit.setDial(m, 'fontDisplay', 'Courier New, monospace'); const c = SiteKit.editedCopy(m); const out = { radius: /var\(--sk-radius/.test(c.css) || !/border-radius\s*:\s*[1-9]/.test(m.x.css), font: /--sk-font-display:Courier New/.test(c.css) }; SiteKit.resetEdits(m); return out; });
  ok(api.font, 'font dial writes the font variable'); ok(api.radius, 'radius dial rewrites rounded corners to a variable (or the part has none)');
  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
