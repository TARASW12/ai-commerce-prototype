import type { BusinessProfile, SourceAdapter } from "./types";

/**
 * Shopify adapter.
 *
 * Included to show what changes when a second platform is connected: only
 * this file. The page, llms.txt, feed, MCP tools and checkout route all read
 * BusinessProfile and never learn that Shopify exists.
 *
 * Shopify is the easy case — products, variants, prices and inventory are
 * already fields, so there is no scraping and no curated mapping. The real
 * work is the opposite of Tilda's: mapping a rich catalogue down into the
 * same shape, and deciding which Shopify concepts (collections, metafields,
 * selling plans) carry the scheduling and eligibility facts an assistant
 * needs. Booking platforms (Mindbody, Fresha) add a live availability call,
 * which is why Recurrence is an interface rather than a literal list of dates.
 */
export const shopifyAdapter: SourceAdapter = {
  name: "shopify",
  platform: "shopify",

  canHandle(url: string) {
    return /myshopify\.com/.test(url);
  },

  async fetch(_url: string): Promise<BusinessProfile> {
    throw new Error(
      "Shopify adapter is a contract demonstration. Implementation would call " +
        "the Admin GraphQL API (products, variants, inventoryLevels, sellingPlanGroups) " +
        "and map the result onto BusinessProfile.",
    );
  },
};
