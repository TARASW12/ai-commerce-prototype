/**
 * Before/after measurement.
 *
 * Screenshots prove that one answer looked better on one day. This measures
 * the thing underneath: of the twelve facts the brief lists as required, how
 * many can an AI client actually retrieve from each source, and how many are
 * stated unambiguously rather than left to be inferred from marketing prose.
 *
 * Deterministic by default — no API key, no cost, same number every run, so a
 * reviewer can reproduce it. Set ANTHROPIC_API_KEY to additionally have a model
 * answer the brief's five queries from each source and grade itself.
 *
 *   npx tsx scripts/eval.ts                       # original vs local build
 *   npx tsx scripts/eval.ts https://my.vercel.app # original vs deployed
 */

const ORIGINAL = "https://victoryskating.com/doubleaxel";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";

/** The facts the assignment requires an assistant to retrieve. */
interface Fact {
  key: string;
  /** Present anywhere in the fetched text at all. */
  present: RegExp;
  /** Present as a typed field a machine can read without inference. */
  structured?: (jsonld: string) => boolean;
  /** Why a human reader is not enough. */
  ambiguity?: string;
}

const FACTS: Fact[] = [
  {
    key: "product name",
    present: /6-?Month Double Axel Club/i,
    structured: (j) => /"name"\s*:\s*"[^"]*Double Axel Club/i.test(j),
  },
  {
    key: "brand (Victory Skating)",
    present: /Victory Skating/i,
    structured: (j) => /Victory Skating/i.test(j),
  },
  {
    key: "brand alias (VSA)",
    present: /\bVSA\b/,
    structured: (j) => /"alternateName"[\s\S]{0,120}VSA/.test(j),
    ambiguity: "the page never spells out that VSA and Victory Skating are the same business",
  },
  {
    key: "online delivery",
    present: /\bonline\b/i,
    structured: (j) => /"courseMode"\s*:\s*"online"|"deliveryMode"\s*:\s*"online"/i.test(j),
  },
  {
    key: "price",
    present: /\$299/,
    structured: (j) => /"price"\s*:\s*"?299/.test(j),
    ambiguity: "$299, $699, $6 and $60 appear in adjacent copy with no field to tell them apart",
  },
  {
    key: "duration",
    present: /6\s*months/i,
    structured: (j) => /"timeRequired"\s*:\s*"P6M"/.test(j),
  },
  {
    key: "coach",
    present: /Coach\s+Marta/i,
    structured: (j) => /"instructor"[\s\S]{0,200}Marta/.test(j),
  },
  {
    key: "schedule",
    present: /Saturday\s*&?\s*and?\s*Sunday|Saturday & Sunday/i,
    structured: (j) => /"startDate"\s*:\s*"20\d\d-/.test(j),
    ambiguity: "weekends are stated as prose; no machine-readable dates",
  },
  {
    key: "number of classes",
    present: /48\s+Live Group Classes|"totalSessions"\s*:\s*48|48 total/i,
    structured: (j) => /"numberOfCredits"\s*:\s*48/.test(j),
    ambiguity: "'2 Live Group Classes' and '48 Live Group Classes' sit side by side",
  },
  {
    key: "program description",
    present: /double axel/i,
    structured: (j) => /"description"\s*:\s*"[^"]{80,}/.test(j),
  },
  {
    key: "skater level",
    present: /double jumps off-ice|advanced/i,
    structured: (j) => /"educationalLevel"|"coursePrerequisites"/.test(j),
  },
  {
    key: "enrolment open now",
    present: /ongoing|enrol(ment)? is open|join at any time|any weekend/i,
    structured: (j) => /"availability"\s*:\s*"https:\/\/schema\.org\/InStock"/.test(j),
    ambiguity: "the page shows a start date that has passed and says nothing about joining later",
  },
  {
    key: "checkout action",
    present: /buy\.stripe\.com|\/enroll/,
    structured: (j) => /"@type"\s*:\s*"Offer"[\s\S]{0,400}"url"/.test(j),
  },
];

