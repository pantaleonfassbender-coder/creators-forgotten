/* map.js — concept maps.

   Three maps, one honesty rule: a line records that the book mentions two
   things together — in the same parts, on the same page, in the same figure
   caption — and nothing more. Proximity is not synonymy, and a link is not
   influence.

   The terrain map is computed from shipped distributions and needs nothing.
   The concept map is computed in the browser, from the pages of the files the
   reader has opened; nothing is sent anywhere. The caption map renders the
   shipped figure-caption network. No library; layout is Fruchterman–Reingold
   in a few dozen lines. */
import * as C from "./corpus.js";
import { corpus } from "./corpus.js";
import { D, esc, nf, debounce, unitColor, sachUnits, openUnlock } from "./app.js";

const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const NS = "http://www.w3.org/2000/svg";

/* Function words, given names standing alone, and repair fragments that would
   sit in the map as if they were concepts. The list is stated here rather than
   hidden in the build, because it is an editorial decision. */
const NOISE = new Set(("anced some time like fact case cases year years came less last near part " +
  "parts able high used using also made make many much well first second new old way ways thing " +
  "things eine auch sich dass aber nach nicht und der die das von für january february march april " +
  "may june july august september october november december hans karl otto paul fritz ernst " +
  "per percent earlier later however though instead example including several around within").split(" "));

/* ------------------------------------------------------------- layout */
function layout(nodes, edges, W, H, iters = 300) {
  const n = nodes.length || 1;
  nodes.forEach((d, i) => {
    const a = i * 2.399963, r = 16 * Math.sqrt(i + 1);
    d.x = W / 2 + r * Math.cos(a); d.y = H / 2 + r * Math.sin(a);
  });
  const k = Math.sqrt(W * H / n) * 0.88;
  const dx = new Array(n), dy = new Array(n);
  for (let it = 0; it < iters; it++) {
    const t = Math.max(2, (W / 9) * (1 - it / iters));
    dx.fill(0); dy.fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let vx = nodes[i].x - nodes[j].x, vy = nodes[i].y - nodes[j].y;
      const d2 = vx * vx + vy * vy || 0.01, f = k * k / d2;
      vx *= f; vy *= f;
      dx[i] += vx; dy[i] += vy; dx[j] -= vx; dy[j] -= vy;
    }
    for (const e of edges) {
      let vx = nodes[e.a].x - nodes[e.b].x, vy = nodes[e.a].y - nodes[e.b].y;
      const d = Math.sqrt(vx * vx + vy * vy) || 0.1, f = d / k * (e.s || 1);
      vx *= f; vy *= f;
      dx[e.a] -= vx; dy[e.a] -= vy; dx[e.b] += vx; dy[e.b] += vy;
    }
    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 0.1, m = Math.min(d, t) / d;
      nodes[i].x += dx[i] * m + (W / 2 - nodes[i].x) * 0.01;
      nodes[i].y += dy[i] * m + (H / 2 - nodes[i].y) * 0.01;
    }
  }
  fit(nodes, W, H, 46);
}
function fit(nodes, W, H, pad) {
  if (!nodes.length) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const d of nodes) { x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y); }
  const s = Math.min((W - 2 * pad) / Math.max(1, x1 - x0), (H - 2 * pad) / Math.max(1, y1 - y0));
  for (const d of nodes) {
    d.x = pad + (d.x - x0) * s + (W - 2 * pad - (x1 - x0) * s) / 2;
    d.y = pad + (d.y - y0) * s + (H - 2 * pad - (y1 - y0) * s) / 2;
  }
}

