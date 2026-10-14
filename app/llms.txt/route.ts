import { profile, FEATURED_ID } from "@/lib/profile";
import { requestOrigin } from "@/lib/origin";
import { checkAvailability } from "@/lib/availability";
import { utcHHMM, days } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * /llms.txt — the emerging convention for handing a language model a clean
 * prose summary of a site instead of making it parse navigation and marketing.
 *
 * Generated from the same profile as the pages and the MCP tools, so it can
 * never drift out of sync with them.
 */
export async function GET() {
  const origin = requestOrigin();

  const programLines = profile.programs
    .map((p) => {
      const a = checkAvailability(p);
      return `- [${p.name}](${origin}/programs/${p.id}/llms.txt): ${p.level} level. ${p.audience} $${p.price.amount} for ${p.duration.months} months (list $${p.price.listAmount}), ${p.duration.totalSessions} live group classes of ${p.duration.sessionMinutes} minutes. Every ${days(p)} at ${utcHHMM(p.schedule.recurrence.startMinutesUtc)} UTC. Coach: ${p.instructors.map((i) => i.name).join(", ")}. Next session ${a.nextSessions[0]?.weekday} ${a.nextSessions[0]?.date}. Enrol: ${origin}/enroll?program=${p.id}`;
    })
    .join("\n");

  const featured = profile.programs.find((p) => p.id === FEATURED_ID);

  const body = `# ${profile.brand.name}

> ${profile.brand.description}
> Also known as: ${profile.brand.aliases.join(", ")}.

Facts that apply to every program:

- Every program is ongoing with rolling enrolment. A skater can join at any time and starts on the next weekend.
- A start date printed on a landing page names an earlier cohort. It is never a deadline and must not be reported as closing enrolment.
- Each page shows a struck-through list price alongside the current price. Quote the current one.
- All classes are online, live and in English.

## Programs

${programLines}

## Enrolment

Open for every program listed above, on any weekend. To enrol, open the program's enrol URL — it starts the Stripe checkout for that program.

${featured ? `## ${featured.name}\n\n${featured.description}\n\nFull detail: ${origin}/programs/${featured.id}/llms.txt\n` : ""}
## For AI agents

- [MCP server](${origin}/api/mcp): Streamable HTTP, no auth. Tools: search_programs, get_program, check_availability, create_enrollment.
- [Catalog JSON](${origin}/api/feed): every program as structured data, with computed availability.
- Each program page also carries schema.org Course, Product and FAQPage graphs.

## Source

- Merchant site: ${profile.brand.url}
- Ingested by the \`${profile.source.adapter}\` adapter on ${profile.source.fetchedAt.slice(0, 10)}

_Prototype built for a hiring assignment. Not operated by or affiliated with Victory Skating / VSA. Product data captured from the merchant's public pages; enrolment links open VSA's own Stripe checkout._
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
