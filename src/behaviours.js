// Stage 3: behaviours library. Site scripts are stripped from copies, so menus, accordions, sliders etc. stop working.
// Two halves:  skAnnotate(root)  (runs in the tool; finds widgets by markup heuristics and tags them data-sk-behaviour)
//              skRuntime()       (runs in the exported page; ten small modules, vanilla JS, no dependencies)
// Behind a flag: nothing here runs unless export.behaviours is on.
var SK_BEHAVIOURS = ['menu', 'accordion', 'tabs', 'slider', 'lightbox', 'modal', 'form', 'reveal', 'sticky', 'smooth'];
function skAnnotate(root) {
  var doc = root.ownerDocument || root, found = {}, n = 0;
  var cls = function (e) { return ((e.getAttribute && e.getAttribute('class')) || '') + ' ' + (e.id || ''); };
  var mark = function (e, b, target) { if (!e || e.hasAttribute('data-sk-behaviour')) return false; e.setAttribute('data-sk-behaviour', b); found[b] = (found[b] || 0) + 1;
    if (target) { if (!target.id) target.id = 'skt' + (++n); e.setAttribute('data-sk-target', target.id); target.setAttribute('data-sk-panel', ''); } return true; };
  var all = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
  var visibleLinks = function (e) { return e.querySelectorAll('a[href]').length; };
  // --- menu: a button-ish element named like a hamburger, whose target is the nav list it sits beside
  all('button,[role=button],a,div,span').forEach(function (t) {
    if (t.hasAttribute('data-sk-behaviour') || t.closest('[data-sk-behaviour=accordion],[data-sk-behaviour=tabs],form')) return;
    var name = cls(t) + ' ' + (t.getAttribute('aria-label') || ''), isTog = /burger|hamburger|menu-?(toggle|btn|button|icon|trigger)|nav-?(toggle|btn|button|icon|trigger)|navbar-toggler|mobile-?menu|w-nav-button|toggle-?menu/i.test(name) || (/^(button)$/i.test(t.tagName) && /\bmenu\b/i.test(t.getAttribute('aria-label') || '') && !visibleLinks(t));
    if (!isTog || visibleLinks(t) > 1) return;
    var tg = null, ctl = t.getAttribute('aria-controls'); if (ctl) tg = doc.getElementById(ctl);
    if (!tg) { var scope = t.closest('header,nav,[class*=navbar],[class*=header],[data-skpart]') || t.parentElement; var c = [].slice.call(scope.querySelectorAll('nav,ul,[class*=menu],[class*=nav-]')).filter(function (e) { return e !== t && !e.contains(t) && !t.contains(e) && visibleLinks(e) >= 2; }); tg = c[0] || null; }
    if (tg) mark(t, 'menu', tg);
  });
  // --- accordion: <details> is native; aria-expanded buttons and faq/accordion items need a toggle
  all('[aria-expanded]').forEach(function (b) { if (b.hasAttribute('data-sk-behaviour') || b.closest('[data-sk-behaviour=menu]')) return; var ctl = b.getAttribute('aria-controls'), p = ctl && doc.getElementById(ctl) || b.nextElementSibling; if (p && p !== b && !p.contains(b)) mark(b, 'accordion', p); });
  all('[class*=accordion] > *, [class*=faq] > *').forEach(function (it) { if (it.querySelector('details,[aria-expanded],[data-sk-behaviour]') || it.children.length < 2 || it.matches('details')) return; var hd = it.children[0], p = it.children[1]; if (!/^(a|button|div|h\d|span|summary|dt)$/i.test(hd.tagName) || hd.querySelector('a[href]')) return; mark(hd, 'accordion', p); });
  // --- tabs: role=tab, or Webflow-style tab links with panes in the same order
  all('[role=tablist]').forEach(function (l) { var tabs = [].slice.call(l.querySelectorAll('[role=tab]')); tabs.forEach(function (t) { var p = doc.getElementById(t.getAttribute('aria-controls') || ''); if (p) mark(t, 'tabs', p); }); });
  all('[class*=tabs-menu],[class*=tab-menu],[class*=tab-list],[class*=tabs-nav]').forEach(function (menu) { var wrap = menu.parentElement, panes = wrap && [].slice.call(wrap.querySelectorAll('[class*=tab-pane],[class*=tabs-pane],[class*=tab-content] > *')); var tabs = [].slice.call(menu.children); if (!panes || panes.length < 2 || panes.length !== tabs.length) return; tabs.forEach(function (t, i) { mark(t, 'tabs', panes[i]); }); });
  // --- slider: a container named like one, with 2+ slides
  all('[class*=slider],[class*=carousel],[class*=swiper],[class*=splide],[class*=slick]').forEach(function (c) {
    if (c.hasAttribute('data-sk-behaviour') || c.closest('[data-sk-behaviour=slider]') || /arrow|dot|nav|button|btn|icon|mask-?item/i.test(c.getAttribute('class') || '')) return;
    var best = null; [c].concat([].slice.call(c.querySelectorAll('div,ul'))).forEach(function (e) { if (!best || e.children.length > best.children.length) best = e; });
    if (best && best.children.length >= 2 && [].slice.call(best.children).filter(function (k) { return !/arrow|dot|button|btn/i.test(cls(k)); }).length >= 2) { mark(c, 'slider'); c.setAttribute('data-sk-track', ''); best.setAttribute('data-sk-track-el', ''); }
  });
  // --- lightbox: pictures that link to a bigger picture, or are marked as one
  all('a[href] > img,[data-lightbox] img,[class*=lightbox] img').forEach(function (im) { var a = im.closest('a[href]'), href = a && a.getAttribute('href') || ''; if (a && !/^data:image\//i.test(href) && !/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(href) && !a.closest('[class*=lightbox],[data-lightbox]')) return; mark(a || im, 'lightbox'); });
  // --- modal
  all('[data-bs-toggle=modal],[data-toggle=modal]').forEach(function (o) { var id = (o.getAttribute('data-bs-target') || o.getAttribute('data-target') || o.getAttribute('href') || '').replace(/^#/, ''), m = id && doc.getElementById(id); if (m) mark(o, 'modal', m); });
  all('a[href^="#"]').forEach(function (a) { var id = a.getAttribute('href').slice(1), m = id.length > 1 && doc.getElementById(id); if (m && /modal|popup|dialog|lightbox-?content/i.test(cls(m)) && !a.hasAttribute('data-sk-behaviour')) mark(a, 'modal', m); });
  // --- forms
  all('form').forEach(function (f) { mark(f, 'form'); });
  // --- reveal: elements the original page animated in when scrolled to
  all('[data-aos],[data-w-id],[data-scroll],[data-reveal],.reveal,.fade-in,[class*=animate-on],[class*=fadeIn]').forEach(function (e) { if (!e.closest('[data-sk-behaviour=reveal]') && e.getBoundingClientRect !== undefined) mark(e, 'reveal'); });
  return found;
}
function skRuntime() {
  var d = document, $ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); }, by = function (id) { return id && d.getElementById(id); };
  d.documentElement.classList.add('sk-js');
  var tgt = function (e) { return by(e.getAttribute('data-sk-target')); };
  var setOpen = function (e, on) { if (!e) return; e.toggleAttribute('data-sk-open', on); ['open', 'is-open', 'is-active', 'w--open'].forEach(function (c) { e.classList.toggle(c, on); }); };
  // 1 menu
  $('[data-sk-behaviour=menu]').forEach(function (t) { var m = tgt(t); t.setAttribute('aria-expanded', 'false'); if (!t.hasAttribute('tabindex') && !/^(button|a)$/i.test(t.tagName)) t.tabIndex = 0;
    var go = function (on) { setOpen(m, on); setOpen(t, on); t.setAttribute('aria-expanded', String(on)); };
    t.addEventListener('click', function (e) { e.preventDefault(); go(!t.hasAttribute('data-sk-open')); });
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } if (e.key === 'Escape') go(false); });
    m && m.addEventListener('click', function (e) { if (e.target.closest('a[href]')) go(false); }); });
  // 2 accordion
  $('[data-sk-behaviour=accordion]').forEach(function (t) { var p = tgt(t), open = t.getAttribute('aria-expanded') === 'true' || (p && getComputedStyle(p).display !== 'none' && p.offsetHeight > 0); if (!/^(button|a)$/i.test(t.tagName)) { t.tabIndex = 0; t.setAttribute('role', 'button'); }
    var set = function (on) { setOpen(p, on); setOpen(t, on); t.setAttribute('aria-expanded', String(on)); if (p) p.hidden = !on; };
    set(!!open); t.addEventListener('click', function (e) { e.preventDefault(); set(!t.hasAttribute('data-sk-open')); }); t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } }); });
  // 3 tabs
  var groups = []; $('[data-sk-behaviour=tabs]').forEach(function (t) { var g = groups.filter(function (x) { return x.p === t.parentElement; })[0]; if (!g) groups.push(g = { p: t.parentElement, tabs: [] }); g.tabs.push(t); });
  groups.forEach(function (g) { var show = function (t) { g.tabs.forEach(function (x) { var on = x === t, p = tgt(x); setOpen(x, on); x.setAttribute('aria-selected', String(on)); if (p) { p.hidden = !on; p.style.display = on ? 'block' : 'none'; setOpen(p, on); } }); };
    g.tabs.forEach(function (t) { t.addEventListener('click', function (e) { e.preventDefault(); show(t); }); }); show(g.tabs.filter(function (t) { return t.classList.contains('w--current') || t.getAttribute('aria-selected') === 'true'; })[0] || g.tabs[0]); });
  // 4 slider (scroll-snap track with arrows and keys; no autoplay)
  $('[data-sk-behaviour=slider]').forEach(function (c) { var tr = c.querySelector('[data-sk-track-el]') || c;
    if ([].some.call(tr.children, function (s) { return /absolute|fixed/.test(getComputedStyle(s).position); })) return;      // layered / stacked sliders are left exactly as they are
    tr.style.overflowX = 'auto'; tr.style.scrollSnapType = 'x mandatory'; tr.style.scrollbarWidth = 'none'; tr.style.transform = 'none'; tr.style.display = tr.style.display || 'flex';
    [].slice.call(tr.children).forEach(function (s) { s.style.scrollSnapAlign = 'start'; s.style.flex = s.style.flex || '0 0 100%'; s.style.position = s.style.position || 'relative'; s.style.transform = 'none'; s.style.left = 'auto'; });
    var step = function (dir) { tr.scrollBy({ left: dir * tr.clientWidth, behavior: 'smooth' }); }; c.style.position = c.style.position || 'relative';
    [['Previous', -1, 'left:8px', '‹'], ['Next', 1, 'right:8px', '›']].forEach(function (a) { var b = d.createElement('button'); b.type = 'button'; b.className = 'sk-arrow'; b.setAttribute('aria-label', a[0] + ' slide'); b.style.cssText = 'position:absolute;top:50%;' + a[2] + ';transform:translateY(-50%);z-index:5;width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:24px;cursor:pointer'; b.textContent = a[3]; b.addEventListener('click', function () { step(a[1]); }); c.appendChild(b); });
    c.tabIndex = 0; c.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }); });
  // 5 lightbox
  var lb = null, closeLb = function () { lb && lb.classList.remove('sk-on'); };
  $('[data-sk-behaviour=lightbox]').forEach(function (e) { e.style.cursor = 'zoom-in'; e.addEventListener('click', function (ev) { var im = e.matches('img') ? e : e.querySelector('img'); if (!im) return; ev.preventDefault();
    if (!lb) { lb = d.createElement('div'); lb.className = 'sk-lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.innerHTML = '<button type="button" aria-label="Close">×</button><img alt="">'; d.body.appendChild(lb); lb.addEventListener('click', closeLb); }
    var a = e.closest('a[href]'), href = a && /^data:image\/|\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(a.getAttribute('href') || '') ? a.href : '', i = lb.querySelector('img'); i.src = href || im.currentSrc || im.src; i.alt = im.alt || ''; lb.classList.add('sk-on'); lb.querySelector('button').focus(); }); });
  // 6 modal
  var shut = function (m) { if (m) { m.removeAttribute('data-sk-open'); m.hidden = true; m.style.display = 'none'; ['show', 'open', 'is-open'].forEach(function (c) { m.classList.remove(c); }); } };
  $('[data-sk-behaviour=modal]').forEach(function (o) { var m = tgt(o); if (!m) return; o.addEventListener('click', function (e) { e.preventDefault(); m.hidden = false; m.style.display = 'block'; m.setAttribute('data-sk-open', ''); m.classList.add('show', 'open'); var c = m.querySelector('[data-bs-dismiss],[data-dismiss],[class*=close],button'); c && c.focus(); });
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-bs-dismiss],[data-dismiss],[class*=close]')) shut(m); }); });
  // 7 form validation (no backend here: valid forms with no real action show a notice instead of navigating away)
  $('form[data-sk-behaviour=form]').forEach(function (f) { f.noValidate = true; var note = d.createElement('div'); note.className = 'sk-formnote'; note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite'); f.appendChild(note);
    f.addEventListener('submit', function (e) { var bad = $('input,select,textarea', f).filter(function (x) { x.classList.remove('sk-invalid'); return x.type !== 'hidden' && x.type !== 'submit' && !x.disabled && !x.checkValidity(); });
      bad.forEach(function (x) { x.classList.add('sk-invalid'); x.setAttribute('aria-invalid', 'true'); });
      if (bad.length) { e.preventDefault(); note.className = 'sk-formnote sk-bad'; note.textContent = 'Please fix ' + bad.length + ' field' + (bad.length > 1 ? 's' : '') + ' before sending.'; bad[0].focus(); return; }
      var act = (f.getAttribute('action') || '').trim(); if (!act || act === '#' || /^javascript:/i.test(act)) { e.preventDefault(); note.className = 'sk-formnote sk-ok'; note.textContent = 'Thanks, your message looks complete. (This copy has no form handler connected yet.)'; } }); });
  // 8 reveal on scroll
  var rv = $('[data-sk-behaviour=reveal]'); if ('IntersectionObserver' in window && rv.length) { var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('sk-in'); io.unobserve(x.target); } }); }, { threshold: 0.12 }); rv.forEach(function (e) { if (e.getBoundingClientRect().top > innerHeight) { e.classList.add('sk-pre'); io.observe(e); } }); }
  // 9 sticky header: shadow once scrolled (only for headers that are fixed or sticky)
  var hd = $('header,nav,[class*=navbar],[class*=header]').filter(function (e) { var p = getComputedStyle(e).position; return p === 'fixed' || p === 'sticky'; }), st = function () { var on = scrollY > 8; hd.forEach(function (e) { e.classList.toggle('sk-stuck', on); }); };
  if (hd.length) { addEventListener('scroll', st, { passive: true }); st(); }
  // 10 smooth scroll for in-page links, leaving room for a fixed header
  d.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || a.hasAttribute('data-sk-behaviour')) return; var id = decodeURIComponent(a.getAttribute('href').slice(1)); if (id.length < 1 || id.charAt(0) === '/') return; var t = by(id); if (!t) return; e.preventDefault(); var off = hd.length ? hd[0].getBoundingClientRect().height : 0; scrollTo({ top: t.getBoundingClientRect().top + scrollY - off, behavior: 'smooth' }); history.replaceState(null, '', '#' + id); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeLb(); $('[data-sk-behaviour=modal]').forEach(function (o) { shut(tgt(o)); }); } });
}
var SK_BEHAVIOUR_CSS = '[data-sk-behaviour=menu][data-sk-open],[data-sk-behaviour=menu]{cursor:pointer}[data-sk-panel][data-sk-open]:not([data-sk-behaviour]){display:block!important;visibility:visible!important;opacity:1!important;height:auto!important;max-height:none!important}' +
  '[data-sk-behaviour=accordion]{cursor:pointer}[hidden]{display:none!important}' +
  '.sk-js [data-sk-behaviour=reveal].sk-pre:not(.sk-in){opacity:0!important;transform:translateY(24px)!important}.sk-js [data-sk-behaviour=reveal].sk-pre{transition:opacity .7s ease,transform .7s ease!important}.sk-js [data-sk-behaviour=reveal].sk-in{opacity:1!important;transform:none!important}' +
  '.sk-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;z-index:2147483000}.sk-lightbox.sk-on{display:flex}.sk-lightbox img{max-width:92vw;max-height:90vh;object-fit:contain}.sk-lightbox button{position:absolute;top:14px;right:18px;background:none;border:0;color:#fff;font-size:34px;cursor:pointer}' +
  '.sk-formnote{margin-top:10px;font:14px/1.4 system-ui,sans-serif}.sk-formnote.sk-bad{color:#b00020}.sk-formnote.sk-ok{color:#1b7f3b}.sk-invalid{outline:2px solid #b00020!important}.sk-stuck{box-shadow:0 2px 14px rgba(0,0,0,.18)}html{scroll-behavior:smooth}';
if (typeof module !== 'undefined') module.exports = { skAnnotate, skRuntime, SK_BEHAVIOUR_CSS, SK_BEHAVIOURS };
