import profileJson from "@/data/business.json";
import type { BusinessProfile, Program } from "@/adapters/types";

/**
 * The ingested profile, read once. In production this is a per-tenant row
 * fetched by hostname; here it is the file the ingest job wrote.
 */
export const profile = profileJson as unknown as BusinessProfile;

/** The program the assignment is about; also the sensible default. */
export const FEATURED_ID = "double-axel-club-6m";

export function getProgram(id?: string): Program | undefined {
  if (!id) return profile.programs.find((p) => p.id === FEATURED_ID) ?? profile.programs[0];
  const needle = id.toLowerCase();
  return profile.programs.find(
    (p) =>
      p.id.toLowerCase() === needle ||
      p.name.toLowerCase().includes(needle),
  );
}

/**
 * Keyword search over the facts a buyer actually asks about.
 *
 * Field weighting and phrase matching are both load-bearing here. The naive
 * version — split into words, score any hit equally — ranks "online double axel
 * training" against a ladder whose rungs share most of their vocabulary: the
 * double jumps program's own audience text contains both "double" and "axel"
 * ("skaters who have landed their axel and are moving on to double jumps"), so
 * it ties with, and can outrank, the program the user actually asked for.
 *
 * Two fixes: a match in the name counts for far more than one in prose, and an
 * adjacent word pair from the query ("double axel") scores above the sum of its
 * parts. Brand aliases are matched too, because "VSA" and "Victory Skating" are
 * the same business to a customer and half the queries use only one of them.
 */
export function searchPrograms(query: string, maxPrice?: number): Program[] {
  const q = query.toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const bigrams = words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`);

  const brandWords = new Set(
    [profile.brand.name, ...profile.brand.aliases]
      .join(" ")
      .toLowerCase()
      .split(/\s+/),
  );

  const scored = profile.programs.map((program) => {
    const name = program.name.toLowerCase();
    const strong = [program.name, program.summary, program.category]
      .join(" ")
      .toLowerCase();
    const weak = [
      program.description,
      program.audience,
      program.level,
      ...program.prerequisites,
      ...program.includes,
      ...program.instructors.map((i) => i.name),
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;

    // A phrase in the title is the strongest signal there is.
    for (const bg of bigrams) {
      if (name.includes(bg)) score += 20;
      else if (strong.includes(bg)) score += 8;
      else if (weak.includes(bg)) score += 2;
    }
    for (const w of words) {
      if (name.includes(w)) score += 5;
      else if (strong.includes(w)) score += 2;
      else if (weak.includes(w)) score += 1;
      else if (brandWords.has(w)) score += 1;
    }

    return { program, score };
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
