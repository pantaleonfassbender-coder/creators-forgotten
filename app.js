/* app.js — router, data and views. */
import * as C from "./corpus.js";
import { corpus } from "./corpus.js";
import { renderDialogue } from "./dialogue.js";

export const D = {};
const view = document.getElementById("view");

export const esc = s => String(s ?? "").replace(/[&<>"']/g, m =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const nf = n => new Intl.NumberFormat("en-GB").format(n);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const HUE = ["#c9a227", "#9db8a4", "#c07a5a", "#a89bc4", "#7fa9c9", "#c9968f", "#8fb3a0",
  "#b9a06a", "#a0b6c9", "#c4a0b4", "#93a97f", "#c98f6a", "#8aa8b8", "#b8a2c9",
  "#c9b98f", "#9fc0a8", "#c98f8f"];
const unitColor = i => HUE[i % HUE.length];
const unitOf = nr => (D.units || []).find(u => String(u.nr) === String(nr));
const sachUnits = () => (D.units || []).filter(u => u.art !== "apparat");

async function boot() {
  const names = ["korpus", "units", "sections", "terms", "keyness", "persons", "network", "biblio"];
  const res = await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => r.json())));
  names.forEach((n, i) => D[n] = res[i]);
  try { await C.restore(D.units, D.sections); } catch (e) { console.warn("restore failed", e); }
  refreshBadge(); drawFileTable();
  window.addEventListener("hashchange", route);
  route();
}

const ROUTES = {
  overview: viewOverview, parts: viewParts, sections: viewSections,
  register: viewRegister, vocabulary: viewVocabulary, references: viewReferences,
  concordance: viewConcordance, method: viewMethod, privacy: viewPrivacy, imprint: viewImprint,
  dialogue: a => renderDialogue(view, a),
};
function route() {
  const h = (location.hash || "#/overview").slice(2).split("/");
  const name = (h[0] || "overview").split("?")[0];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.v === name));
  view.innerHTML = ""; window.scrollTo(0, 0);
  (ROUTES[name] || viewOverview)(h.slice(1));
}

export function citeChip(cite) {
  if (!cite) return "";
  return `<a class="cite" href="#/parts/${cite.unit}" title="${esc(cite.secTitel || cite.unitTitel)}">${esc(cite.label)}</a>`;
}
function unitBars(values, { height = 46, labels = false } = {}) {
  const us = sachUnits();
  const max = Math.max(1, ...values);
  return `<div class="volbars" style="--h:${height}px">${values.map((v, i) => {
    const u = us[i];
    return `<div class="vb" title="${u.art === "appendix" ? "Appendix " : "Chapter "}${esc(u.nr)} · ${esc(u.titel)} · ${nf(v)}">
      <i style="height:${Math.round(v / max * height)}px;background:${unitColor(i)}"></i>
      ${labels ? `<span>${esc(u.nr)}</span>` : ""}</div>`;
  }).join("")}</div>`;
}
function gapNote() {
  const g = (D.korpus.gaps || [])[0];
  if (!g) return "";
  return `<div class="gapbox"><strong>One stretch of the book is missing here.</strong> Printed pages
    ${g[0]}–${g[1]} — ${g[1] - g[0] + 1} pages inside Appendix D — are in none of the chapter files this
    apparatus was built from. Everything derived below is derived without them: counts, term
    distributions and the register do not include those pages, and a concordance search will not find
    what stands on them. A further file from the publisher's page would close the gap.</div>`;
}

