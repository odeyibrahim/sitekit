// Builds tool/index.html: the template with classify2.js and extract.js inlined (so the tool is still ONE file, and the tested sources are the shipped sources).
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let t = r('template.html');
const inline = (mark, file) => { const tag = '/*@@' + mark + '@@*/'; if (!t.includes(tag)) throw new Error('missing marker ' + tag); t = t.replace(tag, () => r(file).replace(/^if \(typeof module[^\n]*\n?/m, '').replace(/<\/script/gi, '<\\/script')); };
inline('classify2', 'classify2.js'); inline('unlazy', 'unlazy.js'); inline('spa', 'spa.js'); inline('reveal', 'reveal.js'); inline('links', 'links.js'); inline('behaviours', 'behaviours.js'); inline('extract', 'extract.js');
fs.mkdirSync(path.join(__dirname, 'tool'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'tool', 'index.html'), t);
console.log('built tool/index.html', t.length, 'bytes');
