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
  try{
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': TYPES[extname(file)] || 'application/octet-stream'}).end(body);
  }catch{ res.writeHead(404).end('not found'); }
}).listen(8080, () => console.log('http://localhost:8080'));