/* ============================================================ OVERVIEW */
function viewOverview() {
  const k = D.korpus, us = sachUnits();
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Research apparatus</span>
      <h1>Forgotten Creators</h1>
      <p class="lede">Todd H. Rider's survey of German-speaking scientists and engineers runs to more than
      six thousand printed pages across twelve chapters and five appendices — closer to a reference work
      than to a book one reads through. This apparatus indexes it so that a question can be taken to it:
      what is where, who appears, and on which page.</p></div>

    <div class="grid g4" style="margin-bottom:1.6rem">
      <div class="kpi"><b>12</b><span>chapters</span></div>
      <div class="kpi"><b>5</b><span>appendices</span></div>
      <div class="kpi"><b>${nf(k.printed_to)}</b><span>printed pages</span></div>
      <div class="kpi"><b>${nf(k.sections)}</b><span>sections</span></div>
      <div class="kpi"><b>${nf(k.figures)}</b><span>figures</span></div>
      <div class="kpi"><b>${nf(k.persons)}</b><span>people in the register</span></div>
      <div class="kpi"><b>${nf(k.references)}</b><span>works cited</span></div>
      <div class="kpi"><b>${nf(k.tokens)}</b><span>running words</span></div>
    </div>

    ${gapNote()}

    <div class="grid g2" style="margin:1.4rem 0 2rem">
      <div class="card">
        <span class="tag">What is here without anything further</span>
        <h3>The apparatus</h3>
        <p style="font-size:.92rem;color:var(--fg2)">Chapter and appendix structure, all 114 sections with
        their page ranges, term distributions, a register of the people the book names, the network in
        which they appear together, and its bibliography. Derived data throughout — no running text.</p>
        <p><a class="btn" href="#/parts">Browse the parts →</a></p>
      </div>
      <div class="card" id="unlockCard">
        <span class="tag">What needs your own copies</span>
        <h3>Concordance and evidence</h3>
        <p style="font-size:.92rem;color:var(--fg2)">The book is a free download, offered in blocks by
        chapter. Open the blocks you care about and the concordance, page citation of hits and the evidence
        mode of the dialogue extend across whatever you have loaded — one chapter or all of them.</p>
        <div id="unlockCardState"></div>
        <button class="primary" id="startUnlock">Open your own copies</button>
      </div>
    </div>

    <h2>Chapters</h2>
    <div class="grid g3" id="chlist" style="margin-bottom:1.8rem"></div>
    <h2>Appendices</h2>
    <div class="grid g3" id="aplist" style="margin-bottom:2.2rem"></div>

    <div class="grid g2">
      <div class="chartbox">
        <span class="tag">Extent by part, in running words</span>
        ${unitBars(us.map(u => u.tokens), { height: 78, labels: true })}
        <p class="fine">Appendix D on nuclear engineering is the largest single body of text in the book —
        more than a third of it, and larger than all twelve chapters together.</p>
      </div>
      <div class="chartbox">
        <span class="tag">Figures by part</span>
        ${unitBars(us.map(u => u.abbildungen), { height: 78, labels: true })}
        <p class="fine">${nf(k.figures)} numbered figures in all. The book argues in large part through
        photographs, documents and diagrams, which is why the files are as heavy as they are.</p>
      </div>
    </div>
  </div>`));

  const ch = view.querySelector("#chlist"), ap = view.querySelector("#aplist");
  us.forEach((u, i) => {
    const card = el(`<div class="workcard" style="border-top:3px solid ${unitColor(i)}">
      <h3>${u.art === "appendix" ? "Appendix" : "Chapter"} ${esc(u.nr)}</h3>
      <p style="font-size:.9rem;color:var(--fg2);margin:.2rem 0 .4rem">${esc(u.titel.replace(/^Creators and Creations in /, "").replace(/^Advanced Creations in /, ""))}</p>
      <p class="fine" style="margin:0">pp. ${nf(u.seite_von)}–${nf(u.seite_bis)} · ${nf(u.tokens)} words ·
      ${nf(u.abbildungen)} figures</p>
    </div>`);
    card.onclick = () => location.hash = `#/parts/${u.nr}`;
    (u.art === "appendix" ? ap : ch).append(card);
  });
  view.querySelector("#startUnlock").onclick = openUnlock;
  refreshUnlockCard();
}

/* =============================================================== PARTS */
function viewParts(args) {
  if (args && args[0]) return viewPart(args[0]);
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Structure</span>
      <h1>Chapters and appendices</h1>
      <p class="lede">The book's own division, with the measures computed from each part. The appendices are
      not an afterthought here: together they are three times the length of the chapters.</p></div>
    <table class="tbl" id="pt"><thead><tr>
      <th>Part</th><th>Title</th><th class="num">Pages</th><th class="num">Sections</th>
      <th class="num">Words</th><th class="num">Figures</th><th class="num">TTR</th></tr></thead><tbody></tbody></table>
  </div>`));
  const tb = view.querySelector("#pt tbody");
  D.units.forEach((u, i) => {
    const nsec = D.sections.filter(s => s.unit === u.nr).length;
    const tr = el(`<tr>
      <td><span class="swatch" style="background:${u.art === "apparat" ? "var(--line2)" : unitColor(sachUnits().indexOf(u))}"></span>
        ${u.art === "appendix" ? "App. " : (u.art === "apparat" ? "" : "Ch. ")}${esc(u.nr === "BIB" || u.nr === "FIG" ? "" : u.nr)}</td>
      <td>${esc(u.titel)}</td>
      <td class="num">${nf(u.seite_von)}–${nf(u.seite_bis)}</td>
      <td class="num">${nsec || "–"}</td>
      <td class="num">${nf(u.tokens)}</td>
      <td class="num">${nf(u.abbildungen)}</td>
      <td class="num">${u.ttr.toFixed(3)}</td></tr>`);
    if (u.art !== "apparat") tr.onclick = () => location.hash = `#/parts/${u.nr}`;
    tb.append(tr);
  });
}

