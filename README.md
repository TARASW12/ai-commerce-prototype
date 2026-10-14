# AI Commerce Layer — Victory Skating / VSA Double Axel Club

A working prototype that takes an existing business page and makes it
discoverable, understandable and **actionable** for AI assistants — from a
natural-language request through to a checkout URL.

Source product: <https://victoryskating.com/doubleaxel> (Tilda landing page,
Stripe payment link).

```
npm install
npm run ingest     # run the adapter against the live page
npm run build && npm start
npm run eval       # before/after measurement
```

---

## 1. The finding that shaped the design

Before writing any code I measured what an AI client can actually retrieve from
the original page. Three things stood out:

**The page contains zero structured data.** No JSON-LD, no microdata, an empty
`og:description`, and about 5,500 characters of visible text.

**The brand name in the queries does not appear on the page.** The string
"Victory Skating" occurs **0 times** in the entire HTML — visible text, meta
tags, scripts, all of it. Only "VSA" appears (4 times), plus the domain name.
Every baseline query phrased as *"Does Victory Skating have…"* is therefore
asking about a string that exists nowhere on the page it should match.

**The prices are adjacent and untyped.** `$699`, `$6/class`, `$299/6 months`
and `$60/hour` sit in one run of copy. So do `2 Live Group Classes` (per
weekend) and `48 Live Group Classes` (in total). A reader disambiguates these
from layout; a retrieval engine reading flattened text frequently does not.

A fourth problem is behavioural rather than structural: the page says *"Join us
on October 10"*. That is one past cohort, but it is the only date on the page,
so an assistant asked *"can I join in November?"* has nothing to answer with
except a date that has passed.

These four findings are what the architecture is built to fix.

---

## 2. Architecture

```
 victoryskating.com (Tilda)          ← system of record for content
            │
      adapters/tilda.ts              ← the ONLY file that knows about Tilda
            ▼
   BusinessProfile  (data/business.json)
   normalized: brand + aliases, price, duration, schedule rule,
   instructor, level, prerequisites, checkout
            │
    ┌───────┼────────────────┬──────────────────┐
    ▼       ▼                ▼                  ▼
  page    llms.txt       /api/mcp            /enroll
  JSON-LD  + /api/feed    MCP tools          → Stripe
    │       │                │                  │
    └───────┴────────────────┘                  │
       DISCOVERY LAYER              ACTION LAYER │
    (retrieval engines read)      (agents call)  ▼
                                              payment
```

### Why there are two layers rather than one

**Perplexity, ChatGPT Search and every other retrieval engine cannot call
tools.** They crawl and read pages. An MCP server is invisible to them. So the
discovery layer has to carry every fact in a form a crawler can parse:
schema.org JSON-LD, a `/llms.txt` summary, and the same facts repeated as plain
prose, all server-rendered so a crawler that executes no JavaScript still sees
them.

**Agent hosts that do speak MCP cannot browse a marketing page reliably, and
cannot take an action from one at all.** So the action layer exposes typed
tools with real behaviour: search, detail lookup, live availability, and
enrolment that returns a checkout URL.

Building only one of the two fails the brief in a specific way. MCP alone shows
nothing in Perplexity. JSON-LD alone is discoverable but not actionable. The
prototype needs both because *"discovery → transaction"* crosses a boundary
that no single protocol covers today.

The two layers share one source of truth, so they cannot drift apart.

### Recurrence as a rule, not a date

The single most important modelling decision. `Recurrence` stores
`FREQ=WEEKLY;BYDAY=SA,SU` plus a start time in UTC, and keeps the landing
page's October date as `firstCohortDate` — a historical attribute that is
**never** consulted when answering whether someone can join.

```
check_availability({ date: "2026-11-06" })
→ "Around 2026-11-06, the next session is Saturday 2026-11-07. This is an
   ongoing program that runs every Saturday and Sunday, so a skater can enrol
   at any time… the 2026-10-10 start date on the landing page refers to an
   earlier cohort and does not close enrolment."
```

The same rule generates the `CourseInstance` dates in the JSON-LD, so the page
a crawler reads in March advertises March weekends. Nothing goes stale.

One detail worth noting: the page lists the session in seven timezones
(`7am PDT`, `10am EDT`, `3pm UK`, `9pm ICT`…). The adapter normalises each one
to UTC and checks that they collapse to a single value — they all resolve to
**14:00 UTC**, which proves it is one session shown seven ways rather than
seven separate sessions. The schedule is stored once, and localised on output.

---

## 3. What is where

| Path | Responsibility |
|---|---|
| `adapters/types.ts` | `BusinessProfile` — the contract every adapter implements |
| `adapters/tilda.ts` | Live HTML → `BusinessProfile` for this page |
| `adapters/shopify.ts` | Second platform, contract only — shows what a new connector costs |
| `scripts/ingest.ts` | Picks an adapter by URL, writes `data/business.json` |
| `lib/availability.ts` | Recurrence engine; answers "can I join around X?" |
| `lib/jsonld.ts` | `Course`, `Product`, `FAQPage` graphs |
| `lib/profile.ts` | Loading, brand-aware search, enrolment URLs |
| `app/page.tsx` | AI-readable page: JSON-LD + the same facts as prose |
| `app/llms.txt/route.ts` | Markdown summary for LLM crawlers |
| `app/api/feed/route.ts` | The normalized record as JSON |
| `app/api/mcp/route.ts` | MCP server (JSON-RPC, Streamable HTTP) |
| `app/enroll/route.ts` | Action endpoint → Stripe, with AI attribution |
| `scripts/eval.ts` | Before/after measurement |

