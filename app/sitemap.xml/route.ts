import { profile } from "@/lib/profile";
import { siteOrigin } from "@/lib/origin";

export const revalidate = 3600;

export async function GET() {
  const origin = siteOrigin();
  const lastmod = profile.source.fetchedAt.slice(0, 10);

  const paths = [
    "/",
    "/llms.txt",
    "/api/feed",
    ...profile.programs.flatMap((p) => [
      `/programs/${p.id}`,
      `/programs/${p.id}/llms.txt`,
    ]),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (u) => `  <url>
    <loc>${origin}${u}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