/* --------------------------------------------------------------- draw */
function drawGraph(host, nodes, edges, { onPick, onHover } = {}) {
  const W = 1100, H = 640;
  layout(nodes, edges, W, H);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "gmap");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const gE = document.createElementNS(NS, "g"), gN = document.createElementNS(NS, "g");
  svg.append(gE, gN);

  const adj = nodes.map(() => new Set());
  const lines = edges.map(e => {
    adj[e.a].add(e.b); adj[e.b].add(e.a);
    const ln = document.createElementNS(NS, "line");
    ln.setAttribute("class", "ge");
    ln.setAttribute("stroke-width", (0.7 + 1.8 * (e.s || 1) / 2).toFixed(1));
    gE.append(ln); return ln;
  });
  const dots = nodes.map((d, i) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "gn");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("r", d.r); c.setAttribute("fill", d.color);
    const tx = document.createElementNS(NS, "text");
    tx.setAttribute("dy", d.r + 11); tx.setAttribute("font-size", Math.max(9.5, d.r * 0.85));
    tx.textContent = d.label;
    g.append(c, tx); gN.append(g);
    g.addEventListener("pointerenter", () => { hot(i, true); onHover && onHover(d); });
    g.addEventListener("pointerleave", () => hot(i, false));
    g.addEventListener("click", e => { if (!moved) onPick && onPick(d); e.stopPropagation(); });
    return g;
  });
  const place = () => {
    edges.forEach((e, i) => {
      lines[i].setAttribute("x1", nodes[e.a].x); lines[i].setAttribute("y1", nodes[e.a].y);
      lines[i].setAttribute("x2", nodes[e.b].x); lines[i].setAttribute("y2", nodes[e.b].y);
    });
    nodes.forEach((d, i) => dots[i].setAttribute("transform", `translate(${d.x},${d.y})`));
  };
  place();

  function hot(i, on) {
    svg.classList.toggle("dimmed", on);
    dots.forEach((g, j) => g.classList.toggle("hot", on && (j === i || adj[i].has(j))));
    edges.forEach((e, j) => lines[j].classList.toggle("hot", on && (e.a === i || e.b === i)));
  }

  /* Drag a node; drag the ground to pan; wheel to zoom. */
  const vb = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const toWorld = e => {
    const r = svg.getBoundingClientRect();
    return { x: vb.x + (e.clientX - r.left) / r.width * vb.w, y: vb.y + (e.clientY - r.top) / r.height * vb.h };
  };
  let drag = null, moved = false;
  svg.addEventListener("pointerdown", e => {
    const g = e.target.closest(".gn");
    const i = g ? dots.indexOf(g) : -1;
    drag = { i, p: toWorld(e) }; moved = false;
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = toWorld(e);
    if (Math.abs(p.x - drag.p.x) + Math.abs(p.y - drag.p.y) > 2) moved = true;
    if (drag.i >= 0) { nodes[drag.i].x = p.x; nodes[drag.i].y = p.y; place(); }
    else { vb.x -= p.x - drag.p.x; vb.y -= p.y - drag.p.y; apply(); return; }
    drag.p = p;
  });
  svg.addEventListener("pointerup", () => { drag = null; });
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const p = toWorld(e), z = e.deltaY > 0 ? 1.14 : 1 / 1.14;
    vb.x = p.x - (p.x - vb.x) * z; vb.y = p.y - (p.y - vb.y) * z;
    vb.w *= z; vb.h *= z; apply();
  }, { passive: false });

  host.innerHTML = ""; host.append(svg);
  return svg;
}

function unitLegend(units) {
  const us = sachUnits();
  return `<div class="legend">${us.filter(u => units.has(u.nr)).map(u =>
    `<span><i style="background:${unitColor(us.indexOf(u))}"></i>${u.art === "appendix" ? "App." : "Ch."} ${esc(u.nr)}</span>`).join("")}
    <span class="fine" style="margin-left:auto">drag to move · wheel to zoom · click a term</span></div>`;
}

