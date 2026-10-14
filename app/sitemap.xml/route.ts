import { profile } from "@/lib/profile";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = requestOrigin();
  const today = new Date().toISOString().slice(0, 10);
  const urls = ["/", "/llms.txt", "/api/feed"];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${origin}${u}</loc>
    <lastmod>${profile.source.fetchedAt.slice(0, 10)}</lastmod>
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