Zero runtime dependencies beyond Next and React. The MCP server is written
against the protocol directly — it is a small, stable JSON-RPC surface, and
spelling it out keeps the contract auditable.

---

## 4. The enrolment flow

```
User:  "I want to improve my double axel and I'm looking for an online
        program under $350."

  → search_programs({ query: "...", maxPrice: 350 })
    ← 6-Month Double Axel Club, $299, 48 classes, every weekend,
      Coach Marta, advanced level, online

User:  "I'm free on November 6. Can I join then?"

  → check_availability({ date: "2026-11-06" })
    ← next session Saturday 2026-11-07; ongoing program, enrolment open

User:  "I want to join."

  → create_enrollment({ startDate: "2026-11-06" })
    ← checkoutUrl: /enroll?program=double-axel-club-6m&start=2026-11-07

  → GET /enroll  →  302  →  buy.stripe.com/...?client_reference_id=ai-...
```

For Perplexity, which cannot call any of this, the same path still closes: the
page and `llms.txt` both surface `/enroll` as a plain URL, so the assistant can
hand it to the user in its answer.

`client_reference_id` comes back on the Stripe webhook. That is what makes
*"how much business did AI generate?"* answerable rather than
*"how often were we mentioned?"*.

---

## 5. Measured result

`npm run eval` fetches both sources and checks 13 required facts — reproducible,
no API key, no cost:

```
                  BEFORE          AFTER
retrievable        9/13           13/13
unambiguous        0/13           13/13
JSON-LD graphs        0        3 (Course, Product, FAQPage)
```

Missing before: brand "Victory Skating", schedule as dates, enrolment status,
checkout action. Present but left to inference: the VSA ↔ Victory Skating
identity, the price among four competing dollar figures, and 48 classes among
two different "Live Group Classes" counts.

### How the before/after was tested in Perplexity

Perplexity answers from pages it has crawled, and a new deployment is not
indexed for days or weeks. Comparing an indexed page against an unindexed one
would measure crawl latency, not the work. So both sides were tested the same
way — the URL given directly in the prompt — which isolates what changes when
the same engine reads the same facts in two different forms.

Organic ranking is a separate problem with a separate fix: the structured data
belongs on the business's own domain, which is the production recommendation in
§7.

---

## 6. Reuse: what a second business costs

**Everything except the adapter.** The page, `llms.txt`, feed, MCP tools,
availability engine and checkout route all consume `BusinessProfile` and have
no knowledge of Tilda, skating or Stripe payment links.

| Platform | What the adapter does | Harder than Tilda? |
|---|---|---|
| **Shopify** | Admin GraphQL: products, variants, `inventoryLevels`, `sellingPlanGroups` | Easier — the facts are already fields. Work shifts to mapping a large catalogue down and deciding which metafields carry eligibility |
| **WordPress / WooCommerce** | REST `/wp-json/wc/v3/products` | Similar. Loose typing means per-store curation, like Tilda |
| **Mindbody** | Public API: classes, staff, schedules, enrolments | Different shape — availability becomes a **live call**, not a computed rule. `Recurrence` is an interface precisely so one adapter can answer from a booking API instead |
| **Fresha** | Partner API: services, staff, slots | As Mindbody |
| **Custom sites** | HTML + heuristics, as here | Hardest. Needs the human-reviewed mapping this adapter has |

Two changes the current shape already anticipates:

**Availability must become pluggable.** Rule-based works for a recurring class.
A salon needs real slots. The adapter should return either a `Recurrence` or a
live `checkAvailability` implementation, behind one interface — the call sites
already treat it as a function, not a field.

**Checkout must become pluggable.** Stripe payment links are a redirect.
Shopify needs a cart permalink, Mindbody a booking call. `checkout.provider` is
already on the model; `/enroll` would dispatch on it.

Multi-tenancy is the one thing genuinely missing: `data/business.json` is a
single file. In production it is a row keyed by hostname, and the page resolves
the tenant from the request. That is a database change, not an architecture
change — the whole system already reads one `BusinessProfile`.

---

## 7. What I would change before production

**Put the structured data on the business's own domain.** This is the biggest
one. A separate domain will never outrank `victoryskating.com` for its own
brand. In production this layer injects JSON-LD into the existing site — a
Tilda header snippet, a WordPress plugin, a Shopify app, or a reverse proxy —
so the authority stays where the links already point. The hosted page becomes a
fallback for businesses that cannot modify their own site.

**Scheduled re-ingestion with change detection and a review queue.** Prices and
schedules move. The adapter should run on a schedule, diff against the stored
profile, and hold material changes for approval rather than silently publishing
a wrong price. A scraped source needs this far more than an API-backed one.

**Real Stripe Checkout Sessions instead of a payment-link redirect.** Created
server-side with line items, metadata and a webhook, so enrolments are recorded
and attribution survives. The current redirect proves the path; it does not
record the sale.

**Confidence and provenance on every field.** The adapter mixes parsed values
with human-reviewed ones. Each field should carry where it came from and how
confident the extraction was, so low-confidence fields are reviewed rather than
published — and so an assistant is never handed a guess as a fact.

**Authentication and rate limiting on the MCP endpoint.** It is read-only and
public today. `create_enrollment` taking money would need both, plus audit
logging.

**Monitoring what AI actually asks.** Log queries hitting the feed and MCP
tools. The questions assistants ask before a purchase are the most direct
signal available for what the product data is missing — that feedback loop is
the point of the business-data layer, and this prototype only sets up the
plumbing for it.

**Tests.** The recurrence engine deserves real coverage — month boundaries,
DST, timezone edges — and the adapter needs a golden-file test against a
snapshot of the page so a redesign fails loudly instead of silently producing
an empty profile.
