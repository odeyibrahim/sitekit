# Small, invented sites. Not real-world data: they exist to exercise the code paths (plain page, fixed menu, script-built page, popups, lazy images, video background).
import os
D = os.path.join(os.path.dirname(__file__), 'fixtures'); os.makedirs(D, exist_ok=True)
def cards(items, cls='card'):
    return ''.join(f'<div class="{cls}"><h3>{t}</h3><p>{p}</p></div>' for t, p in items)
BASE = '*{box-sizing:border-box}body{margin:0;font-family:var(--body,system-ui)}a{text-decoration:none;color:inherit}'
def page(title, css, body, head=''):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title><style>{BASE}{css}</style>{head}</head><body>{body}</body></html>'
FEAT = [('Cleaning','Gentle routine cleaning and polish for the whole family, no rush.'),('Whitening','Safe brightening that keeps teeth strong and comfortable for you.'),('Check-ups','Friendly yearly exams with clear plans and no surprise bills at all.')]
# alpha: plain page, words in the class names help the classifier
alpha = page('alpha', ':root{--body:"Helvetica Neue",Arial,sans-serif;--ink:#1d2a3a;--brand:#2a7fff}body{color:var(--ink)}'
  '.site-nav{display:flex;justify-content:space-between;align-items:center;padding:0 40px;height:72px;background:#fff;border-bottom:1px solid #e5e8ee}.site-nav nav{display:flex;gap:24px}.logo{font:700 20px Georgia,serif}'
  '.hero{min-height:620px;padding:140px 60px;background:linear-gradient(#eaf2ff,#fff)}.hero h1{font:700 56px Georgia,serif;margin:0 0 16px;max-width:760px}.hero p{font-size:20px;max-width:560px}.btn{display:inline-block;margin-top:20px;background:var(--brand);color:#fff;padding:14px 26px;border-radius:10px;font-family:Verdana,sans-serif}'
  '.services{padding:90px 60px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.card{border:1px solid #e1e5ec;border-radius:14px;padding:26px}.card h3{font-family:Georgia,serif}'
  '.cta{padding:80px 60px;text-align:center;background:#0f2a4a;color:#fff}.cta h2{font:700 36px Georgia,serif;margin:0 0 14px}.cta .button{display:inline-block;background:#fff;color:#0f2a4a;padding:12px 24px;border-radius:8px}'
  'footer{padding:50px 60px;background:#0a1c33;color:#9fb0c8;font-size:14px}',
  '<header class="site-nav"><a class="logo" href="#">Gentle care</a><nav><a href="#">Home</a><a href="#">Services</a><a href="#">About</a><a href="#">Contact</a></nav></header>'
  '<section class="hero"><h1>Gentle care for every smile</h1><p>A calm, friendly dental practice where visits feel easy and nobody is rushed.</p><a class="btn" href="#">Book a visit</a></section>'
  f'<section class="services">{cards(FEAT)}</section>'
  '<section class="cta"><h2>Ready when you are</h2><a class="button" href="#">Call us today</a></section>'
  '<footer>© 2026 Gentle Care Dental. 12 Mill Road. All rights reserved. <a href="#">Privacy</a> <a href="#">Terms</a> <a href="#">Contact</a></footer>')
# beta: fixed menu bar, travel site, uses "wander"
beta = page('beta', ':root{--body:Georgia,serif}body{color:#222;background:#fbf8f3}.topbar{position:fixed;top:0;left:0;right:0;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 36px;background:rgba(255,255,255,.95);z-index:10}'
  '.topbar nav{display:flex;gap:22px}.banner{height:700px;padding:230px 60px 0;background:#cfe3d8}.banner h1{font-size:64px;margin:0;max-width:700px}.banner p{font-size:20px}'
  '.work{padding:80px 50px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.work div{height:220px;background:#b9c9bd;border-radius:6px;padding:12px;font-size:14px}'
  '.testimonials{padding:70px 80px;background:#fff}.testimonials blockquote{font-size:26px;margin:0;max-width:760px}'
  'footer.site-footer{padding:44px 50px;background:#1f2a24;color:#cfd8d2}',
  '<div class="topbar"><a href="#"><b>Wander&amp;Co</b></a><nav><a href="#">Trips</a><a href="#">Journal</a><a href="#">About</a><a href="#">Contact</a></nav></div>'
  '<section class="banner"><h1>Wander further this year</h1><p>Small-group trips to places you have not heard of yet.</p></section>'
  '<section class="work"><div>Lisbon, 6 days</div><div>Faroe Islands, 8 days</div><div>Oaxaca, 7 days</div><div>Hokkaido, 9 days</div></section>'
  '<section class="testimonials"><blockquote>“The best trip we have ever taken, and nothing went wrong. We are booking again for next spring already.”</blockquote></section>'
  '<footer class="site-footer">© 2026 Wander&amp;Co. Hand-planned trips since 2014. <a href="#">Instagram</a> <a href="#">Newsletter</a></footer>')
