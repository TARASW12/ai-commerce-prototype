/**
 * Runs an adapter against a live source and writes the normalized profile.
 *
 * In production this is a scheduled job per connected business; here one
 * command keeps data/business.json honest about what the page actually says.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tildaAdapter } from "../adapters/tilda";
import { shopifyAdapter } from "../adapters/shopify";
import type { SourceAdapter } from "../adapters/types";

const ADAPTERS: SourceAdapter[] = [tildaAdapter, shopifyAdapter];

async function main() {
  const url = process.argv[2] ?? "https://victoryskating.com/doubleaxel";
  let picked: SourceAdapter | undefined;
  for (const a of ADAPTERS) {
    if (await a.canHandle(url)) { picked = a; break; }
  }
  if (!picked) throw new Error(`No adapter can handle ${url}`);

  console.log(`adapter: ${picked.name} (${picked.platform})`);
  const profile = await picked.fetch(url);
  const out = join(process.cwd(), "data", "business.json");
  writeFileSync(out, JSON.stringify(profile, null, 2) + "\n");

  const p = profile.programs[0];
  console.log(`✓ ${profile.brand.name} — ${profile.programs.length} program(s)`);
  console.log(`  ${p.name}`);
  console.log(`  $${p.price.amount} (list $${p.price.listAmount}) · ${p.duration.totalSessions} classes · ${p.duration.sessionMinutes} min`);
  console.log(`  ${p.schedule.recurrence.byDay.join(",")} at ${String(Math.floor(p.schedule.recurrence.startMinutesUtc/60)).padStart(2,"0")}:${String(p.schedule.recurrence.startMinutesUtc%60).padStart(2,"0")} UTC`);
  console.log(`  first cohort: ${p.schedule.recurrence.firstCohortDate} · rolling: ${p.schedule.recurrence.rollingEnrolment}`);
  console.log(`  checkout: ${p.checkout.url}`);
  console.log(`→ ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
