// Single-page apps: the router (a script) decides which "page" div is shown; with scripts off none is. We switch on the one the router would show first,
// so the copy has real content. Pure, self-contained, takes a Document that has been laid out. Returns how many routes it switched on.
function activateSpa(doc) {
  var win = doc.defaultView, STATES = ['active', 'is-active', 'current', 'is-current', 'show', 'visible', 'open', 'selected'], n = 0, seen = [];
  var shown = function (e) { return win.getComputedStyle(e).display !== 'none'; };
  var all = doc.body ? doc.body.querySelectorAll('*') : [];
  for (var i = 0; i < all.length; i++) {
    var p = all[i], kids = [].filter.call(p.children, function (c) { return c.classList && c.classList.length && !/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(c.tagName); });
    if (kids.length < 3 || seen.indexOf(p) >= 0) continue;
    var count = {}; kids.forEach(function (k) { [].forEach.call(k.classList, function (c) { count[c] = (count[c] || 0) + 1; }); });
    var cls = Object.keys(count).filter(function (c) { return count[c] >= 3; });
    for (var j = 0; j < cls.length; j++) {
      var group = kids.filter(function (k) { return k.classList.contains(cls[j]); });
      if (group.length < 3 || group.some(shown)) continue;                                  // a router group: every page hidden
      if (group.some(function (g) { return [].some.call(g.classList, function (c) { return /(^|[-_])(active|current|selected|open|show|visible|on)$/i.test(c); }); })) continue;   // the saved page already says which route was showing: respect it
      if (!group.every(function (g) { return g.textContent.replace(/\s+/g, ' ').trim().length > 40; })) continue;
      var pref = group.filter(function (g) { return /(^|[-_])(home|index|main|start|landing)([-_]|$)/i.test(g.id || '') || /(^|[-_])(home|index)([-_]|$)/i.test(g.getAttribute('data-page') || g.getAttribute('data-route') || ''); })[0] || group[0];
      for (var k = 0; k < STATES.length; k++) { pref.classList.add(STATES[k]); if (shown(pref)) { n++; seen.push(p); break; } pref.classList.remove(STATES[k]); }
      if (seen.indexOf(p) >= 0) break;
    }
  }
  return n;
}
if (typeof module !== 'undefined') module.exports = { activateSpa };
