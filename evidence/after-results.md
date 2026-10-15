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
| 3 | …under $350 for six months…? | yes | **yes — "$299 total, which is under your $350 budget"** | not asked | Answered on the fourth attempt, with `Use` instead of `Use only` — the only query where the wording had to change; see the note below. Compare the baseline's answer to the same price question, **$699**: a customer with a $350 budget would have been told the program was out of reach |
| 4 | How much is it and what is included? | yes | **yes — "costs $299 for the entire program"**, opening sentence | not asked | The $699 list price is not raised at all: on this page it is a labelled `priceSpecification` detail rather than a competing figure in the same paragraph. Derives $6.23/class unprompted. Adds the next session date, which the baseline's best answer still lacked |
| 5 | Can I join the VSA program? | yes | yes — $299 | **yes — "You can enroll directly from the program page for the next weekend session"** | **The clearest win.** The baseline answered this question about *eligibility* and never said how to join. Here a dedicated "Can you join?" section states enrolment is ongoing, start is the next weekend, and ends with the action. No hedging — "likely" is gone, because availability is now a fact on the page rather than an inference. Bonus: routes an under-qualified skater to the Axel Club instead of losing them, which only works because the whole ladder was ingested |
| 6 | I'm free on November 6. Can I join around that time? | yes | yes — $299 | yes — enrol any time, start the next weekend | **The trap closes.** "Yes. The Double Axel Club is an ongoing program, so you can enroll at any time and begin on the next weekend after you join… Saturday, November 7 or Sunday, November 8." Flat statement, no hedge. The baseline said "you can **likely** join" and described the billing as **monthly** — wrong model. Availability is now read, not guessed |

## A note on retrieval reliability

Query 3 is the one deviation from the method, and it is worth describing
exactly.

With `Use only <url> as your source` it failed **three times**, minutes apart —
*"the source URL failed to load twice"* — while the page served HTTP 200 in
~0.15s to a `PerplexityBot` user agent throughout
(`q3-transient-fetch-failure*.png`). Dropping the word **only** made it work on
the next attempt (`q3.png`).

The same query with no URL at all answers happily and cites the prototype
(`q3-unpinned-contaminated.png`) — but half its facts come from
`vsa-ai-gateway.onrender.com`: "auto-renews until cancelled", "via Zoom", "pause
two days before billing". None of those are on the page under test. That is why
the unpinned form is not used as evidence anywhere here.

Two things follow, and both matter more than the inconvenience:

- **`Use only` is a soft instruction backed by a fragile live fetch.** The
  engine reaches for the page, fails, and then either refuses or quietly answers
  from search instead. The failure is not visible in the answer unless you read
  the citations.
- **A commerce layer cannot depend on that channel alone.** The same facts are
  served to an agent through `/api/mcp` and `/api/feed`, where a failed read
  returns an error instead of degrading into a confident guess sourced from
  somebody else's site.

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
| retrieval failures | 0 of 6 | **3 attempts on q3** before dropping the word "only" (engine-side; page served 200 in ~0.15s throughout) |

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
