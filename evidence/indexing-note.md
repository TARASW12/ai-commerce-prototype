# Why the "after" pass could not use the same method as the baseline

The baseline pinned Perplexity to the merchant's page with
`Use only <url> as your source`, and it worked: the engine fetched that page and
cited it.

On deployment day the same instruction pointed at this prototype did **not**
work. Perplexity either reported that it "could not load" the URL, or silently
ignored the restriction and answered from search instead — citing
`vsa-ai-gateway.onrender.com`, a third-party prototype built for this same
assignment and live since 2026-10-05.

## It is not a reachability problem

Everything that could block a crawler was checked and ruled out:

| Check | Result |
|---|---|
| `PerplexityBot/1.0` user agent | HTTP 200, full HTML, price present |
| `Perplexity-User/1.0` user agent | HTTP 200, full HTML, price present |
| `OAI-SearchBot` user agent | HTTP 200 |
| External datacenter fetch (`r.jina.ai`) | HTTP 200, full page content extracted |
| `robots.txt` | Allows all, names the AI crawlers explicitly |
| Vercel SSO / deployment protection | Was enabled; **disabled**, then the fetch was retried — same failure |
| Cache headers | Was `no-store`; pages now prerendered, `cache-control: public` |
| `sitemap.xml` | Present, lists all 11 URLs |
| IndexNow submission | HTTP 202 Accepted, 11 URLs |

The page is globally reachable and crawler-friendly. Perplexity simply does not
fetch arbitrary hosts it has not already indexed — `Use only` is a soft
instruction, not a retrieval directive. The failure reproduced identically after
deployment protection was removed, which rules out the last hosting-side cause.

## It fails in the worst possible way

Asked to read this prototype's URL, Perplexity does not say "I don't know". It
substituted the **other** prototype's catalog and presented it as the content
of the requested page — including that project's own disclaimer, "a prototype
built for a hiring assignment… captured from VSA's public pages and checkout on
October 5, 2026".

So the engine attributed one site's content to a different site's URL, with
citations that look authoritative. For a commerce layer that is the failure mode
that matters most: a confident, well-sourced answer about a product, assembled
from a page the merchant does not control.

## What that means

The difference between the two prototypes is nine days of crawl time, not
anything either of them did. This is the clearest possible argument for the
production recommendation: **the structured data belongs on the merchant's own
already-indexed domain**, injected into the existing site, rather than hosted
beside it. A separate domain will never outrank `victoryskating.com` for its own
brand, and until it is crawled it does not exist at all.

## How it was resolved

Four fixes went out the same day:

1. Vercel deployment protection removed.
2. Request-header reads dropped, so every page prerenders and ships
   `cache-control: public` instead of `no-store`.
3. `sitemap.xml` extended to all eleven URLs.
4. Every URL submitted to IndexNow (HTTP 202).

Perplexity indexed the site within a day — `05-indexed-next-day…png` shows it
reading all four programs, the schedule in UTC, the coaches and the
machine-readable endpoints. That is what made the after pass in `2-after/`
possible on the same method as the baseline: same engine, same questions
verbatim, same source pinning.

## Retrieval stays unreliable even once indexed

Query 3 failed three times with `Use only <url> as your source` — *"the source
URL failed to load twice"* — while the page served HTTP 200 in ~0.15 s to a
`PerplexityBot` user agent throughout. Dropping the word **only** made it work.

The same query with no URL at all answers readily, but half its facts come from
the rival prototype: "auto-renews until cancelled", "via Zoom", "pause two days
before billing". None of those appear on the page under test, which is why that
form is not used as evidence anywhere — see
`07-unpinned-query-mixes-in-a-rivals-facts.png`.

Two conclusions, and they outlast the inconvenience:

- **`Use only` is a soft instruction over a fragile live fetch.** The engine
  reaches for the page, fails, then either refuses or quietly answers from
  search. The failure is invisible in the answer unless you read the citations.
- **A commerce layer cannot rest on that channel alone.** The same facts reach
  an agent through `/api/mcp` and `/api/feed`, where a failed read returns an
  error instead of degrading into a confident guess sourced from someone else's
  site.
