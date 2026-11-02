// Link resolution for exported pages (Stage 1.3). Pure and DOM-based; also injected into the template.
// ctx = { origin: 'https://site.com' | '', pages: [{ id, file, sourceUrl }], file: 'index.html' (the page being exported), here: '/path' (its source path), ids: Set | null (ids present in the output), rules: { [href]: { action, target } } }
// status: page | anchor | anchor-missing | original | original-kept | external | contact | dead
function linkHost(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } }
function linkPathKey(p) { p = String(p || '/').split('#')[0].split('?')[0]; try { p = decodeURIComponent(p); } catch (e) {} p = p.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '').replace(/\/+$/, ''); return (p || '/').toLowerCase(); }
function guessOrigin(doc) {
  // canonical / og:url / <base> first (reliable); else the most common absolute link host (a guess, flagged as such)
  var pick = function (sel, attr) { var e = doc.querySelector(sel); var v = e && (e.getAttribute(attr) || ''); try { return v ? new URL(v).origin : ''; } catch (x) { return ''; } };
  var o = pick('link[rel="canonical"]', 'href') || pick('meta[property="og:url"]', 'content') || pick('base[href]', 'href');
  if (o && !/^https?:\/\/(localhost|127\.)/.test(o)) return { origin: o, sure: true };
  var count = {}, best = '', n = 0;
  Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) { var h = a.getAttribute('href') || ''; if (!/^https?:\/\//i.test(h)) return; var k = linkHost(h); count[k] = (count[k] || 0) + 1; });
  Object.keys(count).forEach(function (k) { if (count[k] > n) { n = count[k]; best = k; } });
  return { origin: best ? 'https://' + best : '', sure: false };
}
function classifyHref(raw, ctx) {
  var t = String(raw == null ? '' : raw).trim(), rules = ctx.rules || {}, route = /^#!?\//.test(t);
  if (route) { var rp = t.replace(/^#!?/, ''); var rule0 = rules[rp] || rules[t]; t = rp; rules = Object.assign({}, rules, rule0 ? (function () { var o = {}; o[rp] = rule0; return o; })() : {}); }   // single-page-app hash routes (#/about) are page links, not in-page anchors
  var rule = rules[t];
  if (!t || t === '#' || /^javascript:/i.test(t)) return { status: 'dead' };
  if (/^(mailto:|tel:|sms:)/i.test(t)) return { status: 'contact' };
  if (t.charAt(0) === '#') { var id = t.slice(1); try { id = decodeURIComponent(id); } catch (e) {} return { status: !ctx.ids || ctx.ids.has(id) ? 'anchor' : 'anchor-missing' }; }
  var base = (ctx.origin || 'https://unknown.invalid') + (ctx.here || '/'), u;
  try { u = new URL(t, base); } catch (e) { return { status: 'dead' }; }
  if (!/^https?:$/.test(u.protocol)) return { status: 'external' };
  var same = ctx.origin ? linkHost(u.href) === linkHost(ctx.origin) : u.hostname === 'unknown.invalid';
  if (!same) return { status: 'external' };
  var key = linkPathKey(u.pathname), pages = ctx.pages || [], hit = null;
  for (var i = 0; i < pages.length; i++) if (linkPathKey(pages[i].sourceUrl) === key) { hit = pages[i]; break; }
  if (hit) return { status: 'page', href: (hit.file === ctx.file ? '' : hit.file) + (u.hash || (hit.file === ctx.file ? '#' : '')), page: hit.id };
  if (rule) {
    if (rule.action === 'keep') return { status: 'original-kept' };
    if (rule.action === 'page') { var pg = pages.filter(function (p) { return p.id === rule.target; })[0]; if (pg) return { status: 'page', href: (pg.file === ctx.file ? '#' : pg.file), page: pg.id, byRule: true }; }
    if (rule.action === 'anchor' && rule.target) return { status: 'anchor', href: '#' + rule.target, byRule: true };
    if (rule.action === 'remove') return { status: 'dead', href: '#', byRule: true };
  }
  return { status: 'original' };
}
/* Walks every link under root. With rewrite:true it applies the result to the markup; always returns one row per link. */
function resolveLinks(root, ctx, o) {
  var rewrite = !!(o && o.rewrite), rows = [];
  Array.prototype.forEach.call(root.querySelectorAll('a[href], area[href]'), function (a) {
    var raw = a.getAttribute('href'), r = classifyHref(raw, ctx);
    rows.push({ status: r.status, href: raw, to: r.href != null ? r.href : raw, text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), page: r.page || null, byRule: !!r.byRule });
    if (!rewrite) return;
    if (r.href != null) a.setAttribute('href', r.href);
    if (r.status === 'original') a.setAttribute('data-original-link', 'true');
    else if (r.status === 'external' || r.status === 'contact') a.setAttribute('data-external', 'true');
    else if (r.status === 'dead') a.setAttribute('data-sk-dead', 'true');
    else if (r.status === 'anchor-missing') a.setAttribute('data-sk-dead', 'anchor');
  });
  return rows;
}
function summarizeLinks(rows) { var s = { total: rows.length, page: 0, anchor: 0, 'anchor-missing': 0, original: 0, 'original-kept': 0, external: 0, contact: 0, dead: 0 }; rows.forEach(function (r) { s[r.status]++; }); s.unacknowledged = s.original + s['anchor-missing']; return s; }
if (typeof module !== 'undefined') module.exports = { guessOrigin, classifyHref, resolveLinks, summarizeLinks, linkPathKey };