/* ================================================================ view */
export function renderMap(view) {
  const qs = new URLSearchParams(location.hash.split("?")[1] || "");
  const tab = qs.get("t") || "terrain";
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Concept map</span>
      <h1>Mapping what the book holds together</h1>
      <p class="lede">Three maps, drawn from three different windows: the whole book for its vocabulary, the
      page for a concept's company, the figure caption for its people. In each, a line records co-mention
      and nothing more — proximity is not synonymy, and a link is not influence.</p></div>
    <div class="toolbar" id="maptabs">
      <button class="chip ${tab === "terrain" ? "on" : ""}" data-t="terrain">The terrain of terms</button>
      <button class="chip ${tab === "concept" ? "on" : ""}" data-t="concept">Map a concept</button>
      <button class="chip ${tab === "figures" ? "on" : ""}" data-t="figures">Faces in the figures</button>
    </div>
    <div id="mapbody"></div>
  </div>`));
  view.querySelectorAll("#maptabs .chip").forEach(b =>
    b.onclick = () => location.hash = `#/map?t=${b.dataset.t}`);
  const body = view.querySelector("#mapbody");
  ({ terrain: tabTerrain, concept: tabConcept, figures: tabFigures }[tab] || tabTerrain)(body, qs);
}

/* ------------------------------------------------------------ terrain */
function tabTerrain(body, qs) {
  const count = Math.min(300, Math.max(40, +(qs.get("n") || 90)));
  body.append(el(`<div>
    <p class="readable">The ${nf(Object.keys(D.terms).length)} most frequent content words, placed by where
    they live: two terms sit near one another when their distributions over the seventeen parts run
    parallel. Colour is the part where a term is densest. This is a coarse map — seventeen parts is a wide
    window — so read the clusters, not the individual line.</p>
    <div class="toolbar">
      <label class="fld">terms shown
        <select id="tn">${[60, 90, 120, 160].map(n => `<option ${n === count ? "selected" : ""}>${n}</option>`).join("")}</select>
      </label>
      <span class="fine" id="tstat"></span>
    </div>
    <div class="chartbox" id="tgraph"></div>
    <div class="panel" id="tinfo"><span class="fine">Hover a term to see its company; click it for details
    and a way into the concordance.</span></div>
  </div>`));
  body.querySelector("#tn").onchange = e => location.hash = `#/map?t=terrain&n=${e.target.value}`;

  const us = sachUnits(), toks = us.map(u => u.tokens);
  const entries = Object.entries(D.terms).filter(([w]) => !NOISE.has(w))
    .sort((a, b) => b[1].f - a[1].f).slice(0, count);
  const vecs = entries.map(([, d]) => {
    const v = d.dist.map((x, i) => x / toks[i]), n = Math.hypot(...v) || 1;
    return v.map(x => x / n);
  });
  const nodes = entries.map(([w, d], i) => {
    let top = 0; vecs[i].forEach((x, j) => { if (x > vecs[i][top]) top = j; });
    return { id: w, label: w, f: d.f, unit: us[top].nr, uniti: top,
             r: 3 + Math.sqrt(d.f) * 0.16, color: unitColor(top) };
  });
  const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const seen = new Set(), edges = [];
  for (let i = 0; i < nodes.length; i++) {
    const sims = [];
    for (let j = 0; j < nodes.length; j++) if (j !== i) sims.push([j, cos(vecs[i], vecs[j])]);
    sims.sort((a, b) => b[1] - a[1]);
    for (const [j, s] of sims.slice(0, 3)) {
      if (s < 0.62) break;
      const key = Math.min(i, j) + ":" + Math.max(i, j);
      if (!seen.has(key)) { seen.add(key); edges.push({ a: i, b: j, s: s * s }); }
    }
  }
  body.querySelector("#tstat").textContent =
    `${nodes.length} terms · ${edges.length} affinities of 0.62 or above, three strongest per term`;

  const info = body.querySelector("#tinfo");
  const show = d => {
    const i = nodes.indexOf(d);
    const near = edges.filter(e => e.a === i || e.b === i)
      .map(e => nodes[e.a === i ? e.b : e.a].id);
    const u = us[d.uniti];
    info.innerHTML = `<div class="th" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.8rem;align-items:baseline">
      <span style="font-family:var(--serif);font-size:1.15rem">${esc(d.id)}</span>
      <span class="fine">${nf(d.f)} occurrences · densest in ${u.art === "appendix" ? "Appendix" : "Chapter"} ${esc(u.nr)}</span></div>
      ${near.length ? `<p class="fine" style="margin:.4rem 0">Runs parallel to: ${near.map(w =>
        `<a class="chip" href="#/concordance?q=${encodeURIComponent(w)}">${esc(w)}</a>`).join(" ")}</p>` : ""}
      <p style="margin:.5rem 0 0"><a class="btn" href="#/concordance?q=${encodeURIComponent(d.id)}">In context →</a>
      <a class="btn" href="#/map?t=concept&q=${encodeURIComponent(d.id)}">Map this concept →</a></p>`;
  };
  drawGraph(body.querySelector("#tgraph"), nodes, edges, { onPick: show, onHover: show });
  body.querySelector("#tgraph").insertAdjacentHTML("beforeend", unitLegend(new Set(nodes.map(n => n.unit))));
}