function viewPart(nr) {
  const u = unitOf(nr);
  if (!u) { location.hash = "#/parts"; return; }
  const i = sachUnits().indexOf(u);
  const secs = D.sections.filter(s => s.unit === u.nr);
  const keys = (D.keyness || {})[u.nr] || [];
  const leute = D.persons.filter(p => i >= 0 && p.dist[i] > 0).sort((a, b) => b.dist[i] - a.dist[i]);
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">${u.art === "appendix" ? "Appendix" : "Chapter"} ${esc(u.nr)}</span>
      <h1>${esc(u.titel)}</h1>
      <p class="lede">Printed pages ${nf(u.seite_von)} to ${nf(u.seite_bis)} · ${nf(u.tokens)} running words ·
      ${nf(u.abbildungen)} figures · ${secs.length} sections.</p></div>

    <div class="grid g4" style="margin-bottom:1.4rem">
      <div class="kpi"><b>${nf(u.pdf_seiten)}</b><span>pages indexed</span></div>
      <div class="kpi"><b>${nf(u.types)}</b><span>word forms</span></div>
      <div class="kpi"><b>${u.ttr.toFixed(3)}</b><span>type–token ratio</span></div>
      <div class="kpi"><b>${nf(u.sentences)}</b><span>sentences</span></div>
    </div>

    ${keys.length ? `<div class="panel"><h2>What is distinctive here</h2>
      <p class="readable">Log-likelihood keyness against the rest of the book.</p>
      <div class="chips">${keys.slice(0, 26).map(([w, s]) =>
        `<a class="chip" href="#/concordance?q=${encodeURIComponent(w)}">${esc(w)} <b>${s.toFixed(0)}</b></a>`).join("")}</div>
    </div>` : ""}

    ${secs.length ? `<div class="panel"><h2>Sections</h2>
      <ul class="seclist">${secs.map(s => `<li>
        <span class="sk">${esc(s.key)}</span>
        <span style="flex:1">${esc(s.titel)}</span>
        <span class="fine">pp. ${nf(s.von)}–${nf(s.bis)}</span></li>`).join("")}</ul>
    </div>` : ""}

    ${leute.length ? `<div class="panel"><h2>Who appears most here</h2>
      <div class="chips">${leute.slice(0, 24).map(p =>
        `<a class="chip" href="#/register?q=${encodeURIComponent(p.name)}">${esc(p.name)} <b>${p.dist[i]}</b></a>`).join("")}</div>
    </div>` : ""}
  </div>`));
}

/* ============================================================ SECTIONS */
function viewSections() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Contents</span>
      <h1>All ${nf(D.sections.length)} sections</h1>
      <p class="lede">Recovered from the running heads, since the chapter files carry no bookmarks. Filter by
      title, or narrow to one part.</p></div>
    <div class="toolbar">
      <input type="search" id="sq" placeholder="Filter by title…" autocomplete="off">
      <select id="su"><option value="">All parts</option>
        ${sachUnits().map(u => `<option value="${esc(u.nr)}">${u.art === "appendix" ? "App." : "Ch."} ${esc(u.nr)} · ${esc(u.titel.slice(0, 38))}</option>`).join("")}
      </select>
    </div>
    <table class="tbl" id="st"><thead><tr><th>§</th><th>Section</th><th>Part</th>
      <th class="num">Pages</th></tr></thead><tbody></tbody></table>
    <p class="fine" id="sc"></p>
  </div>`));
  const q = view.querySelector("#sq"), sel = view.querySelector("#su");
  const tb = view.querySelector("#st tbody"), cnt = view.querySelector("#sc");
  const draw = () => {
    const t = q.value.trim().toLowerCase(), u = sel.value;
    const rows = D.sections.filter(s => (!t || s.titel.toLowerCase().includes(t)) && (!u || s.unit === u));
    tb.innerHTML = rows.map(s => {
      const un = unitOf(s.unit);
      return `<tr><td class="mono">${esc(s.key)}</td><td>${esc(s.titel)}</td>
        <td class="fine">${un ? esc(un.titel.slice(0, 34)) : ""}</td>
        <td class="num">${nf(s.von)}–${nf(s.bis)}</td></tr>`;
    }).join("");
    cnt.textContent = `${rows.length} of ${D.sections.length} sections`;
  };
  q.oninput = debounce(draw, 120); sel.onchange = draw; draw();
}

