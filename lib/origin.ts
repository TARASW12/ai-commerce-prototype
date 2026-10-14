/**
 * Absolute origin for canonical URLs.
 *
 * Deliberately derived from the environment rather than from request headers.
 * Reading headers would mark every page dynamic, and Next then serves them with
 * `cache-control: no-store` — the opposite of what a crawler wants from a
 * product page. With a static origin the pages render ahead of time and carry a
 * public, revalidating cache header.
 */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** @deprecated kept for call sites; same value. */
export const requestOrigin = siteOrigin;
