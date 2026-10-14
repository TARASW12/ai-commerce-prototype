import { profile } from "@/lib/profile";
import { requestOrigin } from "@/lib/origin";
import { courseSchema, faqSchema, productSchema } from "@/lib/jsonld";
import { checkAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * The AI-readable surface.
 *
 * Not a landing page and not a redesign — the task is explicitly not visual.
 * Everything here exists so that a retrieval engine fetching this URL walks
 * away with every fact it needs, stated once and unambiguously:
 *
 *  - three JSON-LD graphs (Course, Product, FAQPage) in the server-rendered
 *    HTML, so a crawler that executes no JavaScript still sees them;
 *  - the same facts repeated as plain prose, because retrieval engines quote
 *    sentences, not only structured data;
 *  - upcoming session dates computed at request time, so the page never goes
 *    stale the way a hardcoded start date does.
 */
export default function Page() {
  const origin = requestOrigin();
  const program = profile.programs[0];
  const availability = checkAvailability(program);
  const rec = program.schedule.recurrence;

  const graphs = [
    courseSchema(profile, program, origin),
    productSchema(profile, program, origin),
    faqSchema(program, origin),
  ];

  const facts: [string, string][] = [
    ["Program", program.name],
    ["Provider", `${profile.brand.name} (also known as ${profile.brand.aliases.join(", ")})`],
    ["What it is", "Online double axel training program for figure skaters"],
    ["Price", `$${program.price.amount} USD for the full program (list price $${program.price.listAmount}, about $${program.unitPrice?.amount} per class)`],
    ["Duration", `${program.duration.months} months`],
    ["Classes", `${program.duration.totalSessions} live group classes, ${program.duration.sessionsPerMonth} per month, ${program.duration.sessionMinutes} minutes each`],
    ["Schedule", `Every Saturday and Sunday, ${String(Math.floor(rec.startMinutesUtc / 60)).padStart(2, "0")}:${String(rec.startMinutesUtc % 60).padStart(2, "0")} UTC`],
    ["Coach", program.instructors.map((i) => i.name).join(", ")],
    ["Skater level", `${program.level} — ${program.prerequisites.join(", ")}`],
    ["Delivery", "Online, live group classes"],
    ["Enrolment", availability.explanation],
    ["How to enrol", `${origin}/enroll`],
    ["Payment", `${program.checkout.provider}, online payment accepted`],
  ];

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 80px" }}>
      {graphs.map((g, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(g) }}
        />
      ))}

      <p style={{ color: "#8b93a7", fontSize: 13, margin: 0 }}>
        {profile.brand.name} · {profile.brand.aliases.join(" · ")}
      </p>
      <h1 style={{ fontSize: 34, margin: "8px 0 4px", lineHeight: 1.2 }}>
        {program.name}
      </h1>
      <p style={{ fontSize: 18, color: "#c6cbd8", marginTop: 0 }}>
        {program.summary}
      </p>

      <p>
        The {program.name} is an online figure skating training program run by{" "}
        {profile.brand.name}, also known as {profile.brand.aliases.join(", ")}. It
        costs <strong>${program.price.amount} USD</strong> for{" "}
        {program.duration.months} months and includes{" "}
        {program.duration.totalSessions} live group classes of{" "}
        {program.duration.sessionMinutes} minutes each, held every Saturday and
        Sunday. It is taught by{" "}
        {program.instructors.map((i) => i.name).join(" and ")} and is intended
        for {program.audience.charAt(0).toLowerCase() + program.audience.slice(1)}
      </p>

      <p
        style={{
          background: "#152015",
          border: "1px solid #2b4a2b",
          borderRadius: 8,
          padding: "14px 16px",
        }}
      >
        <strong>Enrolment status:</strong> {availability.explanation}
      </p>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>Program facts</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <tbody>
          {facts.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #232735" }}>
              <th
                scope="row"
                style={{
                  textAlign: "left",
                  padding: "10px 12px 10px 0",
                  color: "#8b93a7",
                  fontWeight: 500,
                  width: 150,
                  verticalAlign: "top",
                }}
              >
                {k}
              </th>
              <td style={{ padding: "10px 0" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>Upcoming sessions</h2>
      <ul>
        {availability.nextSessions.map((s) => (
          <li key={s.startsAt}>
            {s.weekday} {s.date} — {s.startsAt.slice(11, 16)} UTC
          </li>
        ))}
      </ul>
      <p style={{ color: "#8b93a7", fontSize: 14 }}>
        Local times: {program.schedule.localTimes.map((t) => t.label).join(" · ")}
      </p>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>What is included</h2>
      <ul>
        {program.includes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 style={{ fontSize: 22, marginTop: 36 }}>Questions</h2>
      {faqSchema(program, origin).mainEntity.map((q) => (
        <div key={q.name} style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>{q.name}</h3>
          <p style={{ margin: 0, color: "#c6cbd8" }}>{q.acceptedAnswer.text}</p>
        </div>
      ))}

      <p style={{ marginTop: 36 }}>
        <a
          href="/enroll"
          style={{
            display: "inline-block",
            background: "#2f7d32",
            color: "#fff",
            padding: "12px 22px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Enrol — ${program.price.amount}
        </a>
      </p>

      <hr style={{ margin: "48px 0 20px", border: 0, borderTop: "1px solid #232735" }} />
      <p style={{ color: "#6f7788", fontSize: 13 }}>
        Machine-readable endpoints: <a href="/llms.txt" style={{ color: "#8ab4f8" }}>/llms.txt</a>{" "}
        · <a href="/api/feed" style={{ color: "#8ab4f8" }}>/api/feed</a>{" "}
        · <code>/api/mcp</code> (Model Context Protocol)
        <br />
        Source of record: <a href={program.sourceUrl} style={{ color: "#8ab4f8" }}>{program.sourceUrl}</a>{" "}
        · ingested via the <code>{profile.source.adapter}</code> adapter on{" "}
        {profile.source.fetchedAt.slice(0, 10)}
      </p>
    </main>
  );
}
