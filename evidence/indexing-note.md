# Why the "after" pass could not use the same method as the baseline

The baseline pinned Perplexity to the merchant's page with
`Use only <url> as your source`, and it worked: the engine fetched that page and
cited it.

The same instruction pointed at this prototype does **not** work. Perplexity
either reports that it "could not load" the URL
(`00-could-not-load.png`) or silently ignores the restriction and answers from
search instead (`00-indexing-limitation.png`) — citing
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
substitutes the **other** prototype's catalog and presents it as the content of
the requested page — including that project's own disclaimer, "a prototype built
for a hiring assignment… captured from VSA's public pages and checkout on
October 5, 2026" (`after/00-attributes-competitor-content.png`).

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

## How the after-state was demonstrated instead

See `after/` for the Comet run — Perplexity's own browser, reading the live page
directly. Same engine, same questions, no dependence on the index.