interface SourceReport {
  label: string;
  url: string;
  bytes: number;
  jsonLdGraphs: number;
  graphTypes: string[];
  present: string[];
  structured: string[];
  missing: string[];
  ambiguous: string[];
}

function stripTags(html: string) {
  const noCode = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  return noCode.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

async function inspect(label: string, url: string, extra: string[] = []): Promise<SourceReport> {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  const html = await res.text();
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]);
  const jsonLd = blocks.join("\n");
  // Count parsed graphs, not occurrences of the MIME type — a framework may
  // echo the same markup into its own payload and inflate a naive count.
  const graphTypes = new Set<string>();
  for (const b of blocks) {
    try {
      const t = JSON.parse(b)["@type"];
      if (typeof t === "string") graphTypes.add(t);
    } catch {}
  }

  // Everything an AI client could read from this origin, not just the HTML.
  const extras = await Promise.all(
    extra.map(async (p) => {
      try {
        const r = await fetch(new URL(p, url).toString(), { headers: { "user-agent": UA } });
        return r.ok ? await r.text() : "";
      } catch {
        return "";
      }
    }),
  );

  const text = [stripTags(html), jsonLd, ...extras].join("\n");
  const structuredBlob = [jsonLd, ...extras].join("\n");

  const present: string[] = [];
  const structured: string[] = [];
  const missing: string[] = [];
  const ambiguous: string[] = [];

  for (const f of FACTS) {
    const isPresent = f.present.test(text);
    if (!isPresent) {
      missing.push(f.key);
      continue;
    }
    present.push(f.key);
    if (f.structured?.(structuredBlob)) structured.push(f.key);
    else if (f.ambiguity) ambiguous.push(`${f.key} — ${f.ambiguity}`);
  }

  return {
    label,
    url,
    bytes: html.length,
    jsonLdGraphs: graphTypes.size,
    graphTypes: [...graphTypes],
    present,
    structured,
    missing,
    ambiguous,
  };
}

function bar(n: number, total: number) {
  const filled = Math.round((n / total) * 20);
  return "█".repeat(filled) + "░".repeat(20 - filled);
}

function print(r: SourceReport) {
  const t = FACTS.length;
  console.log(`\n${r.label}`);
  console.log(`  ${r.url}`);
  console.log(`  JSON-LD graphs: ${r.jsonLdGraphs}${r.graphTypes.length ? ` (${r.graphTypes.join(", ")})` : ""}`);
  console.log(`  retrievable at all   ${bar(r.present.length, t)}  ${r.present.length}/${t}`);
  console.log(`  machine-readable     ${bar(r.structured.length, t)}  ${r.structured.length}/${t}`);
  if (r.missing.length) console.log(`  missing: ${r.missing.join(", ")}`);
  if (r.ambiguous.length) {
    console.log("  present but left to inference:");
    for (const a of r.ambiguous) console.log(`    · ${a}`);
  }
}

async function main() {
  const after = process.argv[2] ?? "http://localhost:3077/";
  console.log(`Measuring ${FACTS.length} required facts against each source.`);

  const before = await inspect("BEFORE — original landing page", ORIGINAL);
  const now = await inspect("AFTER — AI commerce layer", after, ["/llms.txt", "/api/feed"]);

  print(before);
  print(now);

  const t = FACTS.length;
  console.log("\n" + "─".repeat(62));
  console.log(`retrievable   ${before.present.length}/${t}  →  ${now.present.length}/${t}`);
  console.log(`unambiguous   ${before.structured.length}/${t}  →  ${now.structured.length}/${t}`);
  console.log(`JSON-LD       ${before.jsonLdGraphs}  →  ${now.jsonLdGraphs}`);
  console.log("─".repeat(62));

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "\nSet ANTHROPIC_API_KEY to also have a model answer the brief's five\n" +
        "queries from each source and grade its own answers.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
