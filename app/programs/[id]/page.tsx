import { notFound } from "next/navigation";
import { profile, getProgram } from "@/lib/profile";
import { siteOrigin } from "@/lib/origin";
import { ProgramView } from "@/components/program-view";
import type { Metadata } from "next";

export const revalidate = 3600;

/** Prerender every program so crawlers get a cached, instantly served page. */
export function generateStaticParams() {
  return profile.programs.map((p) => ({ id: p.id }));
}


export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const p = getProgram(params.id);
  if (!p) return {};
  return {
    title: `${p.name} — ${profile.brand.name} (VSA)`,
    description: p.summary,
    openGraph: { title: p.name, description: p.summary, type: "website" },
  };
}

export default function ProgramPage({ params }: { params: { id: string } }) {
  const program = profile.programs.find((p) => p.id === params.id);
  if (!program) notFound();
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 80px" }}>
      <p style={{ margin: "0 0 20px" }}>
        <a href="/" style={{ color: "#8ab4f8", fontSize: 14, textDecoration: "none" }}>
          ← all programs
        </a>
      </p>
      <ProgramView profile={profile} program={program} origin={siteOrigin()} />
    </main>
  );
}
