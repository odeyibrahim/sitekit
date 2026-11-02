// Stage 2/3 measurement: how close is each export to the LIVE page (the saved page, rendered with its scripts)?
// Variants: plain (today's single-site export), doc (merged document, behaviours OFF), docbeh (merged document, behaviours ON).
// Usage: node eval/mergecheck.js <dir> [only-substring]     writes eval/merge/<site>/*.png and eval/merge/shots.json; then run eval/mergescore.py
const fs = require('fs'), path = require('path'), { open } = require('../tests/harness');
const dir = process.argv[2], only = process.argv[3], OUT = path.join(__dirname, 'merge'), CAP = 9000;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && (!only || f.includes(only))).sort((a, b) => fs.statSync(path.join(dir, a)).size - fs.statSync(path.join(dir, b)).size);
(async () => {
  const shots = fs.existsSync(path.join(OUT, 'shots.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'shots.json'))) : {};
  for (const f of files) {
    const t = await open({ tool: 'tool/index.html' }); t.page.setDefaultTimeout(0);      // fresh browser per site: a shared, loaded page made script-built sites segment differently (nshine: 1 part vs 4)
    const html = fs.readFileSync(path.join(dir, f), 'utf8'), d = path.join(OUT, f.replace(/\.html$/, '')); fs.mkdirSync(d, { recursive: true });
    const rec = { site: f, err: null, parts: 0 }; const t0 = Date.now();
    try {
      const v = await t.page.evaluate(async ([n, h]) => { SiteKit.state.sites.length = 0; const s = await SiteKit.addSite(n, h); if (s.status !== 'ready') return null;
        const bl = SiteKit.modsOf(s).filter(m => m.kind === 'module' || m.role === 'nav').map((m, i) => ({ uid: i + 1, site: s, item: m }));
        const doc = SiteKit.composePage(bl, { mode: 'document', behaviours: false }), rep = SiteKit.composeDocument.last;
        return { parts: bl.length, plain: SiteKit.composePage(bl, { mode: 'iframes', behaviours: false }), doc, docbeh: SiteKit.composePage(bl, { mode: 'document', behaviours: true }), rep }; }, [f, html]);
      if (!v) throw new Error('site unreadable'); rec.parts = v.parts; rec.rep = v.rep;
      const variants = { live: html, plain: v.plain, doc: v.doc, docbeh: v.docbeh };
      for (const [k, src] of Object.entries(variants)) {
        const fp = path.join(d, k + '.html'); fs.writeFileSync(fp, src);
        const ctx = await t.page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
        await p.route(/^https?:/, r => r.abort());                       // offline for every variant: the comparison is fair
        try {
          await p.goto('file://' + fp, { waitUntil: 'load', timeout: 45000 }).catch(() => {}); await p.waitForTimeout(2500);
          const H = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
          for (let y = 0; y < Math.min(H, CAP); y += 700) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(60); }   // same scroll pass for all: wakes lazy / reveal-on-scroll
          await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
          const h2 = Math.min(await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)), CAP);
          await p.screenshot({ path: path.join(d, k + '.png'), clip: { x: 0, y: 0, width: 1440, height: Math.max(h2, 100) }, fullPage: true, timeout: 60000 }); rec[k + '_h'] = h2;
        } catch (e) { rec[k + '_err'] = String(e).slice(0, 80); }
        await ctx.close();
      }
    } catch (e) { rec.err = String(e).slice(0, 100); }
    rec.secs = Math.round((Date.now() - t0) / 1000); shots[f] = rec; console.log(JSON.stringify({ site: f, parts: rec.parts, live_h: rec.live_h, plain_h: rec.plain_h, doc_h: rec.doc_h, docbeh_h: rec.docbeh_h, err: rec.err || rec.live_err || rec.doc_err || '', secs: rec.secs }));
    fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(shots, null, 1)); await t.close();
  }
})();