/* ============================================================ REGISTER */
function viewRegister() {
  const pre = new URLSearchParams((location.hash.split("?")[1] || "")).get("q") || "";
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Register</span>
      <h1>The people the book names</h1>
      <p class="lede">${nf(D.persons.length)} names, extracted from the text and filtered — see the
      <a href="#/method">method page</a> for how, and for what the filter still lets through. The book is a
      prosopography above all, so this is its most useful index and its least exact one.</p></div>
    <div class="toolbar"><input type="search" id="pq" placeholder="Find a name…" value="${esc(pre)}" autocomplete="off"></div>
    <div id="pl" class="termlist"></div>
  </div>`));
  const q = view.querySelector("#pq"), list = view.querySelector("#pl");
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    const rows = D.persons.filter(p => !t || p.name.toLowerCase().includes(t)).slice(0, 120);
    list.innerHTML = rows.map(p => `<div class="termrow"><div class="th">
      <a class="tw" href="#/concordance?q=${encodeURIComponent(p.key)}">${esc(p.name)}</a>
      <span class="fine">${nf(p.f)} mentions · ${nf(p.seiten)} pages · ${p.einheiten} of 17 parts</span></div>
      ${unitBars(p.dist)}</div>`).join("") || `<p class="fine">No entry matches.</p>`;
  };
  q.oninput = debounce(draw, 120); draw();
}

/* ========================================================== VOCABULARY */
function viewVocabulary() {
  const entries = Object.entries(D.terms).sort((a, b) => b[1].f - a[1].f);
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Vocabulary</span>
      <h1>Where the words sit</h1>
      <p class="lede">The ${entries.length} most frequent content words across the seventeen substantive
      parts. Apparatus — bibliography and figure credits — is excluded from the counts.</p></div>
    <div class="toolbar"><input type="search" id="tq" placeholder="Find a word…" autocomplete="off"></div>
    <div id="tl" class="termlist"></div>
  </div>`));
  const q = view.querySelector("#tq"), list = view.querySelector("#tl");
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    list.innerHTML = entries.filter(([w]) => !t || w.includes(t)).slice(0, 110).map(([w, d]) =>
      `<div class="termrow"><div class="th">
        <a class="tw" href="#/concordance?q=${encodeURIComponent(w)}">${esc(w)}</a>
        <span class="fine">${nf(d.f)} occurrences · ${d.einheiten} of 17 parts</span></div>
        ${unitBars(d.dist)}</div>`).join("");
  };
  q.oninput = debounce(draw, 120); draw();
}

