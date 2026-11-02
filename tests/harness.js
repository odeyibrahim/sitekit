// Shared helper: serves the repo and opens the tool in a browser.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
async function open({ tool = 'tool/index.html', viewport = { width: 1500, height: 950 }, sites = [] } = {}) {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/${tool}`);
  for (const s of sites) {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', s + '.html'), 'utf8');
    await page.evaluate(([n, h]) => SiteKit.addSite(n, h), [s + '.html', html]);
  }
  return { page, browser, errors, close: async () => { await browser.close(); srv.close(); } };
}
module.exports = { open };
