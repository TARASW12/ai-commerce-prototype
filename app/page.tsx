import { profile, FEATURED_ID } from "@/lib/profile";
import { requestOrigin } from "@/lib/origin";
import { checkAvailability } from "@/lib/availability";
import { utcHHMM, days } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The catalog.
 *
 * An assistant asked "what does VSA offer?" should get the whole ladder in one
 * fetch, with a link to the detail page for each program. The `ItemList` graph
 * is what lets it do that without guessing from the markup.
 *
 * Per-program detail — and the Course / Product / FAQPage graphs that carry the
 * facts — lives at /programs/<id>.
 */
export default function Catalog() {
  const origin = requestOrigin();

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${profile.brand.name} training programs`,
    numberOfItems: profile.programs.length,
    itemListElement: profile.programs.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${origin}/programs/${p.id}`,
      name: p.name,
    })),
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: profile.brand.name,
    alternateName: profile.brand.aliases,
    description: profile.brand.description,
    url: profile.brand.url,
    sameAs: [profile.brand.url],
  };

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 80px" }}>
      {[organization, itemList].map((g, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(g) }}
        />
      ))}

      <h1 style={{ fontSize: 32, margin: "0 0 4px" }}>{profile.brand.name}</h1>
      <p style={{ color: "#8b93a7", margin: "0 0 18px", fontSize: 14 }}>
        Also known as {profile.brand.aliases.join(", ")}
      </p>
      <p style={{ fontSize: 17, color: "#c6cbd8" }}>
        {profile.brand.description} All programs are ongoing and run every
        weekend, so a skater can enrol at any time and start on the next
        weekend.
      </p>

      {profile.programs.map((p) => {
        const a = checkAvailability(p);
        const featured = p.id === FEATURED_ID;
        return (
          <section
            key={p.id}
            style={{
              border: `1px solid ${featured ? "#2b4a2b" : "#232735"}`,
              borderRadius: 10,
              padding: "18px 20px",
              marginTop: 18,
            }}
          >
            <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>
              <a
                href={`/programs/${p.id}`}
                style={{ color: "#e6e8ec", textDecoration: "none" }}
              >
                {p.name}
              </a>
            </h2>
            <p style={{ margin: "0 0 10px", color: "#c6cbd8", fontSize: 15 }}>
              {p.summary}
            </p>
            <p style={{ margin: 0, color: "#8b93a7", fontSize: 14 }}>
              ${p.price.amount} · {p.duration.totalSessions} classes ·{" "}
              {p.level} · every {days(p)} at{" "}
              {utcHHMM(p.schedule.recurrence.startMinutesUtc)} UTC ·{" "}
              {p.instructors.map((i) => i.name).join(", ")}
            </p>
            <p style={{ margin: "8px 0 0", color: "#8b93a7", fontSize: 14 }}>
              Next session: {a.nextSessions[0]?.weekday}{" "}
              {a.nextSessions[0]?.date} ·{" "}
              <a href={`/programs/${p.id}`} style={{ color: "#8ab4f8" }}>
                details
              </a>{" "}
              ·{" "}
              <a href={`/enroll?program=${p.id}`} style={{ color: "#8ab4f8" }}>
                enrol ${p.price.amount}
              </a>
            </p>
          </section>
        );
      })}

      <hr
        style={{ margin: "40px 0 20px", border: 0, borderTop: "1px solid #232735" }}
      />
      <p style={{ color: "#6f7788", fontSize: 13 }}>
        Machine-readable endpoints:{" "}
        <a href="/llms.txt" style={{ color: "#8ab4f8" }}>
          /llms.txt
        </a>{" "}
        ·{" "}
        <a href="/api/feed" style={{ color: "#8ab4f8" }}>
          /api/feed
        </a>{" "}
        · <code>/api/mcp</code> (Model Context Protocol) ·{" "}
        <a href="/sitemap.xml" style={{ color: "#8ab4f8" }}>
          /sitemap.xml
        </a>
        <br />
        Ingested from{" "}
        <a href={profile.brand.url} style={{ color: "#8ab4f8" }}>
          {profile.brand.url}
        </a>{" "}
        via the <code>{profile.source.adapter}</code> adapter on{" "}
        {profile.source.fetchedAt.slice(0, 10)}. Prototype built for a hiring
        assignment; not operated by or affiliated with Victory Skating / VSA.
      </p>
    </main>
  );
}