# gamma: built entirely by script (finished-page path)
gamma_js = ("var d=document;function E(t,c,h){var e=d.createElement(t);if(c)e.className=c;if(h)e.innerHTML=h;return e}"
  "addEventListener('DOMContentLoaded',function(){var b=d.body;b.appendChild(E('header','nav','<a href=#>Studio Nine</a><nav><a href=#>Work</a><a href=#>About</a><a href=#>Contact</a></nav>'));"
  "b.appendChild(E('section','hero','<h1>We build calm brands</h1><p>Identity, web and print for small teams who care.</p><a class=cta-btn href=#>See our work</a>'));"
  "b.appendChild(E('section','grid','<div class=tile>Brand A</div><div class=tile>Brand B</div><div class=tile>Brand C</div><div class=tile>Brand D</div>'));"
  "b.appendChild(E('footer','foot','© 2026 Studio Nine. All rights reserved. <a href=#>Privacy</a> <a href=#>Terms</a>'))})")
gamma = page('gamma', 'body{font-family:system-ui;color:#111}.nav{display:flex;justify-content:space-between;padding:22px 40px}.nav nav{display:flex;gap:20px}.hero{min-height:640px;padding:150px 60px;background:#f0e9ff}.hero h1{font-size:60px;margin:0 0 12px}.cta-btn{display:inline-block;background:#111;color:#fff;padding:12px 22px;border-radius:30px}'
  '.grid{padding:70px 50px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.tile{height:240px;background:#d9c9ff;border-radius:10px;padding:14px}.foot{padding:40px;background:#111;color:#aaa}', '', head='<script>'+gamma_js+'</script>')
# delta: plain, with a popup and a lazy image
delta = page('delta', 'body{font-family:Arial,sans-serif;color:#222}header{display:flex;justify-content:space-between;align-items:center;padding:0 30px;height:70px;background:#16302b;color:#fff}header nav{display:flex;gap:18px}'
  '.hero{min-height:600px;padding:130px 50px;background:#e8f1ee}.hero h1{font-size:52px;margin:0 0 12px}.numbers{display:flex;gap:40px;padding:70px 50px;background:#fff}.numbers div{font-size:44px;font-weight:700}.numbers span{display:block;font-size:14px;font-weight:400;color:#666}'
  '.faq{padding:70px 50px}details{border-bottom:1px solid #ddd;padding:14px 0}.popup{position:fixed;inset:0;background:rgba(0,0,0,.55);display:grid;place-content:center;z-index:50}.popup div{background:#fff;padding:36px;border-radius:10px;font-size:18px}'
  'footer{padding:44px 50px;background:#0d1f1c;color:#9db8b1}',
  '<div class="popup"><div>Subscribe to our newsletter <b>×</b></div></div>'
  '<header><b>Harvest Lab</b><nav><a href="#">Method</a><a href="#">Results</a><a href="#">FAQ</a><a href="#">Contact</a></nav></header>'
  '<section class="hero"><h1>Farm data you can trust</h1><p>Soil, yield and weather in one calm dashboard for working farms.</p></section>'
  '<section class="numbers"><div>128<span>farms</span></div><div>41%<span>less water</span></div><div>9.2<span>avg yield gain</span></div></section>'
  '<section class="faq"><h2>Questions</h2><details><summary>How do sensors connect?</summary>Over cellular, no wifi needed.</details><details><summary>Can I export data?</summary>Yes, as CSV at any time.</details><details><summary>Is there a trial?</summary>Thirty days, free.</details></section>'
  '<footer>© 2026 Harvest Lab. All rights reserved. <a href="#">Privacy</a> <a href="#">Terms</a> <a href="#">Contact</a> <a href="#">Jobs</a></footer>')
# risky: the failure causes found earlier, on purpose
risky = page('risky', ':root{--sans:Inter,Arial,sans-serif}body{font-family:var(--sans);color:#222;margin:0}.fixedwrap{position:fixed;top:0;left:0;right:0;z-index:20;background:#fff;height:80px}'
  '.fixedwrap header{display:flex;justify-content:space-between;align-items:center;padding:0 30px;height:80px}.fixedwrap nav{display:flex;gap:18px}'
  '.hero{position:relative;min-height:700px;color:#fff;padding:240px 50px;overflow:hidden;background:#222}.hero .bgvid{position:fixed;inset:0;background:#335;z-index:-1}.hero h1{font:700 60px Georgia,serif;margin:0}.hero .inner{position:relative}'
  '.gal{padding:70px 40px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gal img{width:100%;height:240px;object-fit:cover;background:#ddd}'
  'footer{padding:44px 50px;background:#111;color:#aaa;font-family:Courier New,monospace}',
  '<div class="fixedwrap"><header><b>Risky Co</b><nav><a href="#">Home</a><a href="#">Menu</a><a href="#">Book</a><a href="#">Contact</a></nav></header></div>'
  '<section class="hero"><div class="bgvid"></div><div class="inner"><h1>Dinner, but better</h1><p>Seasonal plates in a loud room.</p></div></section>'
  '<section class="gal"><img data-src="a.jpg" loading="lazy" alt=""><img data-src="b.jpg" loading="lazy" alt=""><img data-src="c.jpg" loading="lazy" alt=""><img loading="lazy" alt=""></section>'
  '<footer>© 2026 Risky Co. 1 High Street. All rights reserved. <a href="#">Privacy</a> <a href="#">Terms</a> <a href="#">Jobs</a> <a href="#">Press</a></footer>')
for n, h in dict(alpha=alpha, beta=beta, gamma=gamma, delta=delta, risky=risky).items(): open(os.path.join(D, n + '.html'), 'w').write(h)
print('fixtures:', os.listdir(D))
