/* corpus.js — the local full-text layer.

   This site ships no running text of Forgotten Creators. Everything below
   operates on the chapter files the reader opens: pdf.js reads them in the
   browser, the text is kept in IndexedDB on the reader's own device, and
   nothing is uploaded.

   The book is offered as size-balanced blocks rather than one file per chapter,
   and the blocks carry no bookmarks. What they do carry is a running head with
   the printed page number, so each file announces which stretch of the book it
   is. That is how a dropped file is placed: not by its name — the names are
   opaque identifiers — but by the pages it turns out to contain. */

const DB = "forgotten-creators", STORE = "files";

export const corpus = {
  files: [],          // [{id, name, von, bis, n}]
  page: new Map(),    // printed page -> text
  units: null,        // units.json
  sections: null,     // sections.json
  _inv: null, _chunks: [], _bm25: null,
};

/* ---------------------------------------------------------- IndexedDB */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (mode, fn) => idb().then(db => new Promise((res, rej) => {
  const st = db.transaction(STORE, mode).objectStore(STORE);
  const rq = fn(st);
  rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
}));
const dbPut = (k, v) => tx("readwrite", s => s.put(v, k));
const dbGet = k => tx("readonly", s => s.get(k)).catch(() => null);
const dbKeys = () => tx("readonly", s => s.getAllKeys()).catch(() => []);
const dbDel = k => tx("readwrite", s => s.delete(k));

/* ---------------------------------------------------------- normalise */
const ACC = { "¨": "̈", "´": "́", "`": "̀", "ˆ": "̂", "˜": "̃" };
const RE_ACC = new RegExp("([" + Object.keys(ACC).join("") + "])\\s*([A-Za-z])", "g");

export function normalize(s) {
  return s
    .replace(RE_ACC, (m, a, b) => (b + ACC[a]).normalize("NFC"))
    .replace(/ﬀ/g, "ff").replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl")
    .replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/­/g, "").replace(/ /g, " ")
    .normalize("NFC");
}

const STOP = new Set(("the a an and or but of to in on at by for with from as is are was were be " +
  "been being it its this that these those he she they we you his her their our your my me him " +
  "them us not no nor so such then than there here which who whom whose what when where while if " +
  "because shall should will would may might can could must let do does did done have has had " +
  "having more most much many other another same own also very just only even still yet upon into " +
  "out up down over under again all any both each few one two three make made take given see").split(" "));

