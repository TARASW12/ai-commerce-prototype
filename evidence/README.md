# Evidence

Everything measured for this assignment, in the order the brief asks for it.
Folders `1-before` and `2-after` are deliberately symmetric: the same six
questions, same numbering, so any pair can be opened side by side.

## Section 1 — Before / baseline

`1-before/` — the six questions from the brief, verbatim, each in a fresh
Perplexity thread, with the source pinned to the merchant's page.
`1-before/NOTES.md` has the per-query table and the six distinct failures.

**Open `02-q2-PRICE-ERROR-says-699.png` first.** It is the baseline's worst
result: the engine reports the price as **$699** — the struck-through list
price — for a program that costs $299. Then `05-q5-can-i-join-NO-ACTION.png`,
where a user asking literally "can I join?" is told about the required skill
level and never how to join.

## Section 2 — Build

The code is the repository; `README.md` there has the architecture. The
measurement is reproducible without an API key:

```
npm run eval    # 0/13 → 13/13 machine-readable facts
npm run demo    # the sales scenario, end to end
```

## Section 3 — Sales / enrolment flow

`3-agent/` — the brief's scenario run against the deployed MCP server: a
natural-language request with a budget, a date the user names, and a checkout
URL that redirects to the merchant's own Stripe. Three live JSON-RPC calls.
`3-agent/NOTES.md` walks through each step.

## Section 4 — After / proof

`2-after/` — the same six questions, same engine, same pinning, different page.
`2-after/NOTES.md` has the per-query table and the side-by-side comparison.

**The two that matter:** `02-q2-PRICE-FIXED-says-299.png`, the same question
that produced $699 above, and `05-q5-can-i-join-WITH-ACTION.png`, where "can I
join?" finally gets an answer about joining.

## Findings beyond the brief

`4-findings/` — three screenshots and the write-up behind them.

`02-merchant-page-is-outranked-by-a-rival-prototype.png` is the one worth your
time. Asked about this product without a source restriction, Perplexity answers
from `vsa-ai-gateway.onrender.com` — a third-party prototype built for this same
assignment, live since 5 October — and cites victoryskating.com for nothing
specific at all. Structured data on an unrelated domain already outranks the
merchant's own page for the merchant's own product. That is the clearest
argument for injecting this markup into the merchant's site in production rather
than hosting it alongside, which is what section 8 of the repository README
recommends.

`NOTES.md` there covers the rest: how the engine behaved on deployment day, the
eight checks that ruled out every hosting-side cause, the four fixes, and why
retrieval stays unreliable even once a page is indexed.
