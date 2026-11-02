// Flag-off guarantee: with project features OFF, exports are byte-identical to the stored snapshots.  Usage: node tests/snapshot.test.js [--update]
const { open } = require('./harness'); const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = path.join(__dirname, 'snapshots', 'export-off.json'), update = process.argv.includes('--update');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
(async () => {
  const t = await open({ sites: ['alpha', 'beta', 'delta'] }); const { page } = t;
  await page.waitForFunction(() => SiteKit.state.sites.every(s => s.xstate === 'done'), null, { timeout: 40000 });
  const out = await page.evaluate(() => { const S = SiteKit.state.sites, mods = s => SiteKit.modsOf(s), blk = (s, ms) => ms.map((m, i) => ({ uid: 900 + i, site: s, item: m }));
    const r = {};
    r.alpha_whole = SiteKit.composePage(blk(S[0], mods(S[0])));
    r.beta_whole = SiteKit.composePage(blk(S[1], mods(S[1])));
    r.mixed = SiteKit.composePage([...blk(S[0], mods(S[0]).slice(0, 2)), ...blk(S[1], mods(S[1]).slice(-1)), ...blk(S[2], mods(S[2]).slice(1, 3))]);
    const hero = mods(S[0]).find(m => m.role === 'hero'); SiteKit.setSlot(hero, 'headings', { 0: { from: hero.x.slots.headFull, to: 'Snapshot headline' } });
    r.edited = SiteKit.composePage(blk(S[0], [hero])); SiteKit.resetEdits(hero);
    return r; });
  const hashes = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, sha(v)]));
  if (update) { fs.writeFileSync(FILE, JSON.stringify(hashes, null, 1)); console.log('snapshots written', hashes); }
  else { const want = JSON.parse(fs.readFileSync(FILE, 'utf8')); for (const k of Object.keys(want)) ok(hashes[k] === want[k], 'export "' + k + '" is byte-identical to the snapshot (' + hashes[k] + ')'); }
  ok(t.errors.length === 0, 'no JavaScript errors');
  console.log(`\n${pass} passed, ${fail} failed`); await t.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