/* ========================================================== REFERENCES */
function viewReferences() {
  const b = D.biblio;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Bibliography</span>
      <h1>What the book cites</h1>
      <p class="lede">${nf(b.length)} entries parsed from its bibliography, which runs to more than four
      hundred printed pages on its own.</p></div>
    <div class="toolbar">
      <input type="search" id="bq" placeholder="Author, title or venue…" autocomplete="off">
      <select id="by"><option value="">Any year</option>
        <option value="2000">2000 and later</option><option value="1990">1990 and later</option>
        <option value="1945">1945 and later</option><option value="0-1945">before 1945</option></select>
    </div>
    <div id="bl" class="biblist"></div><p class="fine" id="bc"></p>
  </div>`));
  const q = view.querySelector("#bq"), y = view.querySelector("#by");
  const list = view.querySelector("#bl"), cnt = view.querySelector("#bc");
  const draw = () => {
    const t = q.value.trim().toLowerCase(), yv = y.value;
    const rows = b.filter(e => {
      const jahr = parseInt(String(e.jahr).slice(0, 4), 10) || 0;
      const okY = !yv ? true : (yv === "0-1945" ? jahr && jahr < 1945 : jahr >= parseInt(yv, 10));
      return (!t || (e.autoren + " " + e.titel).toLowerCase().includes(t)) && okY;
    });
    list.innerHTML = rows.slice(0, 300).map(e => `<div class="bib">
      <span class="ba">${esc(e.autoren)}</span> <span class="bj">${esc(e.jahr)}</span>
      ${esc(e.titel)}</div>`).join("");
    cnt.textContent = `${rows.length} of ${b.length}${rows.length > 300 ? " · first 300 shown" : ""}`;
  };
  q.oninput = debounce(draw, 150); y.onchange = draw; draw();
}

/* ========================================================= CONCORDANCE */
function viewConcordance() {
  const pre = new URLSearchParams((location.hash.split("?")[1] || "")).get("q") || "";
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Concordance</span>
      <h1>Keyword in context</h1>
      <p class="lede">Searches whatever you have opened, and cites each hit by section and printed page.
      Nothing is sent anywhere.</p></div>
    <div class="toolbar"><input type="search" id="cq" placeholder="A word or phrase…" value="${esc(pre)}" autocomplete="off"></div>
    <div id="cs" class="fine"></div><div id="cd"></div><div id="co"></div>
  </div>`));
  const q = view.querySelector("#cq"), out = view.querySelector("#co");
  const dist = view.querySelector("#cd"), stat = view.querySelector("#cs");
  if (!C.isOpen()) {
    const b = el(`<div class="locked"><strong>Full text not shipped</strong>
      <p style="margin:.3rem 0 .9rem;font-size:.9rem">The concordance reads the chapter files you open. The
      book is a free download; open one block or all of them, and they stay on this device.</p>
      <button class="primary">Open your own copies</button></div>`);
    b.querySelector("button").onclick = openUnlock;
    out.append(b); return;
  }
  stat.textContent = `${nf(C.coverage())} pages open, from ${corpus.files.length} file${corpus.files.length === 1 ? "" : "s"}.`;
  const draw = () => {
    const t = q.value.trim();
    if (t.length < 2) { out.innerHTML = ""; dist.innerHTML = ""; return; }
    const counts = C.hitCounts(t);
    dist.innerHTML = `<div class="chartbox"><span class="tag">Distribution across the parts</span>
      ${unitBars(sachUnits().map(u => counts[u.nr] || 0), { height: 56, labels: true })}</div>`;
    const hits = C.kwic(t, { limit: 300 });
    out.innerHTML = hits.length
      ? `<p class="fine">${hits.length}${hits.length >= 300 ? " (first 300)" : ""} occurrences</p>
         <table class="kwic"><tbody>${hits.map(h => `<tr>
           <td class="l">${esc(h.l)}</td><td class="k">${esc(h.k)}</td>
           <td class="r">${esc(h.r)}</td><td class="c">${citeChip(h.cite)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="fine">No occurrence in the files you have open.</p>`;
  };
  q.oninput = debounce(draw, 220);
  if (pre) draw();
}

/* ============================================================== METHOD */
function viewMethod() {
  const g = (D.korpus.gaps || [])[0];
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Transparency</span>
      <h1>Method, sources and limits</h1>
      <p class="lede">What was computed, from what, and where the results do not carry.</p></div>

    <div class="panel"><h2>Rights, and what follows from them</h2>
      <p class="readable">The book is offered as a free download by its author. Free to download is not the
      same as free to redistribute, and no licence granting redistribution is stated. This site therefore
      ships none of its running text: only derived data — structure, page anchors, counts, distributions,
      registers, bibliography — together with editorial matter written here. The full-text functions run
      against files the reader fetches from the author's own page.</p>
    </div>

    <div class="panel"><h2>How the structure was recovered</h2>
      <p class="readable">The book is distributed as size-balanced blocks of roughly ninety megabytes, not
      as one file per chapter: a single block may carry the end of one chapter, two whole chapters and the
      start of an appendix. Worse for an indexer, the blocks carry <strong>no bookmarks</strong> — the
      outline is lost in the splitting.</p>
      <p class="readable">What survives is the running head, which gives the printed page number on every
      page and the section title on most. The structure here was rebuilt from those: seventeen substantive
      parts, ${nf(D.korpus.sections)} sections with their page ranges, and a printed-page anchor for every
      page. Where a page carries no running head, a constant offset fitted per block places it rather than
      dropping it.</p>
      <p class="readable">The same running heads are what let a dropped file be placed. The file names are
      opaque identifiers, so the apparatus reads the pages instead and works out which stretch of the book
      it has been given.</p>
    </div>

    ${g ? `<div class="panel"><h2>The gap</h2>
      <p class="readable">Printed pages <strong>${g[0]} to ${g[1]}</strong> — ${g[1] - g[0] + 1} pages
      inside Appendix D, on nuclear engineering — were not in any file available when this was built. They
      are missing from every number on this site: the word counts, the term distributions, the register and
      the network all exclude them, and a concordance search cannot find what stands there.</p>
      <p class="readable">This is stated rather than smoothed over because a gap in the middle of the
      longest appendix is exactly the kind of thing that would otherwise be read as absence of evidence. If
      the missing block is fetched from the author's page, the concordance will pick it up as soon as it is
      opened — but the shipped statistics would have to be rebuilt.</p>
    </div>` : ""}

    <div class="panel"><h2>Text repair</h2>
      <p class="readable">The typesetting scatters spaces inside words — <span class="mono">INNOV ATION</span>,
      <span class="mono">ADV ANCED</span>, <span class="mono">W A VES</span> — and renders accents as a
      separate character, so that Schönbauer arrives as <span class="mono">Sch¨ onbauer</span>. Accents are
      recombined mechanically. The broken words are repaired against the book's own vocabulary: two parts
      are joined only when the whole is a word the book uses elsewhere and at least one part is not. Where
      the fault is systematic enough that the whole word never appears intact, a short list of fragments
      that cannot stand alone in a title closes the remainder. All ${nf(D.korpus.sections)} section titles
      come out clean; the body text will still hold cases that were not worth chasing.</p>
    </div>

    <div class="panel"><h2>The register, and how much to trust it</h2>
      <p class="readable">The book is a prosopography: its argument runs largely through figure captions
      naming who did what. The register is therefore the most useful index it can have — and the least
      exact, because the names are extracted rather than authored.</p>
      <p class="readable">Candidates are capitalised name-shaped sequences. Institutions, projects, places,
      awards and archival phrases are removed by a vocabulary of generic words, and a further test does most
      of the work: a real given name occurs before many different surnames across the book, while
      <em>Naval</em>, <em>Wartime</em> and <em>Folder</em> do not. A candidate whose first word never
      behaves like a given name is dropped unless it is very frequent.</p>
      <p class="readable">What remains is good at the top and thins out below. Expect roughly one entry in a
      hundred to be a phrase rather than a person, and expect people mentioned once or twice to be missing
      entirely — the threshold is six mentions. Treat it as a finding aid, not an index.</p>
    </div>

    <div class="panel"><h2>Counts, keyness, network</h2>
      <p class="readable">Counts cover the twelve chapters and five appendices; the bibliography and figure
      credits are indexed for structure but excluded from every statistic. Keyness is log-likelihood against
      the rest of the book — good for what makes a part distinctive, poor as a guide to what it is about.
      Type–token ratio is length-dependent and should not be compared across parts of very different
      extent.</p>
      <p class="readable">Two people are joined in the network when they are named in the same figure
      caption. That is a narrower window than a page and correspondingly more meaningful, but it still
      records only that the book mentions them together — not collaboration, influence or acquaintance.</p>
    </div>

    <div class="panel"><h2>Known limits</h2>
      <ul style="color:var(--fg2);font-size:.93rem">
        <li>The page anchors are tied to the edition of 31 December 2025. An earlier printing — the 2022
          file runs to 5,313 pages against this one's ${nf(D.korpus.printed_to)} — will search but will not
          line up.</li>
        <li>The bibliography parser reads one pattern of author, year and remainder. It reports
          ${nf(D.korpus.references)} entries; unusual ones will be split or joined wrongly.</li>
        <li>Nothing distinguishes the author's claims from the sources he reports. A hit is a hit.</li>
        <li>The book covers research conducted under National Socialism, including work bound up with the
          regime's crimes. This apparatus counts and indexes; it does not weigh. Where the book's framing of
          that material is contested — and parts of it are — the reader has to bring that judgement, because
          nothing here supplies it.</li>
      </ul>
    </div>
  </div>`));
}

