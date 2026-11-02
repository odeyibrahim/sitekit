// Promotes lazy-load attributes to real ones so images exist when the page is measured and extracted.
// Pure, self-contained (it is also injected into the sandboxed frame via toString), works on any Document.
// Returns the number of things it promoted. Things it cannot resolve are left alone (the extractor still flags those).
function unlazy(doc) {
  var n = 0, PH = /^data:image\/(gif|svg\+xml)/;
  var isPlaceholder = function (s) { return !s || (PH.test(s) && s.length < 400) || /^about:blank$/.test(s); };
  var pick = function (el, names) { for (var i = 0; i < names.length; i++) { var v = el.getAttribute(names[i]); if (v && v.trim()) return [names[i], v.trim()]; } return null; };
  var imgs = doc.querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) {
    var im = imgs[i], hit = false;
    var s = pick(im, ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-url']);
    if (s && isPlaceholder(im.getAttribute('src'))) { im.setAttribute('src', s[1]); im.removeAttribute(s[0]); hit = true; }
    var ss = pick(im, ['data-srcset', 'data-lazy-srcset']);
    if (ss) { im.setAttribute('srcset', ss[1]); im.removeAttribute(ss[0]); hit = true; }
    if (hit) { im.removeAttribute('data-sizes'); n++; }
    if (im.getAttribute('loading') === 'lazy' && im.getAttribute('src')) im.setAttribute('loading', 'eager');
    if (im.classList) { im.classList.remove('lazyload', 'lazy', 'lazyloading'); if (hit) im.classList.add('lazyloaded'); }
  }
  var srcs = doc.querySelectorAll('source[data-srcset], source[data-src]');
  for (var j = 0; j < srcs.length; j++) {
    var so = srcs[j], d = so.getAttribute('data-srcset') || so.getAttribute('data-src');
    if (d) { so.setAttribute('srcset', d); so.removeAttribute('data-srcset'); so.removeAttribute('data-src'); n++; }
  }
  var bgs = doc.querySelectorAll('[data-bg], [data-background], [data-background-image]');
  for (var k = 0; k < bgs.length; k++) {
    var b = bgs[k], u = b.getAttribute('data-bg') || b.getAttribute('data-background') || b.getAttribute('data-background-image');
    if (u && !/^\s*(url\(|linear-gradient|radial-gradient)/.test(u)) u = 'url("' + u.replace(/"/g, '%22') + '")';
    if (u && !/background-image\s*:/.test(b.getAttribute('style') || '')) { ['data-bg','data-background','data-background-image'].forEach(function (a) { b.removeAttribute(a); }); b.setAttribute('style', (b.getAttribute('style') || '').replace(/;?\s*$/, ';') + 'background-image:' + u); n++; }
  }
  var vids = doc.querySelectorAll('video[data-src], video source[data-src]');
  for (var m = 0; m < vids.length; m++) { var v = vids[m]; v.setAttribute('src', v.getAttribute('data-src')); v.removeAttribute('data-src'); n++; }
  return n;
}
/* Waits (bounded) for the images in a document to finish loading, so heights are real when we measure. */
function imagesSettled(doc, ms) {
  var list = Array.prototype.filter.call(doc.querySelectorAll('img'), function (i) { return (i.getAttribute('src') || i.getAttribute('srcset')) && !i.complete; });
  if (!list.length) return Promise.resolve(0);
  return new Promise(function (res) {
    var left = list.length, done = function () { if (--left <= 0) { clearTimeout(t); res(list.length); } }, t = setTimeout(function () { res(list.length - left); }, ms || 4000);
    list.forEach(function (i) { i.addEventListener('load', done); i.addEventListener('error', done); });
  });
}
if (typeof module !== 'undefined') module.exports = { unlazy, imagesSettled };