export const tokens = s => (s.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ0-9'\-]{1,}/g) || []);

/* ------------------------------------------------------------- pdf.js */
export async function readPdf(file, onProgress) {
  const pdfjs = await import("./vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = doc.numPages, out = new Array(n);
  for (let i = 1; i <= n; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let last = null, s = "";
    for (const it of tc.items) {
      if (last !== null && Math.abs(it.transform[5] - last) > 2) s += "\n";
      s += it.str;
      if (it.hasEOL) s += "\n";
      last = it.transform[5];
    }
    out[i - 1] = normalize(s)
      .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")
      .replace(/[ \t]+/g, " ");
    if (onProgress && (i % 8 === 0 || i === n)) onProgress(i, n);
    if (i % 40 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return out;
}

/* --------------------------------------------- place a file in the book */
const RE_TRAIL = /\s(\d{1,4})\s*$/;
const RE_LEAD = /^\s*(\d{1,4})\s+\D/;

function headPage(text) {
  const lines = text.split("\n");
  for (let i = 0; i < 2 && i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln || ln.length > 120) continue;
    let m = RE_TRAIL.exec(ln);
    if (m) return +m[1];
    m = RE_LEAD.exec(ln);
    if (m) return +m[1];
  }
  return null;
}

/** Fit a constant offset between index in the file and printed page, so that
    pages without a running head are placed rather than dropped. */
export function locate(pages) {
  const offs = [];
  pages.forEach((t, i) => {
    const p = headPage(t);
    if (p && p > 0 && p < 8000) offs.push(p - i);
  });
  if (!offs.length) return null;
  offs.sort((a, b) => a - b);
  const off = offs[Math.floor(offs.length / 2)];
  const belegt = offs.filter(o => o === off).length;
  return { off, von: off, bis: off + pages.length - 1, sicher: belegt / pages.length };
}

/* ------------------------------------------------------------ install */
export async function install(file, pages) {
  const loc = locate(pages);
  if (!loc) throw new Error("No running heads found — this does not look like a block of this book.");
  const rec = { id: String(loc.von), name: file.name, n: pages.length,
                von: loc.von, bis: loc.bis, sicher: +loc.sicher.toFixed(2), pages };
  await dbPut(rec.id, rec);
  await reload();
  return rec;
}
export async function forgetAll() {
  for (const k of await dbKeys()) await dbDel(k);
  await reload();
}
export async function forgetOne(id) {
  await dbDel(id);
  await reload();
}
export async function reload() {
  corpus.files = []; corpus.page = new Map();
  for (const k of await dbKeys()) {
    const rec = await dbGet(k);
    if (!rec || !rec.pages) continue;
    corpus.files.push({ id: rec.id, name: rec.name, n: rec.n, von: rec.von, bis: rec.bis, sicher: rec.sicher });
    rec.pages.forEach((t, i) => {
      const p = rec.von + i;
      if (!corpus.page.has(p)) corpus.page.set(p, t);
    });
  }
  corpus.files.sort((a, b) => a.von - b.von);
  reindex();
  return corpus.files.length;
}
export async function restore(units, sections) {
  corpus.units = units; corpus.sections = sections;
  return (await reload()) > 0;
}
export const isOpen = () => corpus.page.size > 0;
export const coverage = () => corpus.page.size;

/* ------------------------------------------------- canonical citation */
export function citeFor(seite) {
  const u = (corpus.units || []).find(x => x.seite_von <= seite && seite <= x.seite_bis);
  const s = (corpus.sections || []).find(x => x.von <= seite && seite <= x.bis);
  if (!u) return null;
  const teil = u.art === "appendix" ? `App. ${u.nr}` : (u.art === "apparat" ? u.titel : `Ch. ${u.nr}`);
  return { unit: u.nr, unitTitel: u.titel, sec: s ? s.key : null, secTitel: s ? s.titel : "",
           seite, label: `${s ? s.key : teil}, p. ${seite}` };
}

/* ------------------------------------------------------------- index */
export function reindex() {
  corpus._inv = new Map(); corpus._chunks = [];
  corpus._gf = new Map(); corpus._gtotal = 0;
  for (const [p, txt] of corpus.page) {
    if (!txt) continue;
    const tk = tokens(txt);
    for (const t of new Set(tk)) {
      if (t.length < 3) continue;
      let a = corpus._inv.get(t); if (!a) corpus._inv.set(t, (a = []));
      a.push(p);
    }
    for (const t of tk) {
      if (t.length < 3 || STOP.has(t)) continue;
      corpus._gtotal++; corpus._gf.set(t, (corpus._gf.get(t) || 0) + 1);
    }
    const clean = txt.replace(/\s+/g, " ").trim();
    if (clean.length < 140) continue;
    const sents = clean.split(/(?<=[.!?])\s+/);
    let cur = "";
    for (const s of sents) {
      if ((cur + " " + s).length > 1000 && cur.length > 260) {
        corpus._chunks.push({ page: p, text: cur.trim() }); cur = s;
      } else cur += " " + s;
    }
    if (cur.trim().length > 160) corpus._chunks.push({ page: p, text: cur.trim() });
  }
  for (const a of corpus._inv.values()) a.sort((x, y) => x - y);
  buildBm25();
}

function buildBm25() {
  const df = new Map(); let total = 0;
  const docs = corpus._chunks.map(c => {
    const tf = new Map();
    const tk = tokens(c.text).filter(t => t.length > 2 && !STOP.has(t));
    for (const t of tk) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    total += tk.length;
    return { tf, len: tk.length };
  });
  corpus._bm25 = { df, docs, avg: total / Math.max(1, docs.length), N: docs.length };
}

/* ------------------------------------------------------------ search */
function pagesWith(terms) {
  let cand = null;
  for (const t of terms) {
    const s = new Set(corpus._inv.get(t) || []);
    cand = cand === null ? s : new Set([...cand].filter(x => s.has(x)));
    if (!cand.size) break;
  }
  return [...(cand || [])].sort((a, b) => a - b);
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function kwic(q, { win = 56, limit = 300, units = null } = {}) {
  if (!isOpen()) return [];
  const terms = tokens(q).filter(t => t.length > 2);
  if (!terms.length) return [];
  const rx = new RegExp("(" + q.trim().split(/\s+/).map(esc).join("\\s+") + ")", "gi");
  const out = [];
  for (const p of pagesWith(terms)) {
    const cite = citeFor(p);
    if (units && (!cite || !units.includes(cite.unit))) continue;
    const txt = corpus.page.get(p).replace(/\s+/g, " ");
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(txt))) {
      out.push({
        l: txt.slice(Math.max(0, m.index - win), m.index), k: m[0],
        r: txt.slice(m.index + m[0].length, m.index + m[0].length + win),
        page: p, cite,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function hitCounts(q) {
  const res = {};
  if (!isOpen()) return res;
  const terms = tokens(q).filter(t => t.length > 2);
  const rx = new RegExp(q.trim().split(/\s+/).map(esc).join("\\s+"), "gi");
  for (const p of pagesWith(terms)) {
    const c = citeFor(p);
    if (!c) continue;
    res[c.unit] = (res[c.unit] || 0) + (corpus.page.get(p).replace(/\s+/g, " ").match(rx) || []).length;
  }
  return res;
}

/* --------------------------------------------------------- collocates */
/** Content words over-represented on the pages where the query occurs,
    scored by log-likelihood against the rest of what is open. Feeds the
    concept map; a link records co-mention on a page and nothing more. */
export function collocates(q, { top = 24, drop = null } = {}) {
  if (!isOpen() || !corpus._gf) return null;
  const terms = tokens(q).filter(t => t.length > 2);
  if (!terms.length) return null;
  const pp = pagesWith(terms);
  if (!pp.length) return { pages: 0, nodes: [], links: [] };
  const inSet = new Set(pp);
  const tf = new Map(); let ct = 0;
  for (const p of pp) for (const t of tokens(corpus.page.get(p))) {
    if (t.length < 3 || STOP.has(t)) continue;
    ct++; tf.set(t, (tf.get(t) || 0) + 1);
  }
  const G = corpus._gtotal, rest = Math.max(1, G - ct);
  const scored = [];
  for (const [t, a] of tf) {
    if (a < 3 || terms.includes(t) || (drop && drop.has(t))) continue;
    const g = corpus._gf.get(t) || a, b = Math.max(0, g - a);
    if (a / ct <= b / rest) continue;
    const e1 = ct * g / G, e2 = rest * g / G;
    const ll = 2 * (a * Math.log(a / e1) + (b > 0 ? b * Math.log(b / e2) : 0));
    scored.push([t, a, ll]);
  }
  scored.sort((x, y) => y[2] - x[2]);
  const nodes = scored.slice(0, top).map(([w, f, ll]) => {
    const on = (corpus._inv.get(w) || []).filter(p => inSet.has(p));
    const per = new Map();
    for (const p of on) { const c = citeFor(p); if (c) per.set(c.unit, (per.get(c.unit) || 0) + 1); }
    const unit = [...per.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { w, f, ll: +ll.toFixed(1), on, unit };
  });
  const links = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const B = new Set(nodes[j].on);
    let sh = 0; for (const p of nodes[i].on) if (B.has(p)) sh++;
    const need = Math.max(2, Math.ceil(Math.min(nodes[i].on.length, B.size) * 0.35));
    if (sh >= need) links.push({ a: i, b: j, w: sh });
  }
  links.sort((x, y) => y.w - x.w);
  return { pages: pp.length, nodes, links: links.slice(0, 60) };
}

export function retrieve(query, k = 10) {
  if (!corpus._bm25 || !corpus._chunks.length) return [];
  const { df, docs, avg, N } = corpus._bm25;
  const q = tokens(query).filter(t => t.length > 2 && !STOP.has(t));
  if (!q.length) return [];
  const k1 = 1.4, b = 0.72, scored = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]; let s = 0;
    for (const t of q) {
      const f = d.tf.get(t); if (!f) continue;
      const n = df.get(t) || 0;
      s += Math.log(1 + (N - n + 0.5) / (n + 0.5)) *
           (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / avg));
    }
    if (s > 0) scored.push([i, s]);
  }
  scored.sort((a, c) => c[1] - a[1]);
  const perUnit = new Map(), out = [];
  for (const [i, s] of scored) {
    const c = corpus._chunks[i];
    const cite = citeFor(c.page);
    const used = perUnit.get(cite && cite.unit) || 0;
    if (used >= 3) continue;
    perUnit.set(cite && cite.unit, used + 1);
    out.push({ ...c, score: +s.toFixed(2), cite });
    if (out.length >= k) break;
  }
  return out;
}