/* ===================================================== PRIVACY, IMPRINT */
function viewPrivacy() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Privacy</span>
      <h1>Privacy notice</h1>
      <p class="lede">What this site does with data, at the level of detail at which it is actually true.
      Every claim below describes code you can read in this page's source.</p></div>

    <div class="panel"><h2>Who is responsible</h2>
      <p class="readable">Operated by a private individual from the United States; details in the
      <a href="#/imprint">legal notice</a>. A personal research project, not run on behalf of any
      institution, employer or publisher. Because it is reachable from the European Economic Area, this
      notice is written to satisfy the GDPR as well as United States law; where the GDPR applies, the
      operator is the controller within the meaning of Article 4(7).</p>
    </div>

    <div class="panel"><h2>What this site is, technically</h2>
      <p class="readable">Static files with one server function. No accounts, no login, no contact form, no
      newsletter. <strong>No cookies whatsoever</strong>, no analytics, no tag manager, no advertising, no
      session recording. <strong>Nothing is loaded from third-party servers</strong>: pdf.js is served from
      this site, as are all data files. Opening a page contacts exactly one host — the one in your address
      bar.</p>
    </div>

    <div class="panel"><h2>Server logs</h2>
      <p class="readable">Hosting is by Netlify, whose infrastructure records the requests it serves — IP
      address, timestamp, URL, status, bytes, user-agent and referrer. Unavoidable in delivering a website
      and the only server-side collection here; it serves operation and security, is not analysed by the
      operator, and is retained per Netlify's own periods. Legal basis: Article 6(1)(f) GDPR. The site is
      operated and hosted in the United States, so for readers in the EEA this is processing outside the
      EEA.</p>
    </div>

    <div class="panel"><h2>The files you open</h2>
      <p class="readable">When you open a chapter file, pdf.js reads its text layer inside your browser and
      stores the extracted text — with the file name, the page range it was placed at and the time — in your
      browser's own <strong>IndexedDB</strong> database, named
      <span class="mono">forgotten-creators</span>. The PDFs are never uploaded, and neither is the text: it
      is written to your device, not to any server.</p>
      <p class="readable">Two things follow. The storage is <strong>persistent</strong> — it survives
      closing the tab, the browser and the machine, and these are large files, so it can occupy a
      considerable amount of space. And it is unencrypted, like all browser storage. The button in the top
      right clears everything; clearing site data for this domain does the same.</p>
    </div>

    <div class="panel"><h2>The dialogue — what actually leaves your device</h2>
      <p class="readable">Everything else runs locally. The dialogue is the one function that sends data
      outward, and only when you submit a question. What is sent is precisely this: your question, truncated
      at 4,000 characters; at most twenty retrieved passages, each truncated at 2,600 characters, with their
      citations; and at most the last six turns of the conversation, each truncated at 1,600 characters.</p>
      <p class="readable">The book is never transmitted — only the passages retrieval selects for the
      question in front of you. Since those come from the files you opened, text from your own files does
      leave your device at that moment. The request goes to Anthropic's model through Netlify's AI Gateway,
      so there are two recipients, both in the United States: Netlify Inc. and Anthropic PBC. The answer
      returns to your browser and is written nowhere: the function keeps no log, no database and no copy,
      and its responses carry <span class="mono">cache-control: no-store</span>. Legal basis: Article
      6(1)(b) and (f) GDPR. If you would rather send nothing at all, the structure, sections, register,
      vocabulary and bibliography never leave your browser.</p>
      <p class="readable">Do not paste personal information or anything concerning identifiable third
      parties into the question field. Nothing in this site's design requires it, and the operator has no
      way to retrieve or delete it once sent.</p>
    </div>

    <div class="panel"><h2>Rights of readers in the European Economic Area</h2>
      <p class="readable">Where the GDPR applies you have the rights of access (Art. 15), rectification
      (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20) and objection (Art. 21),
      and the right to complain to a supervisory authority under Article 77. Requests go to the address in
      the <a href="#/imprint">legal notice</a>. The answer will be short: apart from the server logs nothing
      about you is held here, and the text of the book sits on your own device.</p>
      <p class="readable">No representative in the Union has been designated under Article 27, on the
      exemption in Article 27(2)(a): the processing is occasional, involves no large-scale processing of
      special categories of data, and is unlikely to result in a risk to the rights and freedoms of natural
      persons.</p>
    </div>

    <div class="panel"><h2>Notice for California residents</h2>
      <p class="readable">Under CalOPPA (Cal. Bus. &amp; Prof. Code §§ 22575–22579): the information
      collected is network activity information in the form of the server logs above. No name, postal
      address, email address or telephone number is collected — there is no field for them. Text you submit
      in the dialogue is transmitted to the model provider and is not retained by this site. Recipients are
      Netlify Inc. and Anthropic PBC; nothing is sold, rented or shared for marketing. No accounts and no
      stored profiles, so no record to review or amend; text held on your own device can be deleted at any
      time. <strong>Do Not Track:</strong> this site does not track visitors over time or across
      third-party sites and so does not change behaviour on the signal — there is no tracking to disable,
      and no third-party content is loaded. Material changes are posted here with a revised date.</p>
    </div>

    <div class="panel"><h2>Children · Changes</h2>
      <p class="readable">A scholarly instrument addressed to adult readers; not directed to children, and
      no information is knowingly collected from them. Effective 15 August 2026. Where this notice and the
      site's behaviour ever diverge, the notice is wrong and will be corrected — the description follows the
      code, not the other way round.</p>
    </div>
  </div>`));
}

function viewImprint() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Legal notice</span>
      <h1>Legal notice</h1>
      <p class="lede">Who operates this site, and how to reach them.</p></div>
    <div class="panel"><h2>Operator</h2>
      <p class="readable">Dr. Pantaleon Fassbender<br>16751 NE 5th Street<br>Williston, FL 32696<br>United States</p>
      <p class="readable">Email: <a href="mailto:pantaleonfassbender@gmail.com">pantaleonfassbender@gmail.com</a></p>
      <p class="readable">A personal research project, operated and hosted in the United States by a private
      individual, not on behalf of any institution, employer or publisher. No company behind it, no
      advertising, no sponsorship. Responsible for the content: Dr. Pantaleon Fassbender, at the address
      above.</p>
    </div>
    <div class="panel"><h2>Rights in the book</h2>
      <p class="readable">An independent finding aid, <strong>not affiliated with, endorsed by, or connected
      to</strong> Todd H. Rider or the Rider Institute. It contains no running text of the book: only
      derived data and editorial matter written here. Reference: Todd H. Rider, <em>Forgotten Creators: How
      German-Speaking Scientists and Engineers Invented the Modern World, And What We Can Learn from
      Them</em>, edition of 31 December 2025, available at
      <a href="https://riderinstitute.org/revolutionary-innovation/" target="_blank" rel="noopener">riderinstitute.org</a>.
      All rights rest with the author. If you hold rights in this work and consider anything here to exceed
      what derived data and scholarly citation permit, write to the address above and it will be dealt with
      promptly.</p>
    </div>
    <div class="panel"><h2>No warranty</h2>
      <p class="readable">A research instrument offered free of charge and without warranty of any kind. Its
      structure was reconstructed rather than read off, its register was extracted rather than authored, and
      one stretch of the book is missing from every number on it. The limits are set out at length under
      <a href="#/method">Method, sources and limits</a>, and they are part of the tool rather than a
      disclaimer appended to it. Verify anything you intend to publish against the book itself.</p>
    </div>
  </div>`));
}

