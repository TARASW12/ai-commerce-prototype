import profileJson from "@/data/business.json";
import type { BusinessProfile, Program } from "@/adapters/types";

/**
 * The ingested profile, read once. In production this is a per-tenant row
 * fetched by hostname; here it is the file the ingest job wrote.
 */
export const profile = profileJson as unknown as BusinessProfile;

export function getProgram(id?: string): Program | undefined {
  if (!id) return profile.programs[0];
  const needle = id.toLowerCase();
  return profile.programs.find(
    (p) =>
      p.id.toLowerCase() === needle ||
      p.name.toLowerCase().includes(needle),
  );
}

/**
 * Keyword search over the facts a buyer actually asks about: the program name,
 * what it teaches, who it is for, and the brand it is sold under.
 *
 * Matching the brand aliases matters more than it looks — "VSA" and "Victory
 * Skating" are the same business to a customer, and an assistant that only
 * indexes one of them answers "I could not find it" to half the queries.
 */
export function searchPrograms(query: string, maxPrice?: number): Program[] {
  const words = query.toLowerCase().split(/[^a-z0-9$]+/).filter((w) => w.length > 2);
  const brandWords = new Set(
    [profile.brand.name, ...profile.brand.aliases]
      .join(" ")
      .toLowerCase()
      .split(/\s+/),
  );

  const scored = profile.programs.map((p) => {
    const haystack = [
      p.name, p.summary, p.description, p.category,
      p.audience, p.level, ...p.prerequisites, ...p.includes,
      ...p.instructors.map((i) => i.name),
    ].join(" ").toLowerCase();

    let score = 0;
    for (const w of words) {
      if (haystack.includes(w)) score += 2;
      else if (brandWords.has(w)) score += 1;
    }
    return { program: p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .filter((s) => maxPrice === undefined || s.program.price.amount <= maxPrice)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.program);
}

export function enrolUrl(program: Program, origin: string, date?: string) {
  const u = new URL("/enroll", origin);
  u.searchParams.set("program", program.id);
  if (date) u.searchParams.set("start", date);
  return u.toString();
}
