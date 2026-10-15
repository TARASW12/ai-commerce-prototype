# Evidence

Everything measured for this assignment, in the order the brief asks for it.

## Section 1 — Before / baseline

**[`baseline.md`](baseline.md)** — the six questions, run twice each, with a
per-query table and the six distinct failures they exposed.

- `before-withurl/q1.png` … `q6.png` — the baseline proper: each question with
  the source pinned to the merchant's page
- `before-organic/q1-organic-sources.png` — the same question with no source
  restriction, which turns out to answer from a **third party's** prototype
  rather than the merchant's site

**Start with `before-withurl/q2.png`.** It is the baseline's worst failure: the
engine states the price as **$699** — the struck-through list price — for a
program that costs $299.

## Section 2 — Build

Code is the repository. `README.md` has the architecture; `npm run eval`
reproduces the measurement without an API key.

- `after/page-rendered.png` — what the discovery layer actually serves

## Section 3 — Sales / enrolment flow

**[`agent/README.md`](agent/README.md)** — the scenario, step by step.

- `agent/mcp-sales-flow.png` — the three MCP calls and the redirect to the
  merchant's Stripe checkout. Reproduce with `npm run demo`.

## Section 4 — After / proof

**[`after-results.md`](after-results.md)** — same six questions, same engine,
same pinning, and a side-by-side comparison table.

- `after/q1.png` … `q6.png` — the after pass
- `after/00-indexed-confirmation.png` — Perplexity reading the prototype,
  including all four programs and the machine-readable endpoints

**Start with `after/q2.png`** — the same question that produced $699 above now
produces "$299 for the whole program" — and **`after/q5.png`**, where "can I
join?" finally gets an answer about *joining* rather than about eligibility.

## Findings beyond the brief

`4-findings/` holds three screenshots and the write-up behind them.

**[`indexing-note.md`](indexing-note.md)** — on deployment day Perplexity could
not read the prototype at all, and silently substituted a competing prototype's
content for the requested URL. Eight checks ruled out every hosting-side cause;
four fixes were applied; the site was indexed within a day. This is the
strongest argument in the submission for putting the markup on the merchant's
own domain in production.

**Retrieval is not reliable even once indexed.** Query 3 failed three times
with `Use only` before succeeding with `Use`, while the page served HTTP 200 in
~0.15 s throughout. The unpinned form of the same query answers readily but
mixes in a rival prototype's facts, which is why it is not used as evidence.
Both are written up in `indexing-note.md`.
