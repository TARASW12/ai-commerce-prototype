# Section 3 — Sales / enrolment flow

`mcp-sales-flow.png` is the assignment's scenario run end to end against the
deployed MCP server. Reproduce it with `npm run demo`.

| Step | User says | Tool called | Result |
|---|---|---|---|
| 1 | "I want to improve my double axel and I'm looking for an online program under $350." | `search_programs` | 6-Month Double Axel Club, $299, 48 classes, Coach Marta, advanced |
| 2 | "I'm free on November 6. Can I join around then?" | `check_availability` | Saturday 2026-11-07; ongoing program; the 2026-10-10 landing-page date is reported and explicitly **not** treated as a limit |
| 3 | "I want to join." | `create_enrollment` | `ready_for_checkout`, $299, first session Sat 2026-11-07, checkout URL |
| 4 | — | follow the URL | HTTP 302 → `buy.stripe.com/…?client_reference_id=ai-double-axel-club-6m-…` |

Three live JSON-RPC round trips, ~165 ms each.

Two details worth pointing at:

**Step 2 is the one the brief asked for.** The user names a date five weeks
after the start date printed on the merchant's landing page. The tool answers
from the recurrence rule, names the actual next sessions, and states in its own
response that the printed date does not close enrolment — so an assistant
quoting it cannot get this wrong.

**Step 4 is why this is commerce and not search.** The redirect lands on the
merchant's own Stripe checkout, with a `client_reference_id` that comes back on
the webhook. That is what makes "how much revenue did AI generate" answerable
rather than "how often were we mentioned".

A retrieval engine cannot do any of this: Perplexity reads pages, it does not
call tools. That is why the discovery layer (JSON-LD, llms.txt, feed) and the
action layer (MCP, /enroll) both exist and share one source of truth.
