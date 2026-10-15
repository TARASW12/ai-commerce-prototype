# Section 1 — Before / Baseline

Engine: **Perplexity** (default search mode, free tier)
Product under test: https://victoryskating.com/doubleaxel

## Method

Date tested: **14 October 2026.** Each query was run in a **new thread** so no
answer could be informed by a previous one. Every query was run twice:

- **Pass A — organic.** The query alone, as a customer would ask it. This shows
  how the product is handled today.
- **Pass B — page supplied.** The same query with the source URL given
  directly. This separates two different failures: *the page is not indexed*
  and *the page is indexed but unreadable*. Pass B is the fair comparison point
  for the "after" measurement in Section 4, because the after-state is a new
  deployment that no engine has crawled yet.

## Results

| # | Query | Pass | Product found? | Price correct? | Enrolment action? | Notes |
|---|-------|------|----------------|----------------|-------------------|-------|
| 1 | Does Victory Skating have an online Double Axel training program? | A | | | | |
| 1 | ″ + `Use only …/doubleaxel as your source.` | B | yes | **$299, but immediately muddied** — "also shown as a $699 six-month package with a $6/class rate" | **no** — no enrol link, no checkout | 48 classes, 45 min, 8/month and the workbook all correct. Says nothing about whether enrolment is open. `play.google` still pulled in, contributing the wrong brand name "Victory Sports Academy" |
| 2 | Does VSA offer online training for Double Axel? | A | | | | |
| 2 | ″ + `Use only …/doubleaxel as your source.` | B | yes | **NO — states $699 as the price.** "The advertised package is $699 for 6 months, presented as $6 per class; the page also lists $299/6 months" | **no** — no enrol link, no checkout | Leads with the struck-through list price and demotes the real $299 to an aside. A customer acting on this answer is quoted 2.3× the actual price. Still nothing on whether enrolment is open. `apps.apple` pulled in despite the source restriction |
| 3 | I'm looking for an online Double Axel training program under $350 for six months. Does Victory Skating have anything? | A | | | | |
| 3 | ″ + `Use only …/doubleaxel as your source.` | B | yes | yes — $299, correctly judged under the $350 budget | **no** — no enrol link, no checkout | Best of the three price answers, which is the point: the same fact came out as $299-with-caveats, $699, and $299 across q1–q3. Invents "Zoom" and a pause-before-billing rule that are not on the page. Says nothing about when a skater could start |
| 4 | How much is the Victory Skating / VSA Double Axel Club and what is included? | A | | | | |
| 4 | ″ + `Use only …/doubleaxel as your source.` | B | yes | yes — $299, and correctly identifies $699 as the crossed-out price | **no** — no enrol link, no checkout | Strongest answer of the six. Coach, schedule across three timezones and every inclusion correct. Even here the chain stops before the action: nothing on how to enrol, nothing on when a skater could start |
| 5 | I want online training to improve my Double Axel. Can I join the VSA program? | A | | | | |
| 5 | ″ + `Use only …/doubleaxel as your source.` | B | yes | $299, with the $699 figure mentioned alongside again | **no** | The user asks "can I join?" and gets an answer about *eligibility* only — whether they are at the right level. Not one word on how to join: no link, no checkout, no next step, no date. This is the clearest statement of the gap in the whole baseline |
| 6 | I'm free on November 6. Can I join the Double Axel program around that time? | A | | | | |
| 6 | ″ + `Use only …/doubleaxel as your source.` | B | yes | describes it as a **monthly** subscription — wrong, it is $299 for six months | **no** — "enroll and purchase", but no link | **The October 10 trap did not fire.** Correctly names Sat 7 / Sun 8 November. But it says "you can **likely** join" — the page never states that enrolment is rolling, so this is inference, not retrieval, and inference can land the other way. Sources leaked to Wikipedia despite the restriction |

## What the engine got wrong

**1. The price is non-deterministic.** Six runs of essentially the same
question produced three different treatments of one number:

| Query | What it said the program costs |
|---|---|
| q1 | $299, immediately muddied with "$699 package / $6 per class" |
| q2 | **$699** — the struck-through list price, stated as *the* price |
| q3 | $299, correct |
| q4 | $299, correct, and correctly identifies $699 as crossed out |
| q5 | $299, with $699 alongside again |
| q6 | a **monthly** subscription — wrong billing model entirely |

The page puts $699, $299, $6/class and $60/hour in one run of copy with no
typed field to separate them. A customer acting on q2 is quoted 2.3× the real
price. This is the single most consequential failure in the baseline, and it is
not a retrieval failure — the engine read the page every time.

**2. Nothing is actionable.** Not one of the six answers produced a way to
enrol: no link, no checkout, no next step. q5 asked literally *"can I join?"*
and got an answer about **eligibility** instead. q6 said *"enroll and purchase"*
without saying where.

**3. Availability is inferred, not retrieved.** q6 — the November 6 question —
was answered correctly (Sat 7 / Sun 8 Nov) and the October 10 start date did
*not* mislead it. But the wording is *"you can **likely** join"*: the page never
states that enrolment is rolling, so the engine guessed. A guess that happened
to land right here can land wrong on another run, on another phrasing, or on
another model.

**4. The brand name is absent from the page.** The string "Victory Skating"
appears **0 times** in the entire HTML — visible text, meta tags, scripts. Only
"VSA" (4 occurrences) and the domain. Queries 1, 3 and 4 name a brand the page
never states.

**5. Facts are invented where the page is silent.** Zoom (q3, q6), an
auto-renewing subscription (q1 organic), a pause-two-days-before-billing rule
(q3), a confirmation email and 24-hour link delivery (q6). Some may be true of
the business; none are on the page the engine was told to use.

**6. The source restriction leaks.** Despite `Use only …`, answers pulled in
`play.google` (q1, q5), `apps.apple` (q2) and `en.wikipedia.org` (q6). The wrong
brand name "Victory Sports Academy" comes from the Google Play listing.

## A contaminated organic baseline

Run without a source restriction, the queries return a largely correct answer —
but the facts are cited to **`vsa-ai-gateway.onrender.com`**, a third-party
prototype built for this same hiring assignment and deployed on 2026-10-05. The
merchant's own product page is not cited for a single specific fact; where
`victoryskating` appears at all it is the homepage ("Online Jump Academy — From
Beginners To Olympians").

See `before-organic/q1-organic-sources.png`: level, schedule and price all carry
the `vsa-ai-gateway.onrender` label.

Two things follow. First, a naive before/after on organic queries would measure
somebody else's deployment, not this page — which is why pass B exists. Second,
it is direct evidence for the thesis of the work: structured data on an
unrelated domain already outranks an unmarked page for its own product. That is
also the argument for putting the markup on the merchant's own domain in
production, rather than hosting it beside the business.

## Screenshots

`1-before/01…06` — one file per query, in the order of the table above. Each
includes the **Sources** panel, so it is visible which pages the engine actually
read.

The unpinned pass is not kept per-query; the one screenshot that matters from it
is `4-findings/02-merchant-page-is-outranked-by-a-rival-prototype.png`, for the
reason described in the previous section.
