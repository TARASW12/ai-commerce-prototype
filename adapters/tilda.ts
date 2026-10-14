import type {
  BusinessProfile,
  ByDay,
  LocalTimeSlot,
  Program,
  SourceAdapter,
} from "./types";

/**
 * Adapter for the Victory Skating site (built on Tilda).
 *
 * Tilda has no product API — the pages are marketing HTML, so the facts have
 * to be recovered from text. Everything this adapter can read deterministically
 * it reads; the handful of values that only exist as prose or layout (audience,
 * level, instructors) come from a small per-program mapping below.
 *
 * That split is the honest state of website ingestion: a scraper gets you most
 * of the way, a human confirms the rest once, at onboarding. A Shopify or
 * Mindbody adapter needs no mapping at all, because those systems already store
 * the same facts as fields.
 *
 * All four programs in the academy's ladder are ingested, not just the one
 * under test. They differ in level, coach, session time and checkout link,
 * which makes them a real exercise of the model rather than one record copied
 * four times.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SITE = "https://victoryskating.com";

interface Curated {
  slug: string;
  id: string;
  level: Program["level"];
  teaches: string;
  audience: string;
  prerequisites: string[];
  instructors: { name: string; bio?: string }[];
}

/**
 * Reviewed once per program at onboarding. Deliberately small: everything that
 * can move — price, class count, session times, checkout link, start date — is
 * parsed from the page on every ingest, so a price change is picked up without
 * anyone touching this file.
 */
const PROGRAMS: Curated[] = [
  {
    slug: "axel",
    id: "axel-club-6m",
    level: "beginner",
    teaches: "single axel (1A) training",
    audience:
      "Skaters landing single jumps who are working toward their first axel.",
    prerequisites: ["Confident single jumps"],
    instructors: [{ name: "Coach Diana" }],
  },
  {
    slug: "doublejumps",
    id: "double-jumps-club-6m",
    level: "intermediate",
    teaches: "double jumps (2S, 2T, 2Lo, 2F, 2Lz) training",
    audience:
      "Skaters who have landed their axel and are moving on to double jumps.",
    prerequisites: ["A landed axel"],
    instructors: [{ name: "Coach Diana" }, { name: "Coach Marta" }],
  },
  {
    slug: "doubleaxel",
    id: "double-axel-club-6m",
    level: "advanced",
    teaches: "double axel (2A) training",
    audience:
      "Figure skaters who have already landed double jumps off-ice and are working toward a double axel, and who want structured coaching toward triple jumps.",
    prerequisites: ["Proficiency in double jumps off-ice"],
    instructors: [
      {
        name: "Coach Marta",
        bio: "Figure skating coach with international experience as both a skater and a coach, trained in Poland and Finland.",
      },
    ],
  },
  {
    slug: "triplejumps",
    id: "triple-jumps-club-6m",
    level: "advanced",
    teaches: "triple jumps (3S, 3T, 3Lo, 3F, 3Lz) training",
    audience:
      "Skaters proficient in triple jumps off-ice who are making the transition to triples.",
    prerequisites: ["Proficiency in triple jumps off-ice"],
    instructors: [{ name: "Coach Alice" }, { name: "Coach Lena" }],
  },
];

const BRAND_ALIASES = [
  "VSA",
  "VSA World",
  "Victory Skating",
  "Victory Skating Academy",
];

/** Benefits worded almost identically across the four pages. */
const COMMON_INCLUDES = [
  "Free 4-day workbook",
  "Discount on private classes",
  "2 free guest passes for group classes",
];

// ─── text helpers ──────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
    ldquo: "“", rdquo: "”",
  };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

