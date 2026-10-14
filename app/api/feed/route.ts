import { profile } from "@/lib/profile";
import { siteOrigin } from "@/lib/origin";
import { checkAvailability } from "@/lib/availability";

export const revalidate = 300;

/**
 * The normalized record itself, plus freshly computed availability.
 *
 * This is the integration point a partner or an agent framework would poll —
 * the same data the page and the MCP tools serve, without the presentation.
 */
export async function GET() {
  const origin = siteOrigin();
  return Response.json(
    {
      ...profile,
      programs: profile.programs.map((p) => ({
        ...p,
        availability: checkAvailability(p),
        enrollUrl: `${origin}/enroll?program=${p.id}`,
      })),
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
