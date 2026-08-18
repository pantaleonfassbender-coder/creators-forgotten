/* Netlify Function — citation-bound answering over the reader's own copies.
   Netlify's AI Gateway injects ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL.
   Nothing is stored or logged. */

const MODEL = process.env.DIALOG_MODEL || "claude-sonnet-4-6";
const FALLBACK = ["claude-sonnet-4-5", "claude-3-7-sonnet-latest"];

const BASE = `You are a research instrument for one book: Todd H. Rider, "Forgotten Creators: How German-Speaking Scientists and Engineers Invented the Modern World, And What We Can Learn from Them" (edition of 31 December 2025), a survey of more than six thousand pages across twelve chapters and five appendices.

Binding rules:
1. Answer ONLY from the passages supplied. What is not in them, you do not assert — not even where you believe you know it. If the passages are thin, say so and name what is missing.
2. Attach a citation to every substantive claim, in the exact form given with each passage: [D.4, p. 3551]. Never invent a page or a section number.
3. Quote at most a short phrase — roughly a dozen words — in quotation marks with a citation. Otherwise paraphrase.
4. Distinguish what the book asserts from what its sources assert. It quotes archival documents, intelligence reports and postwar testimony at length, and a passage reproducing such a document is evidence of what the document says, not of what happened. Where a passage is a quotation, say so.
5. This matters especially for the appendices. Much of the material concerns research under National Socialism, including claims about German wartime nuclear work that are contested in the historical literature. Where the passages present a claim as established, report that they do so — and do not upgrade a contested claim into a settled one, or launder a document's assertion into a fact.
6. Name people precisely where the passages do. The book is a prosopography and its point is attribution, so a claim about who did what should carry the name and the citation.
7. Do not supply historical or moral judgement the passages do not contain, and do not omit the context they do contain. Where work was carried out under the regime, using forced labour or in the service of weapons programmes, and the passages say so, say so.
8. Scholarly English. Two to five paragraphs. Where it is useful, close with the passage a reader should go to next.`;

const MODES = {
  scholarly: "\n\nRegister: cautious and source-critical. Mark the limits of what the passages establish.",
  prosopographic: "\n\nRegister: prosopographic. Organise the answer around the people the passages name — who is credited with what, and on whose authority.",
  critical: "\n\nRegister: critical. Separate what the passages establish from what they assert, and name the places where the evidence offered is a document's claim rather than a corroborated finding.",
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Malformed JSON." }, 400); }

  const frage = String(body.frage || "").slice(0, 4000).trim();
  const modus = MODES[body.modus] ? body.modus : "scholarly";
  const passagen = Array.isArray(body.passagen) ? body.passagen.slice(0, 20) : [];
  const verlauf = Array.isArray(body.verlauf) ? body.verlauf.slice(-6) : [];

  if (frage.length < 5) return json({ error: "Send a formulated question." }, 400);
  if (!passagen.length) return json({ error: "No passages supplied." }, 400);

  const key = process.env.ANTHROPIC_API_KEY;
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  if (!key) {
    return json({
      error: "No access to the Anthropic endpoint is configured. In Netlify, enable AI Gateway under " +
             "Project configuration → AI Gateway. The concordance and everything else work regardless."
    }, 503);
  }

  const context = passagen.map((p, i) =>
    `[${i + 1}] ${p.zitat}${p.werk ? ` — ${p.werk}` : ""}\n${String(p.text || "").slice(0, 2600)}`
  ).join("\n\n---\n\n");

  const messages = [];
  for (const m of verlauf.slice(0, -1)) {
    if (!m || !m.text) continue;
    messages.push({ role: m.rolle === "user" ? "user" : "assistant", content: String(m.text).slice(0, 1600) });
  }
  messages.push({ role: "user", content: `PASSAGES\n\n${context}\n\n---\n\nQUESTION\n${frage}` });

  const payload = { model: MODEL, max_tokens: 1800, temperature: 0.2,
                    system: BASE + MODES[modus], messages };

  let last = "";
  for (const model of [MODEL, ...FALLBACK]) {
    payload.model = model;
    try {
      const r = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const d = await r.json();
        const antwort = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
        return json({ antwort: antwort || "(empty answer)", modell: model, passagen: passagen.length });
      }
      last = `${r.status} ${(await r.text()).slice(0, 300)}`;
      if (r.status !== 404 && r.status !== 400) break;
    } catch (e) { last = String(e && e.message ? e.message : e); break; }
  }
  return json({ error: "The answering endpoint reports: " + last }, 502);
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = { path: "/.netlify/functions/dialogue" };
