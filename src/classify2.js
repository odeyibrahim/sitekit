// classify2: Site Kit's scoring + evidence-gated corrections. Pure function of the feature object, so it runs in node or in the tool.
const NAME_HINTS = {
  nav: /\b(nav|navbar|menu|topbar|site-header|header)\b|navigation/, hero: /hero|jumbotron|masthead|banner|cover|intro|landing/,
  footer: /footer/, contact: /contact|enquir|inquir|get-in-touch|reach/, gallery: /gallery|portfolio|project|work|case|showcase|listing|propert/,
  features: /feature|service|offer|what-we|benefit|about|solution|story|craft|approach/, pricing: /pricing|plan|tier|price/,
  testimonial: /testimonial|review|quote|social-proof|client/, team: /team|people|staff|crew|founder/, stats: /stat|counter|metric|number|figure/,
  faq: /faq|accordion|question/, cta: /\bcta\b|call-to-action|subscribe|newsletter|signup|sign-up/, blog: /blog|news|journal|article|post|insight/
};
function scoreV2(m, ctx) {
  const f = m.features || m.f, s = {}, add = (r, v) => { s[r] = (s[r] || 0) + v; };
  const kind = m.kind, vh = f.vh, isOverlay = kind === 'overlay';
  const heading = f.words <= 30 && f.h < 0.35 * vh && f.headings >= 1 && f.rep < 3;   // a title strip, not a section
  const hasPeriod = /(\/|per\s)\s?(mo|month|yr|year)|\bplans?\b|\btiers?\b|billed/i.test(f.text);
  for (const r in NAME_HINTS) if (NAME_HINTS[r].test(f.name)) {
    if (r === 'hero' && f.h < 0.3 * vh) continue;
    if (r === 'gallery' && !(f.rep >= 3 || f.imgs >= 2 || f.h >= 0.5 * vh)) continue;       // "work" in a heading row is not a gallery
    if (r === 'features' && /about|story/.test(f.name) && f.rep < 3 && !/feature|service|offer|benefit|solution/.test(f.name)) { add('text', 3); continue; }   // about/story prose is text
    add(r, r === 'nav' || r === 'hero' ? 3 : 4);
  }
  if (f.tag === 'footer') add('footer', 6);
  if (f.tag === 'nav') add('nav', 5);
  if (f.tag === 'header' && f.links >= 3 && f.h < 260) add('nav', 3);
  if (f.links >= 3 && f.h < 240 && f.relTop < 0.05) add('nav', 4);
  if (f.fixedTop && f.links >= 3) add('nav', 5);
  if (f.fixedTop && f.links < 3 && f.h < 120) add('nav', 1);
  if (f.relBottom > 0.97 && ctx.index >= ctx.count - 2 && f.words >= 4) { add('footer', 3); if (f.links >= 4) add('footer', 1); }
  if (f.copyright) add('footer', 3);
  if (f.h1) add('hero', f.h < 0.3 * vh ? 1 : 3);
  if (f.relTop < 0.05 && f.h < 0.3 * vh && f.words <= 6 && !f.copyright) add('nav', 2);
  if (f.h >= 0.5 * vh && f.relTop < 0.12 && f.words < 80) add('hero', 2);
  if (f.relTop < 0.1 && f.h >= 0.35 * vh && f.headings >= 1) add('hero', 1);
  if (f.fields >= 2) add('contact', 3);
  if (f.mail) add('contact', 2);
  if (f.rep >= 4 && f.repImg >= f.rep * 0.8) add('gallery', 4);
  if (f.rep >= 3 && f.repImg < f.rep * 0.8 && f.words > 15) add('features', 2);
  if (f.rep >= 3 && f.repSvg >= f.rep * 0.8) add('features', 3);
  if (f.words <= 15 && (f.rasterImgs >= 1 || f.bg >= 1) && f.h >= 0.4 * vh && f.relTop > 0.08 && kind === 'module') add('gallery', f.words === 0 && f.rasterImgs === 0 ? 1 : 2);   // picture-only block; with no <img> at all it may just be a video/background
  if (f.headings >= 3 && f.words > 40 && f.rep >= 2) add('features', 1);                  // v2: headings alone are not a feature grid
  if (/^\s*0?\d{1,2}[.)]?\s+\p{L}/u.test(f.text) && f.words <= 80 && f.h < 1.2 * vh) add('features', 2);
  if (f.price >= 2) {
    if (hasPeriod) add('pricing', 3);                                                       // v2: prices need plan/period words…
    else if (f.rep >= 3) add('gallery', 3);                                                  // …otherwise a priced grid is a product gallery
  }
  if (f.quotes) add('testimonial', 3);
  if (f.quoted && f.words < 250) add('testimonial', 3);
  if (f.saysTestimonial) add('testimonial', 3);
  if (f.shortNums >= 3) add('stats', 4);
  if (f.details >= 3) add('faq', 4);
  if (f.questions >= 3) add('faq', 2);
  if (f.words > 0 && f.words <= 45 && (f.buttons || f.links) && f.headings >= 1 && f.h < 0.9 * vh && f.relTop > 0.1 && !heading) add('cta', 3);
  if (f.words > 0 && f.words <= 8 && f.buttons + f.links >= 1 && f.h < 160 && f.relTop > 0.1 && f.relBottom < 0.97 && kind === 'module') add('cta', 3);
  if (heading) add('section', 3);                                                           // v2: title strips are their own thing
  // v2: overlays. A full-screen or off-canvas layer that isn't a top bar is a popup/menu/loader, whatever it says.
  if (isOverlay) {
    const topBar = f.fixedTop && f.h < 0.35 * vh;
    if (!topBar) add('overlay', 6); else add('overlay', 0);
    if (!topBar) { delete s.nav; delete s.features; delete s.cta; delete s.hero; delete s.footer; }
  }
  if (!Object.keys(s).length && f.words > 40 && f.headings <= 2) add('text', 2);
  return s;
}
function pickV2(s, f) {
  const e = Object.entries(s).sort((a, b) => b[1] - a[1]); let best = 'section', bs = 0, second = 0;
  if (e.length) { best = e[0][0]; bs = e[0][1]; second = e[1] ? e[1][1] : 0; }
  if (bs < 2) { best = f.words > 40 ? 'text' : 'section'; }
  // confidence from strength AND margin over the runner-up (v1 used strength only)
  const conf = Math.max(0.15, Math.min(1, (bs / 6) * (bs ? (0.5 + 0.5 * Math.min(1, (bs - second) / Math.max(2, bs))) : 1)));
  return { role: best, conf, scores: s };
}
function classifyV2(items, pageH) {
  const mods = items; const out = mods.map((m, i) => pickV2(scoreV2(m, { index: i, count: mods.length, pageH }), m.features || m.f));
  const heroes = out.map((o, i) => [o, i]).filter(([o]) => o.role === 'hero');
  if (heroes.length > 1) { const keep = heroes.reduce((a, b) => (b[0].scores.hero > a[0].scores.hero ? b : a));
    heroes.filter(h => h !== keep).forEach(([o, i]) => { const sc = Object.assign({}, o.scores); delete sc.hero; out[i] = pickV2(sc, mods[i].features || mods[i].f); }); }
  return out;
}
// A guess is called "sure" only at or above this confidence. One constant, used by the tool and by the evaluation scripts.
const SURE_AT = 0.8;
if (typeof module !== 'undefined') module.exports = { classifyV2, scoreV2, pickV2, SURE_AT };
