/**
 * The normalized business profile.
 *
 * This is the only shape the rest of the system knows about. Every source
 * adapter (Tilda, Shopify, WooCommerce, Mindbody, Fresha, …) is responsible
 * for producing this and nothing else. Every output channel (JSON-LD page,
 * llms.txt, JSON feed, MCP tools, checkout) consumes this and nothing else.
 *
 * Adding a new platform therefore means writing one adapter. No other file
 * in the project changes.
 */

export type Currency = "USD" | "EUR" | "GBP";

/** ISO weekday codes as used by RFC 5545 (iCalendar) RRULE. */
export type ByDay = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface Money {
  amount: number;
  currency: Currency;
  /** Undiscounted price, when the business advertises a discount. */
  listAmount?: number;
}

/**
 * Recurrence is stored as a rule, never as a list of dates.
 *
 * This is the single most important modelling decision in the prototype.
 * A landing page says "Join us on October 10" — that is marketing copy about
 * one historical cohort. The business reality is "every Saturday and Sunday,
 * ongoing". If availability is derived from the page text, an assistant will
 * tell a user in November that enrolment closed in October. If it is derived
 * from the rule, the assistant answers correctly for any date, forever.
 */
export interface Recurrence {
  freq: "WEEKLY";
  byDay: ByDay[];
  /** Start time of each session, as minutes past midnight UTC. */
  startMinutesUtc: number;
  durationMinutes: number;
  /** When the program first ran. Historical context only — never a gate. */
  firstCohortDate?: string;
  /** Hard stop, if the business ever sets one. */
  until?: string;
  /** True when a skater may join at any point in the cycle. */
  rollingEnrolment: boolean;
}

/** A human-facing rendering of the same UTC moment in a local timezone. */
export interface LocalTimeSlot {
  region: string;
  timezone: string;
  label: string;
}

export interface Instructor {
  name: string;
  bio?: string;
  credentials?: string[];
  privateRate?: Money;
}

export interface Program {
  id: string;
  name: string;
  /** Short summary written for a machine reader, not for a hero banner. */
  summary: string;
  description: string;
  category: string;
  price: Money;
  /** Price per individual session, when the business advertises one. */
  unitPrice?: Money;
  duration: {
    months?: number;
    totalSessions: number;
    sessionMinutes: number;
    sessionsPerMonth?: number;
  };
  schedule: {
    recurrence: Recurrence;
    localTimes: LocalTimeSlot[];
  };
  instructors: Instructor[];
  /** Who the program is for, in plain language. */
  audience: string;
  level: "beginner" | "intermediate" | "advanced";
  prerequisites: string[];
  includes: string[];
  deliveryMode: "online" | "in_person" | "hybrid";
  language: string[];
  checkout: {
    /** Where money is actually taken. The source of record stays external. */
    provider: "stripe" | "shopify" | "mindbody" | "fresha" | "custom";
    url: string;
    acceptsOnlinePayment: boolean;
  };
  socialProof?: string[];
  sourceUrl: string;
}

export interface Brand {
  name: string;
  /**
   * Every name a customer might use. Assistants fail on brand variants more
   * often than on anything else: a user asking about "VSA" and a user asking
   * about "Victory Skating" must reach the same answer.
   */
  aliases: string[];
  description: string;
  url: string;
  logo?: string;
}

export interface BusinessProfile {
  /** Which adapter produced this, and when. */
  source: {
    adapter: string;
    platform: string;
    fetchedAt: string;
    sourceUrl: string;
  };
  brand: Brand;
  programs: Program[];
}

/**
 * The contract every adapter implements.
 *
 * Tilda scrapes HTML. Shopify calls the Admin API. Mindbody calls a booking
 * API. All three return this.
 */
export interface SourceAdapter {
  readonly name: string;
  readonly platform: string;
  /** Cheap check so a dispatcher can pick the right adapter for a URL. */
  canHandle(url: string): Promise<boolean> | boolean;
  fetch(url: string): Promise<BusinessProfile>;
}