/* ------------------------------------------------------------ concept */
function tabConcept(body, qs) {
  const q = (qs.get("q") || "").trim();
  body.append(el(`<div>
    <p class="readable">Give the map a concept and it charts the company the word keeps: the terms
    over-represented on the very pages where it occurs, weighed by log-likelihood against the rest of what
    you have open, joined where they share those pages. Computed entirely in your browser, from your own
    copies; every node leads back to the concordance, so the map never has to be taken on trust.</p>
    <div id="cbody"></div>
  </div>`));
  const cb = body.querySelector("#cbody");

  if (!C.isOpen()) {
    const b = el(`<div class="locked"><strong>Full text not shipped</strong>
      <p style="margin:.3rem 0 .9rem;font-size:.9rem">The concept map reads the chapter files you open. The
      book is a free download; open one block or all of them, and they stay on this device.</p>
      <button class="primary">Open your own copies</button></div>`);
    b.querySelector("button").onclick = openUnlock;
    cb.append(b); return;
  }

  cb.append(el(`<div>
    <div class="toolbar">
      <input type="search" id="mq" class="grow" placeholder="A word or phrase — uranium, jet, penicillin…"
        value="${esc(q)}" autocomplete="off">
      <button class="primary" id="mgo">Map</button>
    </div>
    <p class="fine">${nf(C.coverage())} pages open, from ${corpus.files.length}
      file${corpus.files.length === 1 ? "" : "s"} — the map covers those pages and no others.</p>
    <div id="mstat" class="fine"></div>
    <div class="chartbox" id="cgraph" hidden></div>
    <div id="clist"></div>
  </div>`));
  const input = cb.querySelector("#mq");
  const go = () => { if (input.value.trim()) location.hash = `#/map?t=concept&q=${encodeURIComponent(input.value.trim())}`; };
  cb.querySelector("#mgo").onclick = go;
  input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  if (!q) return;

  const res = C.collocates(q, { top: 24, drop: NOISE });
  const stat = cb.querySelector("#mstat"), gbox = cb.querySelector("#cgraph"), list = cb.querySelector("#clist");
  if (!res || !res.pages) { stat.textContent = `No occurrence of “${q}” in the files you have open.`; return; }
  stat.textContent = `“${q}” stands on ${nf(res.pages)} of the open pages. ` +
    `${res.nodes.length} companions, strongest first.`;

  const us = sachUnits();
  const ui = nr => us.findIndex(u => u.nr === nr);
  const maxLL = Math.max(...res.nodes.map(n => n.ll), 1);
  const nodes = [{ id: q, label: q, r: 15, color: "var(--acc)", seed: true }].concat(
    res.nodes.map(n => ({ id: n.w, label: n.w, ll: n.ll, shared: n.on.length, unit: n.unit,
      r: 4.5 + 9 * Math.sqrt(n.ll / maxLL), color: n.unit != null && ui(n.unit) >= 0 ? unitColor(ui(n.unit)) : "var(--fg3)" })));
  const edges = res.nodes.map((n, i) => ({ a: 0, b: i + 1, s: 0.6 + 1.4 * n.ll / maxLL }))
    .concat(res.links.map(l => ({ a: l.a + 1, b: l.b + 1, s: 0.5 })));

  gbox.hidden = false;
  const pick = d => { if (!d.seed) location.hash = `#/map?t=concept&q=${encodeURIComponent(d.id)}`; };
  drawGraph(gbox, nodes, edges, { onPick: pick });
  gbox.insertAdjacentHTML("beforeend",
    unitLegend(new Set(res.nodes.map(n => n.unit).filter(x => x != null))).replace("click a term", "click a companion to map it"));

  list.innerHTML = `<div class="termlist" style="margin-top:1rem">${res.nodes.map(n => {
    const j = ui(n.unit), u = j >= 0 ? us[j] : null;
    return `<div class="termrow"><div class="th">
      <a class="tw" href="#/map?t=concept&q=${encodeURIComponent(n.w)}">${esc(n.w)}</a>
      <span class="fine">G² ${n.ll.toFixed(0)} · shares ${nf(n.on.length)} page${n.on.length === 1 ? "" : "s"} with “${esc(q)}”${
        u ? ` · mostly ${u.art === "appendix" ? "App." : "Ch."} ${esc(u.nr)}` : ""} ·
        <a href="#/concordance?q=${encodeURIComponent(n.w)}">context →</a></span></div></div>`;
  }).join("")}</div>
  <p class="fine" style="margin-top:.8rem">Sharing a page is the whole of what a line asserts. The gap at
  printed pages 4873–5074 — if you have not opened a file that covers it — is invisible to this map, as to
  the concordance.</p>`;
}

