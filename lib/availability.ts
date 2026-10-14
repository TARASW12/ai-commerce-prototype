import type { ByDay, Program, Recurrence } from "@/adapters/types";

/**
 * Availability is computed from the recurrence rule, never read off the page.
 *
 * The landing page says "Join us on October 10". That sentence describes one
 * cohort that has already started. An assistant that treats it as the answer
 * to "can I join in November?" will say no, and the business loses the sale.
 *
 * Everything here works from the rule instead, so the answer stays correct for
 * any date a user names — this year or next.
 */

const DAY_INDEX: Record<ByDay, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

export interface Session {
  /** Full UTC instant the session starts. */
  startsAt: string;
  endsAt: string;
  /** Calendar date in UTC, for display. */
  date: string;
  weekday: string;
}

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function atUtc(day: Date, minutesUtc: number): Date {
  const d = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
  );
  d.setUTCMinutes(minutesUtc);
  return d;
}

/**
 * The next `count` sessions at or after `from`.
 *
 * A session happening later today still counts; one that already finished does
 * not.
 */
export function nextSessions(
  rec: Recurrence,
  from: Date = new Date(),
  count = 4,
): Session[] {
  const wanted = new Set(rec.byDay.map((d) => DAY_INDEX[d]));
  const until = rec.until ? new Date(rec.until) : undefined;
  const out: Session[] = [];

  // Five weeks of lookahead covers any weekly rule; the guard just stops a
  // malformed rule (empty byDay) from spinning.
  for (let offset = 0; offset < 35 && out.length < count; offset++) {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() + offset);
    if (!wanted.has(day.getUTCDay())) continue;

    const startsAt = atUtc(day, rec.startMinutesUtc);
    const endsAt = new Date(startsAt.getTime() + rec.durationMinutes * 60_000);
    if (endsAt <= from) continue;
    if (until && startsAt > until) break;

    out.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      date: startsAt.toISOString().slice(0, 10),
      weekday: WEEKDAYS[startsAt.getUTCDay()],
    });
  }
  return out;
}

export interface AvailabilityAnswer {
  available: boolean;
  /** Plain-language answer an assistant can read out verbatim. */
  explanation: string;
  requestedDate?: string;
  nextSessions: Session[];
  rollingEnrolment: boolean;
  /** Kept visible so a caller can see it was considered and deliberately not used as a gate. */
  firstCohortDate?: string;
}

/**
 * Answers "can I join around <date>?".
 *
 * The user's date is a hint about when they are free, not a booking slot. The
 * right reply names the sessions that actually follow it.
 */
export function checkAvailability(
  program: Program,
  requested?: string,
): AvailabilityAnswer {
  const rec = program.schedule.recurrence;
  const now = new Date();

  let from = now;
  let requestedDate: string | undefined;
  if (requested) {
    const parsed = new Date(`${requested}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      requestedDate = parsed.toISOString().slice(0, 10);
      // Never look into the past: a date already gone means "as soon as possible".
      from = parsed > now ? parsed : now;
    }
  }

  const sessions = nextSessions(rec, from, 4);
  const days = rec.byDay
    .map((d) => WEEKDAYS[DAY_INDEX[d]])
    .join(" and ");

  if (!sessions.length) {
    return {
      available: false,
      explanation: `The ${program.name} is not scheduled after ${requestedDate ?? "today"}.`,
      requestedDate,
      nextSessions: [],
      rollingEnrolment: rec.rollingEnrolment,
      firstCohortDate: rec.firstCohortDate,
    };
  }

  const first = sessions[0];
  const anchor = requestedDate
    ? `Around ${requestedDate}, the next session is ${first.weekday} ${first.date}.`
    : `The next session is ${first.weekday} ${first.date}.`;

  const rolling = rec.rollingEnrolment
    ? ` This is an ongoing program that runs every ${days}, so a skater can enrol at any time and start on the next weekend — the ${rec.firstCohortDate ?? "published"} start date on the landing page refers to an earlier cohort and does not close enrolment.`
    : "";

  return {
    available: true,
    explanation: anchor + rolling,
    requestedDate,
    nextSessions: sessions,
    rollingEnrolment: rec.rollingEnrolment,
    firstCohortDate: rec.firstCohortDate,
  };
}
