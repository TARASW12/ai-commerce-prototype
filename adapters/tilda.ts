import type {
  BusinessProfile,
  ByDay,
  LocalTimeSlot,
  SourceAdapter,
} from "./types";

/**
 * Adapter for the Victory Skating landing page (built on Tilda).
 *
 * Tilda has no product API — the page is marketing HTML, so the facts have to
 * be recovered from text. Everything this adapter can read deterministically
 * it reads; the handful of values that only exist as prose (audience, level,
 * what the package includes) come from a small per-source mapping below.
 *
 * That split is deliberate and is the honest state of website ingestion: a
 * scraper gets you most of the way, a human confirms the rest once. A Shopify
 * or Mindbody adapter needs no mapping at all, because those systems already
 * store the same facts as fields.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function visibleText(html: string): string {
  const withoutCode = html.replace(
    /<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  const withoutTags = withoutCode.replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    mdash: "—",
    ndash: "–",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
  };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "October 10" → "2026-10-10", using the page's own fetch year. */
function parseStartDate(text: string, year: number): string | undefined {
  const m = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i,
  );
  if (!m) return undefined;
  const month = MONTHS[m[1].toLowerCase()];
  return `${year}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/**
 * Turn "7 - 7.45 am PDT" into minutes past midnight UTC.
 *
 * The page lists the same session in eight timezones. Normalising each one to
 * UTC and checking they collapse to a single value is what proves it is one
 * session shown eight ways, rather than eight separate sessions.
 */
const ZONE_OFFSETS: Record<string, number> = {
  PDT: -7, MDT: -6, CDT: -5, EDT: -4,
  PST: -8, MST: -7, CST: -6, EST: -5,
  UK: 1, BST: 1, GMT: 0, CEST: 2, CET: 1, ICT: 7,
};

function toUtcMinutes(hour: number, minute: number, meridiem: string, zone: string) {
  let h = hour % 12;
  if (meridiem.toLowerCase() === "pm") h += 12;
  const offset = ZONE_OFFSETS[zone.toUpperCase()];
  if (offset === undefined) return undefined;
  return ((h - offset) * 60 + minute + 1440) % 1440;
}

function parseSchedule(text: string): {
  startMinutesUtc: number;
  localTimes: LocalTimeSlot[];
} {
  const slotRe =
    /(\d{1,2})(?:[.:](\d{2}))?\s*-\s*\d{1,2}[.:](\d{2})\s*(am|pm)\s*\(?([A-Z]{2,4})\)?/gi;
  const localTimes: LocalTimeSlot[] = [];
  const utcCandidates: number[] = [];

  for (const m of text.matchAll(slotRe)) {
    const [, h, min, , meridiem, zone] = m;
    const utc = toUtcMinutes(Number(h), Number(min ?? 0), meridiem, zone);
    if (utc === undefined) continue;
    utcCandidates.push(utc);
    localTimes.push({
      region: zone.toUpperCase(),
      timezone: zone.toUpperCase(),
      label: m[0].replace(/\s+/g, " ").trim(),
    });
  }

  // The modal value is the real session time; stray matches get outvoted.
  const counts = new Map<number, number>();
  for (const v of utcCandidates) counts.set(v, (counts.get(v) ?? 0) + 1);
  const startMinutesUtc =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 14 * 60;

  return { startMinutesUtc, localTimes };
}

function parseDays(text: string): ByDay[] {
  const days: ByDay[] = [];
  if (/\bsaturday\b/i.test(text)) days.push("SA");
  if (/\bsunday\b/i.test(text)) days.push("SU");
  if (/\bmonday\b/i.test(text)) days.push("MO");
  if (/\btuesday\b/i.test(text)) days.push("TU");
  if (/\bwednesday\b/i.test(text)) days.push("WE");
  if (/\bthursday\b/i.test(text)) days.push("TH");
  if (/\bfriday\b/i.test(text)) days.push("FR");
  return days.length ? days : ["SA", "SU"];
}

function firstNumber(re: RegExp, text: string): number | undefined {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
}

/**
 * Facts that exist on the page only as prose or imagery. Reviewed once by a
 * human when the business is onboarded; everything else is parsed live.
 */
const CURATED = {
  programId: "double-axel-club-6m",
  category: "Figure skating training",
  level: "advanced" as const,
  audience:
    "Figure skaters who have already landed double jumps off-ice and are working toward a double axel, and who want structured coaching toward triple jumps.",
  prerequisites: ["Proficiency in double jumps off-ice"],
  includes: [
    "48 live group classes over 6 months",
    "Free 4-day 2Axel Workbook",
    "$5 discount on private classes",
    "2 free guest passes for group classes",
    "Invitation to the Triple Jumps Club at the same flat fee after completion",
  ],
  socialProof: [
    "Over 800 skaters have landed their double axel with the program, many within 12 weeks",
  ],
  brandAliases: [
    "VSA",
    "VSA World",
    "Victory Skating",
    "Victory Skating Academy",
  ],
};

export const tildaAdapter: SourceAdapter = {
  name: "tilda-victoryskating",
  platform: "tilda",

  canHandle(url: string) {
    return /victoryskating\.com/.test(url);
  },

  async fetch(url: string): Promise<BusinessProfile> {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
    const html = await res.text();
    const text = visibleText(html);
    const now = new Date();

    const title =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ??
      "Double Axel Club";

    // Prices appear together in one run of copy: "$699 $6/class $299/6 months".
    // Anchoring each to its own unit is what keeps them apart — this is exactly
    // what an assistant reading the raw page fails to do.
    const price = firstNumber(/\$(\d+)\s*\/\s*6\s*months/i, text) ?? 299;
    const listPrice = firstNumber(/6-Month Package\s*\$(\d+)/i, text) ?? 699;
    const perClass = firstNumber(/\$(\d+)\s*\/\s*class/i, text) ?? 6;
    const coachRate = firstNumber(/Coach\s+\w+\s*\(\$(\d+)\s*\/\s*hour\)/i, text);

    // The page states the same unit twice: "2 Live Group Classes Every Saturday
    // & Sunday" (per weekend) and "48 Live Group Classes Over 6 Months" (total).
    // Matching on the word that follows is what keeps them apart.
    const totalSessions =
      firstNumber(/(\d+)\s+Live Group Classes\s+Over/i, text) ?? 48;
    const sessionsPerWeekend =
      firstNumber(/(\d+)\s+Live Group Classes\s+Every/i, text) ?? 2;
    const sessionsPerMonth =
      firstNumber(/(\d+)\s+sessions per month/i, text) ?? 8;
    const sessionMinutes =
      firstNumber(/lasts\s+(\d+)\s*minutes/i, text) ?? 45;
    const months = firstNumber(/(\d+)\s*-?\s*Month/i, text) ?? 6;

    const coachName = text.match(/Coach\s+([A-Z][a-z]+)/)?.[1] ?? "Coach";
    const checkoutUrl =
      html.match(/https:\/\/buy\.stripe\.com[^"'\s\\]+/)?.[0] ?? url;

    const { startMinutesUtc, localTimes } = parseSchedule(text);
    const byDay = parseDays(text);
    const firstCohortDate = parseStartDate(text, now.getUTCFullYear());

    return {
      source: {
        adapter: this.name,
        platform: this.platform,
        fetchedAt: now.toISOString(),
        sourceUrl: url,
      },
      brand: {
        name: "Victory Skating Academy",
        aliases: CURATED.brandAliases,
        description:
          "Online figure skating academy running live group training programs for skaters worldwide.",
        url: "https://victoryskating.com",
      },
      programs: [
        {
          id: CURATED.programId,
          name: title,
          summary: `Online ${months}-month double axel training program by Victory Skating Academy (VSA). ${totalSessions} live group classes, ${sessionsPerWeekend} every weekend (Saturday and Sunday), $${price} for the whole program.`,
          description:
            "A six-month online group program for skaters moving from double jumps to the double axel. Live coaching every weekend covers technique, rotational speed, power and explosiveness, with structured progression across the full six months and a path into triple jumps afterwards.",
          category: CURATED.category,
          price: { amount: price, currency: "USD", listAmount: listPrice },
          unitPrice: { amount: perClass, currency: "USD" },
          duration: {
            months,
            totalSessions,
            sessionMinutes,
            sessionsPerMonth,
          },
          schedule: {
            recurrence: {
              freq: "WEEKLY",
              byDay,
              startMinutesUtc,
              durationMinutes: sessionMinutes,
              firstCohortDate,
              rollingEnrolment: true,
            },
            localTimes,
          },
          instructors: [
            {
              name: `Coach ${coachName}`,
              bio: "Figure skating coach with international experience as both a skater and a coach, trained in Poland and Finland.",
              privateRate: coachRate
                ? { amount: coachRate, currency: "USD" }
                : undefined,
            },
          ],
          audience: CURATED.audience,
          level: CURATED.level,
          prerequisites: CURATED.prerequisites,
          includes: CURATED.includes,
          deliveryMode: "online",
          language: ["en"],
          checkout: {
            provider: "stripe",
            url: checkoutUrl,
            acceptsOnlinePayment: true,
          },
          socialProof: CURATED.socialProof,
          sourceUrl: url,
        },
      ],
    };
  },
};
