// makeExtractor(doc, win): render-based part extractor. It runs on Site Kit's OWN segments (same part boundaries and numbering),
// so a part here is the same part there. Self-contained on purpose: it is also injected as text into sandboxed script frames.
//   ex.flatten()              -> the page's CSS, flattened once per site
//   ex.build(seg, id, G)      -> { html, css, tokens, slots, motion, risks, sample, stats }   for seg = { roots:[el], chain:[el], kind }
function makeExtractor(doc, win) {
  const cs = e => win.getComputedStyle(e);
  // one canonical form per colour, so "#2a7fff", "rgb(42, 127, 255)" and "rgba(42,127,255,1)" are recognised as the same colour (a dial must reach every spelling of it)
  const famKey = s => String(s).split(',').map(x => x.trim().replace(/^["']|["']$/g, '').toLowerCase()).join(',');
  let cv = null; try { cv = doc.createElement('canvas').getContext('2d'); } catch (e) {}
  const canonCache = new Map();
  const canon = c => { if (canonCache.has(c)) return canonCache.get(c); let r = c; if (cv) { try { cv.fillStyle = '#000000'; cv.fillStyle = c; const f = cv.fillStyle; r = f[0] === '#' ? [1, 3, 5].map(i => parseInt(f.substr(i, 2), 16)).join(',') + ',1' : (f.match(/[\d.]+/g) || []).slice(0, 4).join(','); if (r.split(',').length === 3) r += ',1'; } catch (e) {} } canonCache.set(c, r); return r; };
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META)$/;
  /* ---- 1. flatten the CSSOM once ---- */
  function flatten() {
    const rules = [], faces = [], keyframes = {}, props = []; let invalid = 0;
    const walk = (list, ctx) => { for (const r of list) {
      if (r.type === 1) rules.push({ sel: r.selectorText, decl: r.style.cssText, ctx });
      else if (r.type === 5) faces.push(r);
      else if (r.type === 7) keyframes[r.name] = r;
      else if (r.constructor.name === 'CSSPropertyRule') props.push(r);
      else if (r.cssRules && (r.type === 4 || r.type === 12 || r.constructor.name.match(/Media|Supports|Container|Layer/))) walk(r.cssRules, ctx.concat(r.cssText.slice(0, r.cssText.indexOf('{')).trim()));
    } };
    for (const sh of doc.styleSheets) { try { walk(sh.cssRules, []); } catch (e) { invalid++; } }
    return { rules, faces, keyframes, props, blocked: invalid };
  }
  const splitSel = s => { const o = []; let d = 0, c = '', q = ''; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '\\') { c += ch + (s[i + 1] || ''); i++; continue; } if (q) { if (ch === q) q = ''; c += ch; continue; } if (ch === '"' || ch === "'") { q = ch; c += ch; continue; } if ('(['.includes(ch)) d++; if (')]'.includes(ch)) d--; if (ch === ',' && !d) { o.push(c.trim()); c = ''; } else c += ch; } if (c.trim()) o.push(c.trim()); return o; };
  const DYN = /(?<!\\)::?[\w-]+(\([^)]*\))?/g, KEEP_PSEUDO = /^:(is|not|where|has|nth-[\w-]+|first-child|last-child|only-child|first-of-type|last-of-type|root|empty|checked|disabled|enabled|lang|dir)$/;
  const baseOf = sel => { let s = sel.replace(DYN, (m, _, off) => KEEP_PSEUDO.test(m.replace(/\(.*$/, '')) ? m : ''); s = s.trim(); return (!s || /[>+~]$/.test(s)) ? s + '*' : s; };
  /* ---- 2. scoping ---- */
  function scopeSel(sel, id, rootCls) {
    let s = sel.replace(/(^|[\s>+~(,])(html|body|:root)(?![\w-])/g, '$1#' + id).replace(/(#sk-\d+)(\s*[>+~]?\s*)#sk-\d+/g, '$1');
    if (/^\s*\*/.test(s) || /^#sk-\d+$/.test(s.trim())) s = s.replace(/^\s*\*/, '#' + id + ' *');
    if (s.includes('#' + id)) return s;
    // classes that lived on <html>/<body> now sit on the scope root, so `.w-mod-js .x` must also match as `#sk.w-mod-js .x`
    const lead = (s.trim().match(/^((?:\.[\w-]+)+)/) || [])[1];
    const same = lead && lead.slice(1).split('.').every(c => rootCls.has(c)) ? ',#' + id + s.trim() : '';
    return '#' + id + ' ' + s + same;
  }
  const wrapCtx = (ctx, body) => ctx.reduceRight((acc, c) => c + '{' + acc + '}', body);
  const fam = s => s.split(',').map(x => x.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const firstFam = s => s.split(',')[0].trim().replace(/^["']|["']$/g, '');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* ---- 3. one part -> html + its own css ---- */
  function build(seg, n, G) {
    const id = 'sk-' + n, roots = seg.roots, root = roots[0], chain = seg.chain, anc = chain.concat(doc.body, doc.documentElement);
    const open = e => { const o = e.cloneNode(false).outerHTML; return o.slice(0, o.length - ('</' + e.localName + '>').length); };
    roots.forEach(r => r.setAttribute('data-skpart', ''));
    const body = chain.map(open).join('') + roots.map(r => r.outerHTML).join('\n') + chain.slice().reverse().map(e => '</' + e.localName + '>').join('');
    roots.forEach(r => r.removeAttribute('data-skpart'));
    const rootCls = new Set((doc.documentElement.className + ' ' + doc.body.className).split(/\s+/).filter(Boolean));
    const m = new Map(); const test = sel => { if (m.has(sel)) return m.get(sel); let r = 0; try { const b = baseOf(sel); r = roots.some(x => x.matches(b) || x.querySelector(b)) ? 1 : (anc.some(a => a.matches(b)) ? 2 : 0); } catch (e) { r = -1; } m.set(sel, r); return r; };
    const stats = { rulesKept: 0, rulesTotal: G.rules.length, invalidSel: 0, media: 0 }; let keptText = '';
    const seq = [];
    for (const r of G.rules) {
      const sels = splitSel(r.sel).filter(s => { const t = test(s); if (t === -1) stats.invalidSel++; return t > 0; });
      if (!sels.length) continue;
      stats.rulesKept++; if (r.ctx.some(c => /^@media/.test(c))) stats.media++;
      let decl = r.decl;
      // rem is relative to <html>, which a scoped part doesn't have: carry html's font-size as --sk-rem
      if (splitSel(r.sel).some(x => /^(html|:root)$/.test(x.trim())) && /(^|;)\s*font-size\s*:/.test(decl)) { const v = (decl.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/) || [])[1]; if (v) { const fix = x => x.replace(/(-?\d*\.?\d+)rem\b/g, 'calc($1 * 16px)'); decl = decl.replace(/((?:^|;)\s*font-size\s*:\s*)([^;]+)/, (m, a, b) => a + fix(b)); decl += ' --sk-rem: ' + (/%\s*$/.test(v) ? 'calc(16px * ' + parseFloat(v) / 100 + ')' : fix(v.replace(/\s*!important/, ''))) + ';'; } }
      const key = r.ctx.join('\u0001'), last = seq[seq.length - 1];
      const piece = sels.map(s => scopeSel(s, id, rootCls)).join(',') + '{' + decl + '}\n';
      if (last && last.key === key) last.txt += piece; else seq.push({ key, ctx: r.ctx, txt: piece });
      keptText += r.decl + ' ';
    }
    // elements of this part, in document order; the same order is used again when the copy is checked against the original
    const els = roots.flatMap(r => [r, ...r.querySelectorAll('*')]);
    const fams = new Set();
    els.slice(0, 4000).concat(chain).forEach(e => fam(cs(e).fontFamily).forEach(f => fams.add(f)));
    const faces = G.faces.filter(f => fams.has(fam(f.style.getPropertyValue('font-family'))[0]));
    const anims = [...(keptText.match(/animation[^:;]*:[^;]+/g) || [])].join(' ');
    const kfNames = Object.keys(G.keyframes).filter(k => new RegExp('(^|[\\s,:])' + esc(k) + '(?=[\\s,;]|$)').test(anims));
    let css = '#' + id + '{--sk-rem:16px}\n' + seq.map(g => wrapCtx(g.ctx, g.txt)).join('\n');
    css = css.replace(/\{[^{}]*\}/g, b => b.replace(/(-?\d*\.?\d+)rem\b/g, 'calc($1 * var(--sk-rem))'));
    // rename keyframes so parts from different sites can't collide
    const kfCss = kfNames.map(k => G.keyframes[k].cssText.replace(k, id + '_' + k)).join('\n');
    kfNames.forEach(k => { css = css.replace(/animation[^:;{}]*:[^;}]+/g, d => d.replace(new RegExp('(^|[\\s,:])' + esc(k) + '(?=[\\s,;]|$)', 'g'), '$1' + id + '_' + k)); });
    const usedVars = new Set((css.match(/var\(--[\w-]+/g) || []).map(v => v.slice(4)));
    const faceCss = faces.map(f => f.cssText).join('\n') + '\n' + G.props.filter(p => usedVars.has(p.name)).map(p => p.cssText).join('\n');
    const vars = new Set((css.match(/var\(--[\w-]+/g) || []).map(v => v.slice(4))); const defd = new Set((css.match(/--[\w-]+(?=\s*:)/g) || []).concat(G.props.map(p => p.name), ['--sk-rem']));
    const unresolved = [...vars].filter(v => !defd.has(v));
    const T = tokenize(css, els, chain);
    const slots = findSlots(roots, els);
    const all = sel => roots.flatMap(r => [...r.querySelectorAll(sel)]);
    const motion = { dataW: all('[data-w-id]').length + roots.filter(r => r.hasAttribute('data-w-id')).length, aos: all('[data-aos]').length, scrollAttr: all('[data-scroll],[data-speed],[data-lag]').length,
      keyframes: kfNames, transitions: (css.match(/transition(-property)?\s*:/g) || []).length, animationDecls: (anims.match(/animation/g) || []).length, lottie: all('[data-animation-type="lottie"],lottie-player').length,
      slider: all('.swiper,.swiper-container,[class*="slick-slider"],[class*="carousel"],[class*="splide"]').length, video: all('video').length };
    const bcs = cs(doc.body), hcs = cs(doc.documentElement);
    const bg = [bcs.backgroundColor, hcs.backgroundColor].find(c => c && c !== 'rgba(0, 0, 0, 0)') || '#fff';
    const scopeCls = (doc.documentElement.className + ' ' + doc.body.className).trim();
    const inlineVars = [doc.documentElement, doc.body].map(e => [...e.style].filter(n => n.startsWith('--')).map(n => n + ':' + e.style.getPropertyValue(n)).join(';')).join(';');
    const html = '<div id="' + id + '" class="' + scopeCls + '" style="margin:' + bcs.margin + ';' + inlineVars.replace(/"/g, '&quot;') + '">' + body + '</div>';
    const rects = roots.map(r => r.getBoundingClientRect()), base = { left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)) };
    // geometry sample: where every element sat, relative to the part's own top-left. The copy is later compared against this.
    const countable = els.filter(e => !SKIP.test(e.tagName) && !e.closest('noscript,template'));
    // elements that are (or sit inside something) transformed or mid-animation are marked: their boxes are not stable, so they are not compared
    const tfMap = new Map(), inPart = e => roots.some(r => r.contains(e));
    const tf = e => { if (tfMap.has(e)) return tfMap.get(e); const t = cs(e).transform, p = e.parentElement; const v = (t && t !== 'none') || (p && inPart(p) && tf(p)); tfMap.set(e, !!v); return !!v; };
    const sample = countable.slice(0, 600).map(e => { const r = e.getBoundingClientRect(), s = cs(e); return [Math.round(r.left - base.left), Math.round(r.top - base.top), Math.round(r.width), Math.round(r.height), s.color, s.backgroundColor, s.fontSize, tf(e) ? 1 : 0]; });
    return { id, tag: root.localName, cls: (root.getAttribute('class') || '').slice(0, 60), html, css: T.css, keyframes: kfCss, fontFaces: faceCss, pageBg: bg,
      tokens: T.tokens, slots, motion, risks: risksOf(roots, els, seg, countable), sample, nEls: countable.length, height: Math.round(base.bottom - base.top),
      stats: Object.assign(stats, { cssBytes: T.css.length, fontFaces: faces.length, keyframes: kfNames.length, unresolvedVars: unresolved, tokenCoverage: T.coverage, swappable: T.swappable, fontCoverage: T.fontCoverage,
        fontDecls: T.fontDecls, fontWired: T.fontWired, fontShort: T.fontShort, fontHard: T.fontHard, htmlBytes: html.length }) };
  }
  /* ---- 4. things that stop a standalone copy from matching the original. Each one is a reason to call the part "approximate" ---- */
  function risksOf(roots, els, seg, countable) {
    const out = [], cap = els.slice(0, 3000);
    if (seg.kind === 'overlay') out.push('Popup or fixed layer: it is pinned to the screen, so the copy was not compared pixel for pixel');
    const sizeOf = e => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const fixed = cap.filter(e => !roots.includes(e) && cs(e).position === 'fixed' && sizeOf(e) > 1);
    if (fixed.length) out.push('Contains a fixed layer (' + fixed.length + '), such as a pinned menu or a background video, that will not stay put outside its page');
    let p = roots[0].parentElement, fixedAnc = false;
    while (p && !fixedAnc) { if (cs(p).position === 'fixed') fixedAnc = true; p = p.parentElement; }
    if (fixedAnc) out.push('Sits inside a fixed layer on the original page, so its position is not its own');
    const lazy = cap.filter(e => e.localName === 'img' && (e.hasAttribute('data-src') || e.hasAttribute('data-lazy-src') || e.hasAttribute('data-original') || e.hasAttribute('data-srcset') || (e.getAttribute('loading') === 'lazy' && (!e.getAttribute('src') || /^data:image\/(gif|svg)/.test(e.getAttribute('src') || '') && e.getAttribute('src').length < 400))));
    if (lazy.length) out.push('Images that load later (' + lazy.length + '), so the copy may show blanks where they go');
    const media = cap.filter(e => /^(video|iframe|canvas|object|embed)$/.test(e.localName));
    if (media.length) out.push('Video, embed or canvas content (' + media.length + ') that a copy cannot play');
    return out;
  }
  /* ---- 5. tokens: turn literal colours/fonts into swappable variables ---- */
  function tokenize(css, els, chain) {
    const masks = []; let work = css.replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/g, m => { masks.push(m); return '\u0002' + (masks.length - 1) + '\u0003'; });
    const re = /rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g, freq = new Map();
    for (const b of work.match(/\{[^{}]*\}/g) || []) for (const c of b.match(re) || []) freq.set(c, (freq.get(c) || 0) + 1);
    const textW = new Map(), bgW = new Map();
    for (const e of els.slice(0, 3000)) { const s = cs(e), r = e.getBoundingClientRect(); const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join('').length;
      if (own) textW.set(s.color, (textW.get(s.color) || 0) + own); if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bgW.set(s.backgroundColor, (bgW.get(s.backgroundColor) || 0) + r.width * r.height); }
    const top = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0]; const names = new Map(), disp = new Map(); const t = top(textW), g = top(bgW);
    const nameIt = (c, n) => { const k0 = canon(c); names.set(k0, n); if (!disp.has(k0)) disp.set(k0, c); };
    if (g) nameIt(g[0], 'sk-bg'); if (t) nameIt(t[0], 'sk-text');
    const sat = c => { const m = canon(c).split(',');  if (!m || m.length < 3) return 0; const [r, g2, b] = m.slice(0, 3).map(Number), mx = Math.max(r, g2, b), mn = Math.min(r, g2, b); return mx ? (mx - mn) / mx : 0; };
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]); let k = 1;
    const accent = ranked.find(c => !names.has(canon(c)) && sat(c) > 0.35 && +canon(c).split(',')[3] > 0.5); if (accent) nameIt(accent, 'sk-accent');
    for (const c of ranked) { if (names.size >= 8) break; if (!names.has(canon(c))) nameIt(c, 'sk-c' + k++); }
    let total = 0, tokd = 0;
    work = work.replace(/\{[^{}]*\}/g, b => b.replace(re, c => { total++; if (names.has(canon(c))) { tokd++; return 'var(--' + names.get(canon(c)) + ',' + c + ')'; } return c; }));
    // fonts
    const hd = els.find(e => /^H[1-3]$/.test(e.tagName)), pp = els.find(e => e.tagName === 'P') || els.find(e => cs(e).fontFamily);
    const fd = hd && cs(hd).fontFamily, fb = pp && cs(pp).fontFamily; let fTotal = 0, fTok = 0;
    const fvars = new Set(), hard = new Set();
    work = work.replace(/font-family\s*:\s*([^;}]+)/g, (m, v) => { fTotal++; const vv = v.trim(); const vm = vv.match(/^var\((--[\w-]+)/); if (vm) { fTok++; fvars.add(vm[1]); return m; } if (fd && famKey(vv) === famKey(fd)) { fTok++; return 'font-family: var(--sk-font-display, ' + vv + ')'; } if (fb && famKey(vv) === famKey(fb)) { fTok++; return 'font-family: var(--sk-font-body, ' + vv + ')'; }
      const f1 = firstFam(vv); if (!/^(inherit|initial|unset|revert)$/i.test(f1)) hard.add(f1); return m; });
    // the `font:` shorthand carries a family too. It can't be swapped through a variable yet, so it counts as NOT wired (it used to be invisible here)
    let fShort = 0;
    for (const mm of work.matchAll(/(?:^|[;{\s])font\s*:\s*([^;}]+)/g)) {
      const fm = mm[1].replace(/!important/, '').trim().match(/\d[\w.%]*(?:\/[\w.%]+)?\s+(.+)$/); if (!fm) continue;
      fTotal++; fShort++; if (/var\(/.test(fm[1])) fTok++; else { const f1 = firstFam(fm[1]); if (!/^(inherit|initial|unset|revert)$/i.test(f1)) hard.add(f1); }
    }
    const radii = {}; els.slice(0, 2000).forEach(e => { const v = cs(e).borderTopLeftRadius; if (v !== '0px') radii[v] = (radii[v] || 0) + 1; });
    const sizes = {}; els.slice(0, 2000).forEach(e => { if ([...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) { const v = cs(e).fontSize; sizes[v] = (sizes[v] || 0) + 1; } });
    const topN = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
    const css2 = work.replace(/\u0002(\d+)\u0003/g, (m, i) => masks[+i]);
    const tokens = { colors: Object.fromEntries([...names.entries()].map(([c, n]) => [n, disp.get(c)])), fonts: { display: fd || null, body: fb || null, vars: [...fvars] }, radii: topN(radii, 3), sizes: topN(sizes, 5), headingSize: hd ? cs(hd).fontSize : null, bodySize: pp ? cs(pp).fontSize : null };
    const colorVars = {}; let swap = 0, hardC = 0;
    for (const b of css2.match(/\{[^{}]*\}/g) || []) {
      for (const m of b.matchAll(/(--[\w-]+)\s*:\s*(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}\b)/g)) colorVars[m[1]] = m[2];
      for (const m of b.matchAll(/(?:^|[;{\s])(color|background(?:-color|-image)?|border(?:-[a-z]+)?(?:-color)?|fill|stroke|outline(?:-color)?|text-decoration-color|caret-color)\s*:\s*([^;}]+)/g)) { const v = m[2]; if (/var\(--/.test(v)) swap++; else if (/rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/.test(v)) hardC++; }
    }
    tokens.colorVars = colorVars;
    return { css: css2, tokens, swappable: swap + hardC ? swap / (swap + hardC) : 1, coverage: total ? tokd / total : 1, fontCoverage: fTotal ? fTok / fTotal : 1, fontDecls: fTotal, fontWired: fTok, fontShort: fShort, fontHard: [...hard].slice(0, 8), colorLiterals: total };
  }
  /* ---- 6. slots: the editable fields ---- */
  function findSlots(roots, els) {
    const txt = e => (e.textContent || '').replace(/\s+/g, ' ').trim();
    const all = sel => roots.flatMap(r => [...r.querySelectorAll(sel)]);
    const heads = all('h1,h2,h3,h4').map(txt).filter(Boolean).slice(0, 4).map(t => t.slice(0, 160));
    // stable positions: where each editable element sits among ALL elements of its kind in the part, in document order.
    // Edits address elements by these positions (never by matching their text), so identical wording in several places is no problem.
    const ords = (list, keep) => { const o = []; list.forEach((e, i) => { if (keep(e)) o.push(i); }); return o; };
    const headEls = all('h1,h2,h3,h4'), paraEls = all('p'), linkEls = all('a[href],button'), imgEls = all('img');
    const headOrd = ords(headEls, e => txt(e)).slice(0, 12), paraOrd = ords(paraEls, e => txt(e)).slice(0, 12);
    const paras = all('p').map(txt).filter(Boolean);
    const btns = all('a[href],button').filter(a => { const t = txt(a); return t && t.length <= 28 && (/btn|button|cta/i.test(a.className) || a.tagName === 'BUTTON' || cs(a).backgroundColor !== 'rgba(0, 0, 0, 0)'); }).slice(0, 4).map(a => ({ label: txt(a), href: a.getAttribute('href') || null, ord: linkEls.indexOf(a) }));
    let rep = 0, repEl = null, repKey = null;
    for (const p of els.slice(0, 1500)) { const kids = [...p.children]; if (kids.length >= 3) { const g = {}; const key = c => c.localName + '.' + (c.className + '').split(' ')[0]; kids.forEach(c => { const k = key(c); g[k] = (g[k] || 0) + 1; }); const mx = Math.max(...Object.values(g)); if (mx > rep) { rep = mx; repEl = p; repKey = Object.keys(g).find(k => g[k] === mx); } } }
    // where a path of child positions leads from a part's root to an element (used later to find it again in the copy)
    const pathOf = el => { const a = []; let n = el; while (n && !roots.includes(n)) { const p = n.parentElement; if (!p) return null; a.unshift([...p.children].indexOf(n)); n = p; } return n ? [roots.indexOf(n), ...a] : null; };
    let cardInfo = null;
    if (repEl && rep >= 3 && rep <= 24) { const key = c => c.localName + '.' + (c.className + '').split(' ')[0], kids = [...repEl.children], idx = kids.map((c, k) => key(c) === repKey ? k : -1).filter(k => k >= 0), path = pathOf(repEl);
      if (path && idx.length === rep) cardInfo = { path, idx, labels: idx.map(k => { const w = doc.createTreeWalker(kids[k], 4), parts = []; let n; while ((n = w.nextNode())) { const v = n.nodeValue.replace(/\s+/g, ' ').trim(); if (v && !/^(STYLE|SCRIPT|NOSCRIPT)$/.test(n.parentNode.nodeName)) parts.push(v); } return parts.join(' ').slice(0, 48) || '(picture)'; }) }; }
    // the biggest background picture or gradient (flat colours are the Background dial's job)
    let bgLayer = null, bgArea = 0;
    for (const e of els.slice(0, 800)) { const bi = cs(e).backgroundImage; if (!bi || bi === 'none') continue; const r = e.getBoundingClientRect(), a = r.width * r.height; if (a <= bgArea || a < 4000) continue; const p = pathOf(e); if (!p) continue;
      const kind = /gradient/.test(bi) ? 'gradient' : /url\(/.test(bi) ? 'image' : null; if (!kind) continue; bgArea = a; bgLayer = { kind, path: p, colors: (bi.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g) || []).slice(0, 4), angle: +((bi.match(/(-?\d+(?:\.\d+)?)deg/) || [])[1] || 180), src: kind === 'image' ? ((bi.match(/url\(["']?([^"')]+)/) || [])[1] || null) : null }; }
    const imgs = all('img'), firstImg = imgs.find(i => (i.getAttribute('src') || '') && !/^data:image\/(gif|svg)/.test(i.getAttribute('src')) && !i.hasAttribute('data-src'));
    const okSrc = i => (i.getAttribute('src') || '') && !/^data:image\/(gif|svg)/.test(i.getAttribute('src')) && !i.hasAttribute('data-src');
    return { headAll: all('h1,h2,h3,h4').map(txt).filter(Boolean).slice(0, 12).map(t => t.slice(0, 2000)), paraAll: paras.slice(0, 12).map(t => t.slice(0, 4000)), imgAll: imgs.filter(okSrc).slice(0, 12).map(i => i.getAttribute('src')), imgOrd: imgs.map((i, k) => okSrc(i) ? k : -1).filter(k => k >= 0).slice(0, 12), headOrd, paraOrd, cardInfo, bgLayer, headFull: (all('h1,h2,h3,h4').map(txt).filter(Boolean)[0] || '').slice(0, 2000), paragraphFull: (paras[0] || '').slice(0, 4000), imageSrc: firstImg ? firstImg.getAttribute('src') : null, headings: heads, paragraphs: all('p').length, paragraphFirst: (paras[0] || '').slice(0, 160), buttons: btns, images: all('img,picture').length, svgs: all('svg').length,
      bgImages: els.slice(0, 800).filter(e => /url\(/.test(cs(e).backgroundImage)).length, cards: rep, forms: all('form,input,textarea').length };
  }
  return { flatten, build };
}
if (typeof module !== 'undefined') module.exports = { makeExtractor };
