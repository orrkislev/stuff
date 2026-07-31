/* Local dev server: serves the folder and writes files back on PUT, so edit.js
   can save straight into data/ and images/ with no directory picker.
   Run:  node server.mjs   →  http://localhost:8080   (local only — never deploy this) */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';

const root = import.meta.dirname;
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.md':'text/plain; charset=utf-8',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml'};

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = join(root, normalize(url === '/' ? '/index.html' : url));
  if(!file.startsWith(root)) return res.writeHead(403).end();   // no escaping the project folder

  if(req.method === 'PUT'){
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await mkdir(dirname(file), {recursive: true});
    await writeFile(file, Buffer.concat(chunks));
    return res.writeHead(204).end();
  }

  // Grok Imagine silhouette — proxied so the xAI key stays out of the page and CORS stays out of the way
  if(req.method === 'POST' && url === '/api/silhouette'){
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const {image, color, bg} = JSON.parse(Buffer.concat(chunks));
    const fail = (code, msg) => res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8'}).end(JSON.stringify({error: msg}));
    try{
      const env = Object.fromEntries((await readFile(join(root, '.env'), 'utf8')).split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
      if(!env.XAI_API_KEY) return fail(400, 'אין XAI_API_KEY בקובץ .env');
      const r = await fetch('https://api.x.ai/v1/images/edits', {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + env.XAI_API_KEY, 'Content-Type': 'application/json'},
        body: JSON.stringify({
          model: env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality',
          prompt: 'create a thumbnail for this image: the traced shape of this object in this flat color: ' +
                  color + ' over this background color: ' + bg,
          image: {url: image, type: 'image_url'},
          response_format: 'b64_json'
        })
      });
      const j = await r.json();
      if(!r.ok) return fail(502, (j.error && (j.error.message || j.error)) || ('xAI ' + r.status));
      const d = (j.data || [])[0] || {};
      const buf = d.b64_json ? Buffer.from(d.b64_json, 'base64')
                             : Buffer.from(await (await fetch(d.url)).arrayBuffer());
      return res.writeHead(200, {'Content-Type': 'image/jpeg'}).end(buf);
    }catch(e){ return fail(502, String(e.message || e)); }
  }
  try{
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': TYPES[extname(file)] || 'application/octet-stream'}).end(body);
  }catch{ res.writeHead(404).end('not found'); }
}).listen(8080, () => console.log('http://localhost:8080'));
