/* Local-only inline editor. index.html loads this when the page is served from localhost.
   Writes straight to data/*.json and images/ by PUT-ing them back to server.mjs — no picker,
   no build. Run `node server.mjs`, edit, save, then commit & push. */
(function(){

// palette from ADDING-ITEMS.md
const COLORS = ['#538094','#245238','#77787A','#34536A','#AA4B27','#80263E','#B58D30'];
const STATUSES = ['available','reserved','gone'];   // ponytail: 'sold' still renders, just not in the click cycle

let env = {}, on = false, dirty = false;

/* ---------- files ---------- */

async function writeFile(path, body){
  const r = await fetch(path, {method: 'PUT', body});
  if(!r.ok) throw new Error('הכתיבה נכשלה — רץ `node server.mjs`?');
}
const imgFile = async n => (await fetch('images/' + n)).blob();

async function connect(){
  try{
    const txt = await (await fetch('.env')).text();
    env = Object.fromEntries(txt.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  }catch{ env = {}; }
  on = true;
  document.body.classList.add('editing');
  STATE.categories = STATE.allCategories;   // empty sections stay visible while editing
  refresh();
  say('מצב עריכה');
}

async function save(){
  await writeFile('data/items.json', JSON.stringify(STATE.items, null, 2) + '\n');
  await writeFile('data/categories.json', JSON.stringify(STATE.allCategories, null, 2) + '\n');
  setDirty(false);
  say('✓ נשמר — git commit & push');
}

let saveTimer;
function setDirty(v){
  dirty = v;
  clearTimeout(saveTimer);
  if(v) saveTimer = setTimeout(() => save().catch(e => say(e.message, 1)), 800);   // autosave
}

let sayTimer;
function say(t, sticky){
  const s = document.getElementById('ed-say');
  if(!s) return;
  s.textContent = t;
  clearTimeout(sayTimer);
  if(!sticky) sayTimer = setTimeout(() => s.textContent = '', 4000);
}

/* ---------- re-render hooks ---------- */

const _renderGroups = window.renderGroups;
window.renderGroups = function(){ _renderGroups(); if(on) decorate(); };
const _setHero = window.setHero;
window.setHero = function(g, i){ _setHero(g, i); if(on) decorateHero(g); };
function refresh(){ setDirty(true); window.renderGroups(); }

/* ---------- status line ---------- */

const bar = document.createElement('div');
bar.className = 'ed-bar';
bar.innerHTML = '<span id="ed-say"></span>';
document.body.appendChild(bar);

const newFiles = Object.assign(document.createElement('input'), {type:'file', accept:'image/*', multiple:true});
newFiles.style.display = 'none';
document.body.appendChild(newFiles);

function newSection(){
  const name = prompt('שם המדור בעברית');
  if(!name) return;
  let n = STATE.allCategories.length + 1, id;
  do { id = 'section-' + (n++); } while(STATE.allCategories.some(c => c.id === id));
  STATE.allCategories.push({id, name});
  STATE.categories = STATE.allCategories;
  refresh();
}

function delSection(catId){
  const n = itemsForCat(catId).length;
  if(n) return say('יש עוד ' + n + ' פריטים במדור — העבר או מחק אותם קודם', 1);
  STATE.allCategories.splice(STATE.allCategories.findIndex(c => c.id === catId), 1);
  STATE.categories = STATE.allCategories;
  refresh();
}

/* ---------- decorate the rendered page ---------- */

function decorate(){
  document.querySelectorAll('.group').forEach(g => {
    decorateHero(g);
    const cat = g.dataset.cat;
    // rename a section by typing on its title — the clone drops the search-mode click handler
    const h = g.querySelector('.group-name');
    if(h){
      const t = h.cloneNode(true);
      t.querySelectorAll('.gn-ico').forEach(i => i.remove());
      h.replaceWith(t);
      editable(t, txt => {
        const c = STATE.allCategories.find(x => x.id === cat);
        if(c && txt){ c.name = txt; setDirty(true); }
      }, true);
      const del = document.createElement('button');
      del.className = 'ed-delsect'; del.textContent = '🗑'; del.title = 'מחק מדור';
      del.onclick = () => delSection(cat);
      t.after(del);
    }
    // "+" cell at the end of every grid adds an item to that section
    const grid = g.querySelector('.grid');
    if(grid && !grid.querySelector('.ed-add')){
      const add = document.createElement('div');
      add.className = 'cell ed-add'; add.title = 'פריט חדש'; add.textContent = '+';
      add.onclick = () => newItem(cat);
      grid.insertBefore(add, grid.querySelector('.cell.empty') || null);
    }
  });
  // "+" at the end of the section dots adds a section
  const pager = document.getElementById('pager');
  if(pager && !pager.querySelector('.ed-newsect')){
    const b = document.createElement('button');
    b.className = 'pdot ed-newsect'; b.textContent = '+'; b.title = 'מדור חדש';
    b.onclick = newSection;
    pager.appendChild(b);
  }
}

function pickFiles(cb){
  newFiles.value = '';
  newFiles.onchange = () => { const fs = [...newFiles.files]; if(fs.length) cb(fs); };
  newFiles.click();
}

function decorateHero(groupEl){
  const hero = groupEl.querySelector('.hero');
  if(!hero) return;
  const cat = groupEl.dataset.cat;
  const id = hero.dataset.itemId || (hero.querySelector('.hero-img') || {}).alt;
  const it = STATE.items.find(i => i.id === id) || STATE.items.find(i => i.title === id);
  if(!it) return;

  const tools = document.createElement('div');
  tools.className = 'ed-tools';
  tools.innerHTML =
    '<button data-a="ai" title="מלא כותרת ותיאור מהתמונה">✨</button>' +
    '<button data-a="img" title="הוסף תמונות">🖼</button>' +
    '<button data-a="sil" title="צור סילואט">◼</button>' +
    '<button data-a="up" title="הזז אחורה">▶</button>' +
    '<button data-a="down" title="הזז קדימה">◀</button>' +
    '<select data-a="cat" title="העבר למדור">' +
      STATE.allCategories.map(c => '<option value="' + c.id + '"' + (c.id === it.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') +
    '</select>' +
    '<button data-a="del" title="מחק פריט">🗑</button>' +
    '<span class="ed-strip">' + it.images.map((n, i) =>
      '<span class="ed-thumb' + (n === it.thumbnail ? ' is-thumb' : '') + '"><img src="images/' + esc(n) + '" alt="">' +
      '<b data-a="thumb" data-i="' + i + '" title="הפוך לתמונת אגודל">★</b>' +
      '<b data-a="rm" data-i="' + i + '" title="הסר">✕</b></span>').join('') + '</span>';
  hero.appendChild(tools);
  tools.addEventListener('click', e => e.stopPropagation());
  tools.onchange = e => { if(e.target.dataset.a === 'cat') moveItem(it, e.target.value); };
  tools.addEventListener('click', e => {
    const a = e.target.dataset.a, i = +e.target.dataset.i;
    if(a === 'ai') aiFill(it);
    if(a === 'img') pickFiles(fs => addImages(it, fs));
    if(a === 'sil') silhouette(it).catch(err => say(err.message, 1));
    if(a === 'up' || a === 'down') reorder(it, a === 'down' ? 1 : -1);
    if(a === 'thumb'){ it.thumbnail = it.thumbnail === it.images[i] ? '' : it.images[i]; refresh(); }
    if(a === 'rm'){ if(it.thumbnail === it.images[i]) it.thumbnail = ''; it.images.splice(i, 1); refresh(); }
    if(a === 'del' && confirm('למחוק את "' + (it.title || it.id) + '"?')){
      STATE.items.splice(STATE.items.indexOf(it), 1); refresh();
    }
  });

  const cap = hero.querySelector('.hero-caption');
  if(cap){
    cap.addEventListener('click', e => { if(!e.target.classList.contains('chip')) e.stopPropagation(); });
    editable(cap.querySelector('.hero-title'), t => { it.title = t; setDirty(true); repaintCell(it); });
    let desc = cap.querySelector('.hero-desc');
    if(!desc){   // no description yet — give it an empty slot to type into
      desc = document.createElement('span');
      desc.className = 'hero-desc ed-empty';
      cap.querySelector('.hero-info').appendChild(desc);
    }
    editable(desc, t => { it.description = t; setDirty(true); });
    const chip = cap.querySelector('.chip');
    if(chip){
      chip.style.cursor = 'pointer';
      chip.title = 'לחץ לשינוי סטטוס';
      chip.onclick = e => { e.stopPropagation(); cycleStatus(it); };
      if(it.status === 'reserved' || it.status === 'gone'){
        const recip = document.createElement('span');
        recip.className = 'hero-recip' + (it.recipient ? '' : ' ed-empty');
        recip.textContent = it.recipient || '';
        chip.after(recip);
        editable(recip, t => {
          if(t) it.recipient = t; else delete it.recipient;
          refresh();
        }, true);
      }
    }
  }
}

// contenteditable that commits on blur / Enter
function editable(node, commit, single){
  if(!node || node._ed) return;
  node._ed = true;
  node.contentEditable = 'plaintext-only';
  node.spellcheck = false;
  node.classList.add('ed-field');
  node.addEventListener('keydown', e => {
    e.stopPropagation();                                   // don't steal arrows from the catalog nav
    if(e.key === 'Enter' && single){ e.preventDefault(); node.blur(); }
    if(e.key === 'Escape') node.blur();
  });
  node.addEventListener('blur', () => commit(node.textContent.trim()));
}

function repaintCell(it){
  const cell = document.querySelector('.cell[data-item="' + it.id + '"] .cell-title');
  if(cell) cell.textContent = it.title;
}

/* ---------- mutations ---------- */

function cycleStatus(it){
  it.status = STATUSES[(STATUSES.indexOf(it.status) + 1) % STATUSES.length];
  if(it.status !== 'reserved' && it.status !== 'gone') delete it.recipient;
  refresh();
}

function moveItem(it, catId){
  it.category = catId;
  STATE.selected[displayCatOf(it)] = it.id;
  refresh();
  say('הועבר ל' + (STATE.allCategories.find(c => c.id === catId) || {}).name);
}

// order inside a section is the order in items.json — swap with the neighbour
function reorder(it, d){
  const same = STATE.items.filter(i => i.category === it.category);
  const other = same[same.indexOf(it) + d];
  if(!other) return;
  const a = STATE.items.indexOf(it), b = STATE.items.indexOf(other);
  STATE.items[a] = other; STATE.items[b] = it;
  refresh();
}

async function addImages(it, files){
  for(const f of files){
    const ext = (f.name.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
    let n = it.images.length + 1, name;
    do { name = it.id + '-real-' + (n++) + ext; } while(it.images.includes(name));
    await writeFile('images/' + name, f);
    it.images.push(name);
  }
  refresh();
  say(files.length + ' תמונות נוספו');
}

// paste photos straight into the item on screen; a first photo also gets the new-item treatment
document.addEventListener('paste', async e => {
  if(!on) return;
  const dt = e.clipboardData;
  if(!dt) return;
  // some sources expose the image only through items[], not files[]
  const files = (dt.files.length ? [...dt.files]
    : [...dt.items].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean))
    .filter(f => f.type.startsWith('image/'));
  if(!files.length) return;
  e.preventDefault();
  const cat = getDisplayCats()[STATE.currentSection];
  const it = cat && STATE.items.find(i => i.id === STATE.selected[cat.id]);
  if(!it) return say('בחר פריט קודם', 1);
  const first = !it.images.some(n => !n.startsWith('placeholder-'));
  try{
    await addImages(it, files);
    if(first){
      if(env.OPENROUTER_API_KEY) await aiFill(it);
      say('◼ יוצר סילואט…', 1);
      await silhouette(it);
      say('✓ הודבק');
    }
  }catch(err){ say('שגיאה: ' + err.message, 1); }
});

function newItem(catId){
  let n = STATE.items.length + 1, id;
  do { id = 'item-' + (n++); } while(STATE.items.some(i => i.id === id));
  STATE.items.push({id, title: 'ללא שם', category: catId, status: 'available',
                    description: '', images: [], thumbnail: ''});
  STATE.selected[catId] = id;
  refresh();
  say('פריט חדש — הדבק תמונה (Ctrl+V)');
}

/* ---------- AI (OpenRouter, key from .env) ---------- */

async function shrink(blob, max){
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'),
    {width: Math.round(bmp.width * k), height: Math.round(bmp.height * k)});
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

// it === null when the item doesn't exist yet — then we ask for an id too
async function aiSuggest(blob, it){
  if(!env.OPENROUTER_API_KEY) throw new Error('אין OPENROUTER_API_KEY בקובץ .env');
  const cats = STATE.allCategories;
  const prompt = 'אתה עוזר לקטלג פריטים למכירה לפני מעבר דירה. הסתכל בתמונה והחזר JSON בלבד, בלי טקסט נוסף:\n' +
    '{' + (it ? '' : '"id":"...",') + '"title":"...","category":"...","description":"..."}\n' +
    (it ? '' : 'id: מזהה קצר באנגלית קטנה עם מקפים, למשל blue-armchair.\n') +
    'title: שם קצר בעברית, 2-4 מילים.\n' +
    'category: אחד מהמזהים: ' + cats.map(c => c.id + ' (' + c.name + ')').join(', ') + '\n' +
    'description: משפט קצר וכנה בעברית — חומר, מצב, מידות אם נראות. בלי שיווק. אם אין מה להוסיף החזר "".' +
    (it ? '\nערכים נוכחיים (שפר אותם, אל תמחק מידע נכון): ' +
      JSON.stringify({title: it.title, category: it.category, description: it.description}) : '');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {'Authorization': 'Bearer ' + env.OPENROUTER_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL || 'qwen/qwen3.7-flash',
      reasoning: {enabled: false},   // 4x cheaper and ~4x faster; you're reviewing the text anyway
      messages: [{role: 'user', content: [
        {type: 'text', text: prompt},
        {type: 'image_url', image_url: {url: (await shrink(blob, 768)).toDataURL('image/jpeg', .8)}}
      ]}]
    })
  });
  const j = await r.json();
  if(!r.ok) throw new Error((j.error && j.error.message) || r.status);
  const txt = j.choices[0].message.content;
  return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)); // ponytail: models like to wrap JSON in prose
}