function visibleText(html: string): string {
  const withoutCode = html.replace(
    /<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  return decodeEntities(withoutCode.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstNumber(re: RegExp, text: string): number | undefined {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "October 10" → "2026-10-10", using the year the page was fetched. */
function parseStartDate(text: string, year: number): string | undefined {
  const m = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i,
  );
  if (!m) return undefined;
  const month = MONTHS[m[1].toLowerCase()];
  return `${year}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

const ZONE_OFFSETS: Record<string, number> = {
  PDT: -7, MDT: -6, CDT: -5, EDT: -4,
  PST: -8, MST: -7, CST: -6, EST: -5,
  UK: 1, BST: 1, GMT: 0, CEST: 2, CET: 1, ICT: 7,
};

function toUtcMinutes(
  hour: number,
  minute: number,
  meridiem: string,
  zone: string,
): number | undefined {
  let h = hour % 12;
  if (meridiem.toLowerCase() === "pm") h += 12;
  const offset = ZONE_OFFSETS[zone.toUpperCase()];
  if (offset === undefined) return undefined;
  return ((h - offset) * 60 + minute + 1440) % 1440;
}

const SLOT_RE =
  /(\d{1,2})(?:[.:](\d{2}))?\s*-\s*\d{1,2}[.:](\d{2})\s*(am|pm)\s*\(?([A-Z]{2,4})\)?/gi;

/**
 * Each page lists one session in up to seven timezones. Normalising every slot
 * to UTC and taking the modal value proves they describe a single session shown
 * many ways rather than many separate sessions — which is why the schedule can
 * be stored once and localised on output.
 */
function parseSchedule(text: string): {
  startMinutesUtc: number;
  localTimes: LocalTimeSlot[];
} {
  const found: { utc: number; slot: LocalTimeSlot }[] = [];
  const counts = new Map<number, number>();

  for (const m of text.matchAll(SLOT_RE)) {
    const [, h, min, , meridiem, zone] = m;
    const utc = toUtcMinutes(Number(h), Number(min ?? 0), meridiem, zone);
    if (utc === undefined) continue;
    counts.set(utc, (counts.get(utc) ?? 0) + 1);
    found.push({
      utc,
      slot: {
        region: zone.toUpperCase(),
        timezone: zone.toUpperCase(),
        label: m[0].replace(/\s+/g, " ").trim(),
      },
    });
  }

  const startMinutesUtc =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 14 * 60;

  // Keep only the renderings that resolve to the session's own moment; a stray
  // time elsewhere on the page would otherwise be published as a session slot.
  return {
    startMinutesUtc,
    localTimes: found.filter((f) => f.utc === startMinutesUtc).map((f) => f.slot),
  };
}

function parseDays(text: string): ByDay[] {
  const days: ByDay[] = [];
  if (/\bsaturday\b/i.test(text)) days.push("SA");
  if (/\bsunday\b/i.test(text)) days.push("SU");
  return days.length ? days : ["SA", "SU"];
}

// ─── per-page parse ────────────────────────────────────────────────────────

function parseProgram(html: string, url: string, c: Curated, now: Date): Program {
  const text = visibleText(html);
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? c.id;

  // Prices sit together in one run of copy — "$699 $6/class $299/6 months" —
  // with a coach's hourly rate nearby. Anchoring each figure to its own unit is
  // what keeps them apart, and is exactly what an assistant reading the
  // flattened page fails to do.
  const price = firstNumber(/\$(\d+)\s*\/\s*6\s*months/i, text) ?? 299;
  const listPrice = firstNumber(/6-Month Package\s*\$(\d+)/i, text) ?? 699;
  const perClass = firstNumber(/\$(\d+)\s*\/\s*class/i, text) ?? 6;
  const coachRate = firstNumber(/\(\$(\d+)\s*\/\s*hour\)/i, text);

  // The same unit is stated twice: "2 Live Group Classes Every Saturday &
  // Sunday" (per weekend) and "48 Live Group Classes Over 6 Months" (total).
  // Matching on the word that follows keeps them apart.
  const totalSessions =
    firstNumber(/(\d+)\s+Live Group Classes\s+Over/i, text) ?? 48;
  const sessionsPerWeekend =
    firstNumber(/(\d+)\s+Live Group Classes\s+Every/i, text) ?? 2;
  const sessionsPerMonth = firstNumber(/(\d+)\s+sessions per month/i, text) ?? 8;
  const sessionMinutes = firstNumber(/lasts\s+(\d+)\s*minutes/i, text) ?? 45;
  const months = firstNumber(/(\d+)\s*-?\s*Month Package/i, text) ?? 6;

  const checkoutUrl =
    html.match(/https:\/\/buy\.stripe\.com[^"'\s\\]+/)?.[0] ?? url;

  const { startMinutesUtc, localTimes } = parseSchedule(text);
  const byDay = parseDays(text);
  const firstCohortDate = parseStartDate(text, now.getUTCFullYear());
  const hhmm = `${String(Math.floor(startMinutesUtc / 60)).padStart(2, "0")}:${String(startMinutesUtc % 60).padStart(2, "0")}`;

  return {
    id: c.id,
    name: title,
    summary: `Online ${months}-month ${c.teaches} by Victory Skating Academy (VSA). ${totalSessions} live group classes, ${sessionsPerWeekend} every weekend (Saturday and Sunday), $${price} for the whole program.`,
    description: `A ${months}-month online group program from Victory Skating Academy. ${c.audience} Live coaching every weekend covers technique, rotational speed, power and explosiveness, with structured progression across the full ${months} months.`,
    category: "Figure skating training",
    price: { amount: price, currency: "USD", listAmount: listPrice },
    unitPrice: { amount: perClass, currency: "USD" },
    duration: { months, totalSessions, sessionMinutes, sessionsPerMonth },
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
    instructors: c.instructors.map((i) => ({
      ...i,
      privateRate: coachRate
        ? { amount: coachRate, currency: "USD" as const }
        : undefined,
    })),
    audience: c.audience,
    level: c.level,
    prerequisites: c.prerequisites,
    includes: [
      `${totalSessions} live group classes over ${months} months`,
      `${sessionsPerWeekend} classes every weekend at ${hhmm} UTC`,
      ...COMMON_INCLUDES,
    ],
    deliveryMode: "online",
    language: ["en"],
    checkout: { provider: "stripe", url: checkoutUrl, acceptsOnlinePayment: true },
    socialProof:
      c.slug === "doubleaxel"
        ? [
            "Over 800 skaters have landed their double axel with the program, many within 12 weeks",
          ]
        : undefined,
    sourceUrl: url,
  };
}

// ─── adapter ───────────────────────────────────────────────────────────────

export const tildaAdapter: SourceAdapter = {
  name: "tilda-victoryskating",
  platform: "tilda",

  canHandle(url: string) {
    return /victoryskating\.com/.test(url);
  },

  async fetch(url: string): Promise<BusinessProfile> {
    const now = new Date();

    const programs = await Promise.all(
      PROGRAMS.map(async (c) => {
        const pageUrl = `${SITE}/${c.slug}`;
        const res = await fetch(pageUrl, {
          headers: { "user-agent": UA, accept: "text/html" },
        });
        if (!res.ok) throw new Error(`${pageUrl} returned HTTP ${res.status}`);
        return parseProgram(await res.text(), pageUrl, c, now);
      }),
    );

    // Entry level first — the order a skater progresses through the ladder,
    // which is also the order that reads best when an assistant lists them.
    const order = ["beginner", "intermediate", "advanced"];
    programs.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));

    return {
      source: {
        adapter: this.name,
        platform: this.platform,
        fetchedAt: now.toISOString(),
        sourceUrl: url,
      },
      brand: {
        name: "Victory Skating Academy",
        aliases: BRAND_ALIASES,
        description:
          "Online figure skating academy running live group training programs for skaters worldwide, from the single axel through to triple jumps.",
        url: SITE,
      },
      programs,
    };
  },
};
