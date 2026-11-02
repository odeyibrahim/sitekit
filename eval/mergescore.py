# Scores eval/merge/<site>/{plain,doc,docbeh}.png against live.png: blurred, tolerant pixel match, plus height ratio.  Usage: python3 eval/mergescore.py
import json, os, sys, csv, statistics as st
import numpy as np
from PIL import Image, ImageFilter
D = os.path.join(os.path.dirname(__file__), 'merge'); shots = json.load(open(os.path.join(D, 'shots.json')))
W = 360; TOL = 28
def load(p, H):
    im = Image.open(p).convert('RGB'); s = W / im.width; im = im.resize((W, max(1, round(im.height * s))), Image.BILINEAR).filter(ImageFilter.GaussianBlur(2))
    a = np.asarray(im, dtype=np.int16); out = np.full((H, W, 3), -999, dtype=np.int16); h = min(H, a.shape[0]); out[:h] = a[:h]; return out
rows = [['site', 'parts', 'live_h', 'variant', 'h', 'height_ratio', 'match_pct', 'note']]
for site, r in sorted(shots.items()):
    d = os.path.join(D, site[:-5]); lp = os.path.join(d, 'live.png')
    if not os.path.exists(lp): rows.append([site, r.get('parts'), '', 'live', '', '', '', 'no live shot: ' + str(r.get('live_err') or r.get('err'))]); continue
    live = Image.open(lp); Hs = round(live.height * W / live.width); L = load(lp, Hs)
    for v in ('plain', 'doc', 'docbeh'):
        p = os.path.join(d, v + '.png')
        if not os.path.exists(p): rows.append([site, r.get('parts'), r.get('live_h'), v, '', '', '', str(r.get(v + '_err') or 'no shot')]); continue
        im = Image.open(p); X = load(p, Hs); diff = np.abs(L - X).max(axis=2); ok = float((diff <= TOL).mean() * 100)
        rows.append([site, r.get('parts'), r.get('live_h'), v, r.get(v + '_h'), round(r.get(v + '_h', 0) / max(1, r.get('live_h') or 1), 3), round(ok, 1), ''])
w = csv.writer(open(os.path.join(os.path.dirname(__file__), 'merge-scores.csv'), 'w', newline='')); w.writerows(rows)
for v in ('plain', 'doc', 'docbeh'):
    xs = [float(x[6]) for x in rows[1:] if x[3] == v and x[6] != '']
    if xs: print(f'{v:7s} n={len(xs):2d} median={st.median(xs):5.1f} mean={st.mean(xs):5.1f} >=95: {sum(x>=95 for x in xs):2d}  <85: {sum(x<85 for x in xs):2d}')
