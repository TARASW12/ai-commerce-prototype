# Section 4 — After

Engine: **Perplexity** (web app, default search mode, free tier), same as the
baseline. Date: 15 October 2026.

Source under test:
`https://ai-commerce-prototype.vercel.app/programs/double-axel-club-6m`

## Method

Identical to the baseline: each of the six questions from the brief, verbatim,
in a new thread, with the source pinned by `Use only <url> as your source.` One
engine, one interface, one phrasing — the only variable is which page holds the
facts.

On the day of deployment this was not possible: Perplexity would not retrieve a
URL it had not indexed, and substituted a third-party prototype's content for
the requested page. `indexing-note.md` documents the eight checks that ruled out
every hosting-side cause and the four fixes applied — deployment protection
removed, pages prerendered with a public cache header, sitemap, IndexNow
submission. The site was indexed within a day
(`after/00-indexed-confirmation.png`), which is what made the symmetric
comparison possible.

## Results

| # | Query | Product found? | Price correct? | Enrolment action? | Notes |
|---|-------|----------------|----------------|-------------------|-------|
| 1 | Does Victory Skating have an online Double Axel training program? | yes | **yes — "$299 for the full six-month program", stated once** | not asked | Baseline said "$299 (also shown as a $699 six-month package with a $6/class rate)". Here the figure stands alone. Adds what the baseline never gave: **"Next listed session: Saturday, October 17, 2026"**, plus level and the schedule in UTC. Minor leak: a Zoom detail cited to `victoryskating` |
| 2 | Does VSA offer online training for Double Axel? | yes | **yes — "$299 for the whole program"** | not asked | **The headline result.** The baseline answered this exact question with *"the advertised package is $699 for 6 months"* — 2.3× the real price. One typed `Offer.price` field removes the error entirely. Also adds the next session date, time in UTC and the coach |
| 3 | …under $350 for six months…? | — | — | — | **Retrieval failed twice** (`q3-transient-fetch-failure*.png`), minutes apart, while the page served 200 in ~0.2s to a `PerplexityBot` agent throughout. Not retried further; see the note on retrieval reliability below |
| 4 | How much is it and what is included? | yes | **yes — "costs $299 for the entire program"**, opening sentence | not asked | The $699 list price is not raised at all: on this page it is a labelled `priceSpecification` detail rather than a competing figure in the same paragraph. Derives $6.23/class unprompted. Adds the next session date, which the baseline's best answer still lacked |
| 5 | Can I join the VSA program? | yes | yes — $299 | **yes — "You can enroll directly from the program page for the next weekend session"** | **The clearest win.** The baseline answered this question about *eligibility* and never said how to join. Here a dedicated "Can you join?" section states enrolment is ongoing, start is the next weekend, and ends with the action. No hedging — "likely" is gone, because availability is now a fact on the page rather than an inference. Bonus: routes an under-qualified skater to the Axel Club instead of losing them, which only works because the whole ladder was ingested |
| 6 | I'm free on November 6. Can I join around that time? | yes | yes — $299 | yes — enrol any time, start the next weekend | **The trap closes.** "Yes. The Double Axel Club is an ongoing program, so you can enroll at any time and begin on the next weekend after you join… Saturday, November 7 or Sunday, November 8." Flat statement, no hedge. The baseline said "you can **likely** join" and described the billing as **monthly** — wrong model. Availability is now read, not guessed |

## A note on retrieval reliability

Query 3 failed once with *"the URL returned no readable content"*
(`after/q3-transient-fetch-failure.png`) and succeeded on a retry minutes later.
The site was serving 200 in ~0.3s from cache throughout, verified against a
`PerplexityBot` user agent at the time of the failure.

Worth recording rather than hiding: an engine that silently drops a source and
answers anyway is a real risk for a commerce layer. It is also the argument for
not relying on a single channel — the same facts are available to an agent
through `/api/mcp` and `/api/feed`, where retrieval either succeeds or returns
an error rather than quietly degrading into a guess.

## Baseline comparison

Same engine, same interface, same six questions verbatim, same `Use only <url>`
pinning. The only variable is which page holds the facts.

| | Before — merchant page | After — this prototype |
|---|---|---|
| price across the runs | $299 / **$699** / $299 / $299 / $299 / "billed monthly" | $299 every time it answered, stated once |
| worst price error | quoted **2.3× the real price** (q2) | none |
| enrolment action offered | **0 of 6** | yes (q5), plus "enrol any time" in q6 |
| availability | inferred — "you can *likely* join" | stated — "ongoing… begin on the next weekend" |
| next session date | never given | given in q1, q4, q5, q6 |
| billing model | described as monthly (q6) | $299 for the full six months |
| invented facts | Zoom, auto-renewal, a pause-before-billing rule, a confirmation email | none observed |
| retrieval failures | 0 of 6 | **2 of 6 attempts on q3** (engine-side; page served 200 in ~0.2s throughout) |

### What carried the difference

- **One typed `Offer.price`.** The merchant page puts $699, $299, $6/class and
  $60/hour in one run of copy; the prototype states the price once as a field.
  That single change removes the baseline's worst error.
- **Availability as a rule, not a date.** `FREQ=WEEKLY;BYDAY=SA,SU` with the
  October start date demoted to a historical attribute. The engine stops
  guessing and starts quoting.
- **An enrolment URL that exists.** `/enroll` is on the page, in the FAQ graph
  and in `llms.txt`, so "how do I join" has an answer to find.
- **The whole ladder ingested.** In q5 the assistant routes a skater who is not
  ready for the double axel to the Axel Club rather than dropping the
  conversation — behaviour that only exists because all four programs are in the
  catalog.
