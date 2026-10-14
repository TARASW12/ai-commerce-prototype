import type { BusinessProfile, Program } from "@/adapters/types";
import { nextSessions } from "./availability";

/**
 * Schema.org output — the only channel a retrieval engine like Perplexity can
 * actually consume today.
 *
 * Three things here are doing the real work:
 *
 *  1. `alternateName` on the provider. The brand is sold as "VSA" as often as
 *     "Victory Skating Academy"; without this, half the queries miss.
 *  2. One `Offer` with one `price`. The source page shows $699, $299, $6 and
 *     $60 in adjacent copy, which is why assistants quote the wrong one. Stated
 *     as a typed field, there is nothing left to guess.
 *  3. Concrete `CourseInstance` entries generated from the recurrence rule, so
 *     the dates an assistant reads are upcoming weekends rather than a start
 *     date that has already passed.
 */

export function courseSchema(
  profile: BusinessProfile,
  program: Program,
  origin: string,
) {
  const rec = program.schedule.recurrence;
  const upcoming = nextSessions(rec, new Date(), 8);

  const provider = {
    "@type": "Organization",
    name: profile.brand.name,
    alternateName: profile.brand.aliases,
    url: profile.brand.url,
    description: profile.brand.description,
  };

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${origin}/#${program.id}`,
    name: program.name,
    description: program.description,
    abstract: program.summary,
    url: `${origin}/`,
    sameAs: program.sourceUrl,
    provider,
    brand: provider,
    inLanguage: program.language,
    educationalLevel: program.level,
    teaches: "Double axel jump technique for figure skaters",
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
      audienceType: program.audience,
    },
    coursePrerequisites: program.prerequisites.join("; "),
    numberOfCredits: program.duration.totalSessions,
    timeRequired: `P${program.duration.months ?? 6}M`,
    offers: {
      "@type": "Offer",
      "@id": `${origin}/#offer`,
      price: program.price.amount,
      priceCurrency: program.price.currency,
      availability: "https://schema.org/InStock",
      // Rolling enrolment, stated as a field rather than left to inference.
      availabilityStarts: new Date().toISOString().slice(0, 10),
      url: `${origin}/enroll`,
      category: "Subscription",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: program.price.amount,
        priceCurrency: program.price.currency,
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: program.duration.totalSessions,
          unitText: "live group classes",
        },
        ...(program.price.listAmount
          ? {
              valueAddedTaxIncluded: false,
              description: `Discounted from the $${program.price.listAmount} list price`,
            }
          : {}),
      },
      seller: provider,
    },
    hasCourseInstance: upcoming.map((s) => ({
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${program.duration.sessionMinutes}M`,
      startDate: s.startsAt,
      endDate: s.endsAt,
      location: { "@type": "VirtualLocation", url: profile.brand.url },
      instructor: program.instructors.map((i) => ({
        "@type": "Person",
        name: i.name,
        description: i.bio,
      })),
    })),
    syllabusSections: program.includes.map((item, i) => ({
      "@type": "Syllabus",
      position: i + 1,
      name: item,
    })),
  };
}

/**
 * The questions a buyer actually asks, answered as data.
 *
 * FAQPage is the cheapest way to hand a retrieval engine a quotable sentence
 * for each fact, including the one the landing page gets wrong by omission:
 * whether you can still join.
 */
export function faqSchema(program: Program, origin: string) {
  const rec = program.schedule.recurrence;
  const upcoming = nextSessions(rec, new Date(), 2);
  const days = rec.byDay.includes("SA") && rec.byDay.includes("SU")
    ? "Saturday and Sunday"
    : rec.byDay.join(", ");

  const qa: [string, string][] = [
    [
      `How much does the ${program.name} cost?`,
      `$${program.price.amount} for the full ${program.duration.months}-month program, which works out to about $${program.unitPrice?.amount ?? Math.round(program.price.amount / program.duration.totalSessions)} per class. The list price is $${program.price.listAmount}.`,
    ],
    [
      "Can I still join, or has enrolment closed?",
      `Enrolment is open and ongoing. The program runs every ${days}, so a new skater can join at any time and start on the next weekend${upcoming[0] ? ` — the next session is ${upcoming[0].weekday} ${upcoming[0].date}` : ""}. The start date shown on the original landing page refers to an earlier cohort.`,
    ],
    [
      "What is included?",
      program.includes.join(". ") + ".",
    ],
    [
      "When are the classes?",
      `Every ${days}. Each session lasts ${program.duration.sessionMinutes} minutes, ${program.duration.sessionsPerMonth} sessions per month, ${program.duration.totalSessions} in total. Sessions run at ${program.schedule.localTimes.map((t) => t.label).slice(0, 4).join(", ")}.`,
    ],
    [
      "Who teaches the program?",
      program.instructors
        .map((i) => `${i.name}. ${i.bio ?? ""}`.trim())
        .join(" "),
    ],
    [
      "Who is this program for?",
      `${program.audience} Prerequisite: ${program.prerequisites.join(", ")}.`,
    ],
    [
      "How do I enrol?",
      `Enrol at ${origin}/enroll, which opens the checkout. Payment is handled by ${program.checkout.provider}.`,
    ],
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function productSchema(
  profile: BusinessProfile,
  program: Program,
  origin: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${profile.brand.name} — ${program.name}`,
    description: program.summary,
    category: program.category,
    brand: {
      "@type": "Brand",
      name: profile.brand.name,
      alternateName: profile.brand.aliases,
    },
    offers: {
      "@type": "Offer",
      price: program.price.amount,
      priceCurrency: program.price.currency,
      availability: "https://schema.org/InStock",
      url: `${origin}/enroll`,
    },
  };
}
