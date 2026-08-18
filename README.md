# Forgotten Creators — a research apparatus

Indexes Todd H. Rider, *Forgotten Creators: How German-Speaking Scientists and
Engineers Invented the Modern World* (edition of 31 December 2025), offered as a
free download at [riderinstitute.org](https://riderinstitute.org/revolutionary-innovation/).

**No running text of the book is in this repository.** Free to download is not
free to redistribute, and no licence granting redistribution is stated. What
ships under `data/` is derived: twelve chapters and five appendices with printed
page ranges and counts, 114 sections, term distributions, log-likelihood keyness,
a register of 592 people, the figure-caption co-occurrence network, and 1,382
bibliography entries.

## What was awkward, and how it was handled

The book is distributed as size-balanced blocks of about ninety megabytes, not
one file per chapter — a single block may hold the end of one chapter, two whole
chapters and the start of an appendix — and the blocks carry **no bookmarks**.
The outline is lost in the splitting.

The structure was therefore rebuilt from the running heads, which give the
printed page on every page and the section title on most. The same mechanism
places a file the reader drops in: the file names are opaque identifiers, so the
apparatus reads the pages and works out which stretch of the book it has been
given. Open one block or twenty; the concordance covers whatever is loaded.

## The gap

Printed pages **4873–5074** — 202 pages inside Appendix D — were in none of the
files available when this was built. Every number here excludes them, and the
site says so on the overview and in the method page rather than letting the
absence read as evidence.

## Deployment

Netlify, straight from this repository; `netlify.toml` publishes the root and
picks up `netlify/functions/`. No build step, no dependencies.

The dialogue needs Anthropic credentials: on a logged-in, credit-based Netlify
account the **AI Gateway** injects them — enable it under *Project configuration
→ AI Gateway*. Everything else works without it, since structure, register,
vocabulary, bibliography and the concordance are entirely local.

## Limits

On the site's *Method* page, at length: the register is extracted rather than
authored and thins out below the top ranks; the page anchors are tied to this
edition; the bibliography parser reads one pattern; and the book covers research
conducted under National Socialism, which this apparatus indexes without weighing.

Unaffiliated with Todd H. Rider and the Rider Institute.
