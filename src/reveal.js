// Text that is invisible only because a script has not faded it in yet (opacity:0 set in CSS, to be animated by GSAP / Webflow / an observer).
// Marks the top-most such elements with data-sk-reveal so the merged document can show them. Things hidden ON PURPOSE are left alone: popups, menus, tooltips,
// aria-hidden content, tab panels and non-current slides. Pure, self-contained, takes a laid-out Document. Returns how many elements it marked.
function markHidden(doc) {
  var win = doc.defaultView, n = 0;
  var PURPOSE = '[aria-hidden="true"],[hidden],dialog,[role="dialog"],[role="menu"],[role="tooltip"],[role="listbox"],[role="tabpanel"],[role="alert"],[class*="modal"],[class*="popup"],[class*="dropdown"],[class*="tooltip"],[class*="lightbox"],[class*="drawer"],[class*="slide"],[class*="swiper"],[class*="carousel"],[class*="tab-"],[class*="tabs"],[class*="cursor"],[class*="preloader"],[class*="loader"],[class*="toast"],[class*="overlay"],[class*="cookie"],[class*="mega"],[class*="submenu"],[class*="sub-menu"]';
  var TEXTY = 'h1,h2,h3,h4,h5,h6,p,blockquote,figcaption,li,span,div,a';
  var els = doc.body ? doc.body.querySelectorAll(TEXTY) : [];
  for (var i = 0; i < els.length; i++) {
    var e = els[i], cs = win.getComputedStyle(e);
    if (+cs.opacity > 0.05 || cs.display === 'none' || cs.position === 'fixed') continue;
    var txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt.length < 8) continue;
    var r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    if (e.closest(PURPOSE) || e.closest('[data-sk-reveal]')) continue;
    var up = e.parentElement, hiddenAbove = false;
    while (up && up !== doc.body) { if (+win.getComputedStyle(up).opacity < 0.05 || win.getComputedStyle(up).display === 'none') { hiddenAbove = true; break; } up = up.parentElement; }
    if (hiddenAbove) continue;                                                              // only the top-most hidden element is marked
    e.setAttribute('data-sk-reveal', ''); n++;
  }
  return n;
}
if (typeof module !== 'undefined') module.exports = { markHidden };
