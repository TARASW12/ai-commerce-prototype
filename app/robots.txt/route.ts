import { siteOrigin } from "@/lib/origin";

export const revalidate = 3600;

/**
 * The discovery layer is useless if crawlers are not told it exists.
 *
 * AI crawlers are named explicitly rather than relying on the wildcard: several
 * of them look for their own user-agent before deciding what they may fetch,
 * and an operator reading this file should be able to see at a glance which
 * assistants this business has opted into.
 */
export async function GET() {
  const origin = siteOrigin();
  const body = `# Structured product data for AI assistants.
# Facts live in schema.org JSON-LD on / , in /llms.txt and in /api/feed.

User-agent: *
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
