// Drives the real interface (clicks, drags, downloads) against the fixture sites in tests/fixtures.
// Usage: node tests/ui.test.js [tool/index.html]
const { open } = require('./harness');
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); };
const blocks = page => page.evaluate(() => SiteKit.state.blocks.map(b => b.item.role + '@' + b.site.name));

// For every section frame inside a composed page: is its height equal to what it contains?
async function frameFit(page) {
  await page.waitForTimeout(2500);
  const out = [];
  for (const f of page.frames()) {
    const fe = await f.frameElement().catch(() => null); if (!fe) continue;
    const parentIsPage = await fe.evaluate(e => e.hasAttribute('scrolling'));   // only our section frames
    if (!parentIsPage) continue;
    const r = await f.evaluate(() => { const k = [...document.body.children].filter(c => !/^(SCRIPT|STYLE|LINK)$/.test(c.tagName) && getComputedStyle(c).position !== 'fixed');
      return { content: Math.round(Math.max(...k.map(c => c.getBoundingClientRect().bottom))), frame: innerHeight }; });
    out.push(r);
  }
  return out;
}

(async () => {
  const t = await open({ sites: ['alpha', 'beta', 'gamma', 'delta'] });
  const { page } = t;
  const q = s => page.locator(s);

  console.log('Loading sites');
  const sites = await page.evaluate(() => SiteKit.state.sites.map(s => [s.name, s.status, SiteKit.modsOf(s).length, !!s.rendered]));
  ok(sites.length === 4 && sites.every(s => s[1] === 'ready' && s[2] >= 3), 'all 4 sites read: ' + sites.map(s => s[0] + '=' + s[2]).join(', '));
  ok(sites.find(s => s[0] === 'gamma')[3], 'script-built site (gamma) used the finished-page path');
  ok((await q('#sites .site').count()) === 4, 'site cards shown');

  console.log('Thumbnails');
  await page.waitForTimeout(1200);
  const th = await page.evaluate(() => { const all = [...document.querySelectorAll('.thumb')], on = all.filter(t => t.querySelector('iframe'));
    return { all: all.length, on: on.length, withContent: on.filter(t => { try { return t.querySelector('iframe').contentDocument.body.textContent.trim().length > 0 || t.querySelector('iframe').contentDocument.querySelector('img,svg'); } catch (e) { return false; } }).length }; });
  ok(th.all === await page.evaluate(() => SiteKit.state.sites.reduce((a, s) => a + SiteKit.modsOf(s).length, 0)), 'one thumbnail slot per part (' + th.all + ')');
  ok(th.on > 0 && th.withContent === th.on, 'visible thumbnails are drawn with real content (' + th.withContent + '/' + th.on + ')');
  await q('.col.left').evaluate(e => e.scrollTo(0, e.scrollHeight)); await page.waitForTimeout(1200);
  const th2 = await page.evaluate(() => { const on = [...document.querySelectorAll('.thumb')].filter(t => t.querySelector('iframe')); return { on: on.length, last: !!document.querySelector('#parts .part:last-child .thumb iframe') }; });
  ok(th2.last, 'scrolling down draws the thumbnails that came into view');
  ok(th2.on < th.all, 'thumbnails far off screen are released (' + th2.on + ' of ' + th.all + ' kept)');
  await q('.col.left').evaluate(e => e.scrollTo(0, 0));
  await page.screenshot({ path: path.join(__dirname, 'shot-parts.png') });

  console.log('Look popup');
  await q('.part button:has-text("Look")').first().click(); await page.waitForTimeout(500);
  ok(await q('#dlg').evaluate(d => d.open), 'popup opens');
  ok((await q('#dlgT').textContent()).includes('from'), 'popup title names the part and site');
  ok(await q('#dlgB iframe').evaluate(f => f.contentDocument.body.textContent.trim().length > 0), 'popup shows the part');
  await q('#dlgX').click(); ok(!(await q('#dlg').evaluate(d => d.open)), 'Close closes it');
  await q('.part button:has-text("Look")').nth(1).click(); await q('#dlgAdd').click();
  ok(!(await q('#dlg').evaluate(d => d.open)) && (await blocks(page)).length === 1, '"+ Add to my page" adds the part and closes');
  await q('.thumb').nth(2).click(); ok(await q('#dlg').evaluate(d => d.open), 'clicking a thumbnail opens the popup'); await q('#dlgX').click();

  console.log('Building and reordering');
  await q('#clearPage').click(); ok((await blocks(page)).length === 0 && await q('#download').isDisabled(), 'Start over empties the page and disables download');
  await page.selectOption('#filters', 'nav'); const navs = await q('#parts .part').count();
  ok(navs >= 3, 'filter shows only menu bars (' + navs + ')');
  for (let i = 0; i < 3; i++) await q('#parts .part button:has-text("+ Add")').nth(i).click();
  let b = await blocks(page); ok(b.length === 3, 'three parts added: ' + b.join(', '));
  await q('.block .ops button[title="Move down"]').first().click();
  const b2 = await blocks(page); ok(b2[1] === b[0] && b2[0] === b[1], '↓ moves a part down');
  await q('.block .ops button[title="Move up"]').nth(2).click();
  const b3 = await blocks(page); ok(b3[1] === b2[2] && b3[2] === b2[1], '↑ moves a part up');
  await q('.block').nth(0).dragTo(q('.block').nth(2)); await page.waitForTimeout(200);
  const b4 = await blocks(page); ok(b4[2] === b3[0] && b4.length === 3, 'drag and drop reorders: ' + b3.join(',') + ' → ' + b4.join(','));
  await q('.block .ops button[title="Remove"]').first().click(); ok((await blocks(page)).length === 2, '✕ removes a part');
  await page.selectOption('#filters', 'all');
  await q('#search').fill('wander'); ok((await q('#parts .part').count()) >= 1 && (await q('#parts .part').count()) < 6, 'search narrows the list'); await q('#search').fill('zzzz'); ok((await q('#parts .empty').count()) === 1, 'search with no match says so'); await q('#search').fill('');
  const sel = q('#parts .part select').first(); await sel.selectOption('cta');
  ok((await q('#parts .part .label').first().textContent()) === 'Call to action', 'changing a part\'s kind updates its label');
  await sel.selectOption('nav');   // put it back so later steps see the original kinds

  console.log('Quick start and JSON');
  await q('#clearPage').click();
  await page.selectOption('#tpl', 'landing'); await q('#tplGo').click(); b = await blocks(page);
  ok(b.length >= 4 && b[0].startsWith('nav'), 'quick start builds a landing page: ' + b.join(', '));
  await page.selectOption('#tpl', 'business'); await q('#tplGo').click();
  ok((await q('.note').count()) >= 1, 'business layout reports slots it could not fill (' + await q('.note').first().textContent() + ')');
  await q('#intent').evaluate(e => e.closest('details').open = true);
  await q('#intent').fill('{"slots":[{"role":"nav","source":"beta"},{"role":"hero","source":"alpha"},{"role":"footer","source":"delta"}]}'); await q('#intentGo').click();
  ok((await blocks(page)).join() === 'nav@beta,hero@alpha,footer@delta', 'JSON with sources picks from the named sites: ' + (await blocks(page)).join());
  ok((await q('.note.ok').count()) === 1, 'mixing sites shows the "may not match" note');
  await q('#intent').fill('{nope'); await q('#intentGo').click();
  ok((await q('.note').first().textContent()).includes('isn’t valid'), 'bad JSON shows a friendly message');
  await q('#intent').fill('{"slots":[{"role":"pricing","source":"alpha"}]}'); await q('#intentGo').click();
  ok((await blocks(page)).length === 0 && (await q('.note').count()) === 1, 'unfillable slot is skipped with a note');

  console.log('Preview sizes, mixed page, animations');
  await q('#intent').fill('{"slots":[{"role":"nav","source":"alpha"},{"role":"hero","source":"beta"},{"role":"features","source":"alpha"},{"role":"footer","source":"beta"},{"role":"footer","source":"alpha"},{"role":"hero","source":"delta"},{"role":"footer","source":"delta"}]}'); await q('#intentGo').click();
  await page.waitForTimeout(500);
  let fit = await frameFit(page);
  ok(fit.length === 6 && fit.every(f => Math.abs(f.content - f.frame) <= 2), 'preview: every section frame fits its content: ' + fit.map(f => f.content + '/' + f.frame).join(' '));
  await q('#anim').uncheck(); await page.waitForTimeout(600); fit = await frameFit(page);
  ok(fit.length === 6 && fit.every(f => Math.abs(f.content - f.frame) <= 2), 'animations off: frames still fit: ' + fit.map(f => f.content + '/' + f.frame).join(' '));
  await q('#anim').check();
  for (const [label, w] of [['Tablet', 820], ['Phone', 390], ['Computer', 1440]]) {
    await q('#devices button:has-text("' + label + '")').click(); await page.waitForTimeout(700);
    const vw = await q('#view').evaluate(f => parseInt(f.style.width));
    ok(vw === w, label + ' view is ' + w + 'px wide');
    if (w === 390) { fit = await frameFit(page); ok(fit.every(f => Math.abs(f.content - f.frame) <= 2), 'phone: frames re-fit after narrowing: ' + fit.map(f => f.content + '/' + f.frame).join(' ')); }
  }
  ok((await q('#stat').textContent()).includes('3 website'), 'status line counts parts and websites: ' + await q('#stat').textContent());
  await page.screenshot({ path: path.join(__dirname, 'shot-mixed.png') });

  console.log('Download');
  const [dl] = await Promise.all([page.waitForEvent('download'), q('#download').click()]);
  const file = path.join(os.tmpdir(), 'sitekit-test-' + Date.now() + '.html'); await dl.saveAs(file);
  ok(dl.suggestedFilename() === 'my-website.html', 'file is named my-website.html');
  const p2 = await page.context().newPage(); await p2.setViewportSize({ width: 1440, height: 900 }); await p2.goto('file://' + file);
  fit = await frameFit(p2);
  ok(fit.length === 6 && fit.every(f => Math.abs(f.content - f.frame) <= 2), 'downloaded page: no gaps or cut-off sections: ' + fit.map(f => f.content + '/' + f.frame).join(' '));
  // single-site download is a normal page with no frames
  await q('#clearPage').click(); await q('#sites .site').nth(0).locator('button:has-text("Use the whole page")').click();
  const [dl2] = await Promise.all([page.waitForEvent('download'), q('#download').click()]); const f2 = path.join(os.tmpdir(), 'sitekit-test2-' + Date.now() + '.html'); await dl2.saveAs(f2);
  const txt = fs.readFileSync(f2, 'utf8'); ok(!txt.includes('<iframe') && txt.includes('Gentle care'), 'single-site download is the plain page (no frames)');

  console.log('Removing a site');
  await q('#sites .site').nth(0).locator('.x').click();
  ok((await page.evaluate(() => SiteKit.state.sites.length)) === 3 && (await blocks(page)).length === 0, 'removing a site also removes its parts from the page');

  ok(t.errors.length === 0, 'no JavaScript errors' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