/* ============================================================ UNLOCKING */
const modal = document.getElementById("unlockModal");
function openUnlock() { modal.hidden = false; drawFileTable(); }
document.getElementById("unlockBtn").onclick = openUnlock;
document.getElementById("closeUnlock").onclick = () => { modal.hidden = true; };
modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });

const input = document.getElementById("pdfInput");
const drop = document.getElementById("drop");
drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => {
  e.preventDefault(); drop.classList.remove("over");
  handleFiles([...e.dataTransfer.files]);
});
input.onchange = () => handleFiles([...input.files]);

async function handleFiles(files) {
  const st = document.getElementById("unlockState");
  const prog = document.getElementById("unlockProgress");
  const fill = document.getElementById("barFill");
  const ptxt = document.getElementById("progressText");
  const done = [];
  for (const file of files) {
    if (file.type && file.type !== "application/pdf") continue;
    st.className = "statebox"; st.textContent = "";
    prog.hidden = false; fill.style.width = "0%";
    ptxt.textContent = `Reading ${file.name} …`;
    try {
      const pages = await C.readPdf(file, (i, n) => {
        fill.style.width = (i / n * 100).toFixed(1) + "%";
        ptxt.textContent = `${file.name} — page ${i} of ${n}`;
      });
      const rec = await C.install(file, pages);
      const u = (D.units || []).find(x => x.seite_von <= rec.von && rec.von <= x.seite_bis);
      done.push(`<span class="ok">${esc(file.name.slice(0, 12))}…</span> placed at pp.
        ${nf(rec.von)}–${nf(rec.bis)}${u ? ` (${u.art === "appendix" ? "Appendix" : "Chapter"} ${esc(u.nr)} onward)` : ""}`);
    } catch (e) {
      done.push(`<span style="color:var(--warn)">${esc(file.name.slice(0, 12))}…</span> ${esc(e.message || e)}`);
    }
  }
  prog.hidden = true;
  st.className = "statebox ok";
  st.innerHTML = done.join("<br>") || "Nothing readable in that drop.";
  refreshBadge(); refreshUnlockCard(); drawFileTable();
}

