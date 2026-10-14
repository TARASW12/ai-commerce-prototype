# Section 1 — Before / Baseline

Engine: **Perplexity** (default search mode, free tier)
Date tested: `__________`
Product under test: https://victoryskating.com/doubleaxel

## Method

Each query was run in a **new thread** so no answer could be informed by a
previous one. Every query was run twice:

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
| 1 | ″ + `Use https://victoryskating.com/doubleaxel` | B | | | | |
| 2 | Does VSA offer online training for Double Axel? | A | | | | |
| 2 | ″ + URL | B | | | | |
| 3 | I'm looking for an online Double Axel training program under $350 for six months. Does Victory Skating have anything? | A | | | | |
| 3 | ″ + URL | B | | | | |
| 4 | How much is the Victory Skating / VSA Double Axel Club and what is included? | A | | | | |
| 4 | ″ + URL | B | | | | |
| 5 | I want online training to improve my Double Axel. Can I join the VSA program? | A | | | | |
| 5 | ″ + URL | B | | | | |
| 6 | I'm free on November 6. Can I join the Double Axel program around that time? | A | | | | |
| 6 | ″ + URL | B | | | | |

## What the engine got wrong

_Fill in after running the queries. Watch for:_

- the **$299** program price confused with **$699** (list), **$6** (per class)
  or **$60** (the coach's private hourly rate)
- **48** total classes confused with the **2** classes per weekend
- enrolment described as closed, or tied to the **October 10** date printed on
  the page
- no way offered to actually enrol or pay
- the brand: the string "Victory Skating" appears **0 times** anywhere in the
  page's HTML — only "VSA" (4 occurrences) and the domain name. Queries 1 and 3
  name a brand the page never states.

## Screenshots

- `before-organic/` — pass A, one file per query: `q1.png` … `q6.png`
- `before-withurl/` — pass B, same naming

Each screenshot must include the **sources block** under the answer, so it is
visible which pages the engine actually read.