async function aiFill(it){
  if(!it.images[0]) return say('צריך תמונה קודם', 1);
  say('✨ חושב…', 1);
  try{
    const out = await aiSuggest(await imgFile(it.images[0]), it);
    if(out.title) it.title = out.title;
    if(out.description) it.description = out.description;
    if(STATE.allCategories.some(c => c.id === out.category)) it.category = out.category;
    refresh();
    say('✓ עודכן');
  }catch(e){ say('שגיאה: ' + e.message, 1); }
}

/* ---------- silhouette: Grok Imagine, canvas fallback ---------- */

async function silhouette(it, bg){
  const src = it.images.find(n => !n.startsWith('placeholder-'));
  if(!src) throw new Error('צריך תמונה קודם');
  bg = bg || '#DDD6CA';
  const hex = COLORS[STATE.items.indexOf(it) % COLORS.length];
  let blob;
  try{
    say('◼ Grok מצייר סילואט…', 1);
    const r = await fetch('/api/silhouette', {
      method: 'POST',
      body: JSON.stringify({image: (await shrink(await imgFile(src), 1024)).toDataURL('image/jpeg', .85), color: hex, bg})
    });
    if(!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    blob = await r.blob();
  }catch(e){
    say('Grok נכשל (' + e.message + ') — סילואט מקומי', 1);
    blob = await localSilhouette(src, hex, bg);
  }
  const name = it.id + '-silhouette.jpg';
  await writeFile('images/' + name, blob);
  it.thumbnail = name;
  refresh();
  say('✓ סילואט');
}

// scripts/silhouette.py ported to canvas — used when there's no xAI key or the call fails
async function localSilhouette(src, hex, bg){
  const c = await shrink(await imgFile(src), 900), ctx = c.getContext('2d'), w = c.width, h = c.height;
  const d = ctx.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  for(let i = 0; i < w * h; i++){
    const r = d[i*4], g = d[i*4+1], b = d[i*4+2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    m[i] = ((mx > 140 && mx - mn < 40) || (r > 200 && g > 200 && b > 200)) ? 0 : 1;
  }
  const m2 = new Uint8Array(w * h);   // 3x3 majority ≈ the python median filter, kills speckle
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    let n = 0, hit = 0;
    for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
      const yy = y + dy, xx = x + dx;
      if(yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
      n++; hit += m[yy * w + xx];
    }
    m2[y * w + x] = hit * 2 > n ? 1 : 0;
  }
  const rgb = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const f = rgb(hex), k = rgb(bg);
  const out = ctx.createImageData(w, h);
  for(let i = 0; i < w * h; i++){
    const p = m2[i] ? f : k;
    out.data[i*4] = p[0]; out.data[i*4+1] = p[1]; out.data[i*4+2] = p[2]; out.data[i*4+3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return new Promise(res => c.toBlob(res, 'image/jpeg', .9));
}

/* ---------- styles ---------- */

document.head.insertAdjacentHTML('beforeend', '<style>' + `
.ed-bar{position:fixed;bottom:10px;right:12px;z-index:60;font-family:'Heebo',sans-serif;pointer-events:none}
#ed-say:not(:empty){display:block;font-size:12px;color:var(--text-muted);max-width:230px;
  background:rgba(240,235,224,.94);border:1px solid var(--border);border-radius:10px;padding:6px 8px}

.ed-tools{position:absolute;top:8px;right:8px;z-index:12;display:flex;gap:4px;align-items:center;flex-wrap:wrap;
  max-width:calc(100% - 16px);background:rgba(20,18,16,.72);border-radius:8px;padding:4px;backdrop-filter:blur(4px)}
.ed-tools button,.ed-tools select{font:inherit;font-size:13px;line-height:1;padding:4px 6px;border:0;border-radius:5px;
  background:rgba(255,255,255,.9);color:#2A2520;cursor:pointer}
.ed-tools button:hover{background:#fff}
.ed-tools select{max-width:110px;font-size:12px}
.ed-strip{display:flex;gap:3px}
.ed-thumb{position:relative;width:34px;height:34px}
.ed-thumb img{width:34px;height:34px;object-fit:cover;border-radius:4px;border:2px solid transparent}
.ed-thumb.is-thumb img{border-color:#B58D30}
.ed-thumb b{position:absolute;font-size:9px;line-height:1;padding:2px;border-radius:3px;cursor:pointer;
  background:rgba(0,0,0,.65);color:#fff;font-weight:400}
.ed-thumb b[data-a="thumb"]{bottom:0;right:0}
.ed-thumb b[data-a="rm"]{top:0;left:0}

/* the caption is click-through by default — in edit mode it has to catch its own clicks
   so title/description/status don't fall through to the lightbox */
body.editing .hero-caption{pointer-events:auto}
body.editing .hero-title,body.editing .hero-desc{cursor:text}

.ed-field{outline:0}
.ed-field:hover{box-shadow:0 0 0 1px rgba(255,255,255,.45)}
.ed-field:focus{box-shadow:0 0 0 2px var(--status-reserved);background:rgba(0,0,0,.35);border-radius:3px}
.hero-desc.ed-empty:empty::before{content:'הוסף תיאור…';opacity:.55}
.hero-recip{font-size:11px;color:var(--status-reserved);cursor:text}
.hero-recip.ed-empty:empty::before{content:'למי?';opacity:.55}
body.editing .group-name{cursor:text}
.cell.ed-add{display:flex;align-items:center;justify-content:center;font-size:26px;color:var(--text-light);
  cursor:pointer;border:1px dashed var(--border)}
.cell.ed-add:hover{color:var(--accent);border-color:var(--accent)}
.ed-delsect{background:none;border:0;cursor:pointer;font-size:13px;opacity:.45;padding:0 4px}
.ed-delsect:hover{opacity:1}
.pdot.ed-newsect{width:auto;height:auto;border-radius:6px;background:var(--text);color:#fff;
  font-size:12px;line-height:1;padding:2px 6px}
` + '</style>');

connect().catch(e => say(e.message, 1));   // localhost only — straight into edit mode

// handy from the console: EDIT.decorate() to re-apply, EDIT.state() to peek
window.EDIT = {connect, save, decorate, silhouette, aiSuggest, state: () => ({on, dirty, env})};

})();