document.getElementById("forgetBtn").onclick = async () => {
  await C.forgetAll();
  const st = document.getElementById("unlockState");
  st.className = "statebox"; st.textContent = "All stored text cleared.";
  refreshBadge(); refreshUnlockCard(); drawFileTable();
  if (location.hash.startsWith("#/concordance")) route();
};

function drawFileTable() {
  const box = document.getElementById("fileTable");
  if (!box) return;
  box.innerHTML = corpus.files.length
    ? corpus.files.map(f => `<li><span>${esc(f.name.slice(0, 16))}…</span>
        <span class="fine">pp. ${nf(f.von)}–${nf(f.bis)} · ${nf(f.n)} pages</span></li>`).join("")
    : `<li><span class="fine">Nothing open yet.</span></li>`;
}

function refreshBadge() {
  const open = C.isOpen();
  document.getElementById("unlockDot").classList.toggle("on", open);
  document.getElementById("unlockLabel").textContent = open
    ? `${corpus.files.length} file${corpus.files.length === 1 ? "" : "s"} open` : "locked";
}
function refreshUnlockCard() {
  const box = document.getElementById("unlockCardState");
  if (!box) return;
  box.innerHTML = C.isOpen()
    ? `<p class="fine">Open on this device: ${nf(C.coverage())} pages from ${corpus.files.length} file${corpus.files.length === 1 ? "" : "s"}.</p>`
    : "";
}

boot();
