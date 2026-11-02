// Static audit of saved sites: links (and how many still point at the original domain), scripts, behaviours a copy would need, buy buttons.
// Usage: node eval/audit.js <dir> <out.csv>
const fs = require('fs'), path = require('path');
const dir = process.argv[2], out = process.argv[3];
const attrs = tag => { const o = {}; for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) o[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5]; return o; };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return null; } };
function audit(html) {
  const bodyOnly = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');   // links inside script text are a script's strings, not the page
  const inScript = (html.match(/<a\b/gi) || []).length - (bodyOnly.match(/<a\b/gi) || []).length;
  const links = [...bodyOnly.matchAll(/<a\b[^>]*>/gi)].map(m => attrs(m[0]).href).filter(h => h !== undefined);
  // the original domain: canonical / og:url / base, else the most common absolute host among links+assets
  let origin = null;
  for (const re of [/<link[^>]*rel=["']canonical["'][^>]*>/i, /<meta[^>]*property=["']og:url["'][^>]*>/i, /<base\b[^>]*>/i]) { const m = html.match(re); if (m) { const a = attrs(m[0]); origin = host(a.href || a.content); if (origin) break; } }
  const hosts = {}; links.forEach(l => { const h = host(l); if (h && /^https?:/i.test(l)) hosts[h] = (hosts[h] || 0) + 1; });
  const common = Object.entries(hosts).sort((a, b) => b[1] - a[1])[0];
  if (!origin && common) origin = common[0];
  const k = { total: links.length, anchor: 0, empty: 0, js: 0, mailtel: 0, relative: 0, absOrigin: 0, external: 0 };
  for (const l of links) {
    const t = l.trim();
    if (!t || t === '#') k.empty++;
    else if (t.startsWith('#')) k.anchor++;
    else if (/^javascript:/i.test(t)) k.js++;
    else if (/^(mailto:|tel:)/i.test(t)) k.mailtel++;
    else if (/^https?:\/\//i.test(t) || t.startsWith('//')) { if (origin && host(t.startsWith('//') ? 'https:' + t : t) === origin) k.absOrigin++; else k.external++; }
    else k.relative++;
  }
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(m => attrs(m[0]));
  const lower = html.toLowerCase();
  // markup-only text: attribute strings of real tags (class/id/role/data-*), with <script>/<style> bodies removed, so a CSS rule or JS string mentioning "modal" is not counted as a modal
  const markup = lower.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ').match(/<[a-z][^>]*>/g)?.join(' ') || '';
  const b = {
    scroll_reveal: /data-aos|data-w-id|scrolltrigger|intersectionobserver|wow\.js|data-scroll/.test(lower),
    sticky_header: /sticky|navbar-fixed|is-fixed|fixed-top|header-fixed/.test(markup),
    menu_toggle: /hamburger|menu-toggle|nav-toggle|navbar-toggler|w-nav-button|burger|mobile-menu|menu-button/.test(markup),
    accordion: /<details\b|accordion/.test(markup),
    tabs: /role="tab"|w-tab|data-tab|tabs-menu|tab-pane/.test(markup),
    slider: /swiper|slick-|splide|w-slider|carousel|flickity|owl-carousel/.test(markup),
    lightbox: /lightbox|fancybox|glightbox|magnific|photoswipe/.test(markup),
    form: /<form\b/.test(markup),
    modal: /role="dialog"|modal|popup|<dialog/.test(markup),
    smooth_scroll: /lenis|locomotive|scroll-behavior:\s*smooth|smoothscroll/.test(lower)
  };
  const buy = (html.match(/add to cart|buy now|checkout|purchase|data-product-id/gi) || []).length;
  return { inScript, k, origin, scripts: scripts.length, inlineScripts: scripts.filter(s => !s.src).length, b, buy };
}
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
const rows = [['site', 'bytes', 'origin_guess', 'links_total', 'links_to_original_domain', 'links_relative', 'links_anchor', 'links_empty_or_js', 'links_mailto_tel', 'links_external', 'links_only_inside_script_text', 'scripts', 'behaviours_needed', 'buy_signals']];
const q = v => '"' + String(v).replace(/"/g, '""') + '"';
for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8'), a = audit(html);
  rows.push([f, html.length, a.origin || '', a.k.total, a.k.absOrigin, a.k.relative, a.k.anchor, a.k.empty + a.k.js, a.k.mailtel, a.k.external, a.inScript, a.scripts, Object.keys(a.b).filter(x => a.b[x]).join(' '), a.buy]);
}
fs.writeFileSync(out, rows.map(r => r.map(q).join(',')).join('\n'));
const tot = rows.slice(1).reduce((s, r) => s + r[3], 0), orig = rows.slice(1).reduce((s, r) => s + r[4], 0);
console.log('sites', files.length, 'links', tot, 'pointing at original domain', orig, '(' + Math.round(100 * orig / tot) + '%)');
console.table(rows.slice(1).map(r => ({ site: r[0].slice(0, 28), links: r[3], toOrigin: r[4], relative: r[5], inJS: r[10], scripts: r[11], behaviours: r[12], buy: r[13] })));