/* ------------------------------------------------------------ figures */
function tabFigures(body) {
  const net = D.network || { nodes: [], edges: [] };
  const deg = new Map();
  net.edges.forEach(e => { deg.set(e.a, (deg.get(e.a) || 0) + e.w); deg.set(e.b, (deg.get(e.b) || 0) + e.w); });
  const idx = new Map(net.nodes.map((n, i) => [n, i]));
  const nodes = net.nodes.map(n => ({ id: n, label: n, r: 4 + Math.sqrt(deg.get(n) || 1) * 1.6, color: "var(--acc2)" }));
  const edges = net.edges.map(e => ({ a: idx.get(e.a), b: idx.get(e.b), s: 0.5 + e.w / 8, w: e.w }));

  body.append(el(`<div>
    <p class="readable">${nf(net.nodes.length)} names joined when the book names them in the same figure
    caption — a narrower window than a page and correspondingly more meaningful, though it still records
    only co-naming, not collaboration or acquaintance. The names are extracted, not authored: a few nodes
    are phrases the extractor took for people, and they are left standing rather than silently tidied.</p>
    <div class="chartbox" id="fgraph"></div>
    <div class="panel" id="finfo"><span class="fine">Click a name to look it up in the register.</span></div>
  </div>`));
  const info = body.querySelector("#finfo");
  drawGraph(body.querySelector("#fgraph"), nodes, edges, {
    onPick: d => { location.hash = `#/register?q=${encodeURIComponent(d.id)}`; },
    onHover: d => {
      const co = net.edges.filter(e => e.a === d.id || e.b === d.id)
        .sort((x, y) => y.w - x.w).map(e => `${esc(e.a === d.id ? e.b : e.a)} <b>${e.w}</b>`);
      info.innerHTML = `<span style="font-family:var(--serif);font-size:1.1rem">${esc(d.id)}</span>
        <span class="fine"> — captioned with: ${co.join(", ") || "no one"}</span>`;
    },
  });
  body.querySelector("#fgraph").insertAdjacentHTML("beforeend",
    `<div class="legend"><span class="fine">drag to move · wheel to zoom · click a name for the register</span></div>`);
}
