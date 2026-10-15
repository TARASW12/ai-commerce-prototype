export {};

/**
 * Walks the assignment's sales scenario through the MCP server and prints it
 * as a readable transcript.
 *
 * Every line under "agent calls" is a real JSON-RPC round trip to the deployed
 * server — nothing here is scripted or faked. The point is the last step: the
 * conversation ends with a URL that takes money, which is the part a retrieval
 * engine cannot do at all.
 *
 *   npm run demo                      # against production
 *   npm run demo http://localhost:3077
 */

const BASE = (process.argv[2] ?? "https://ai-commerce-prototype.vercel.app").replace(/\/$/, "");
const MCP = `${BASE}/api/mcp`;

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

let id = 0;

async function rpc(method: string, params?: Record<string, unknown>) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

async function tool(name: string, args: Record<string, unknown>) {
  const t0 = Date.now();
  const result = await rpc("tools/call", { name, arguments: args });
  const ms = Date.now() - t0;
  const text = result.content[0].text as string;
  console.log(
    dim(`  → ${name}(${JSON.stringify(args)})  ${ms}ms`),
  );
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function user(line: string) {
  console.log(`\n${bold("User:")}  ${cyan(`"${line}"`)}`);
}

function agent(lines: string[]) {
  console.log(`${bold("Agent:")} ${lines.join(`\n        `)}`);
}

async function main() {
  console.log(bold(`\nMCP server: ${MCP}\n`));

  const init = await rpc("initialize", {});
  const list = await rpc("tools/list");
  console.log(
    dim(`  protocol ${init.protocolVersion} · ${init.serverInfo.name} · tools: ${list.tools.map((t: any) => t.name).join(", ")}`),
  );

  console.log(dim("\n" + "─".repeat(72)));

  // ── 1 ──────────────────────────────────────────────────────────────────
  user("I want to improve my double axel and I'm looking for an online program under $350.");
  const search = await tool("search_programs", {
    query: "improve my double axel online",
    maxPrice: 350,
  });
  const p = search.programs[0];
  agent([
    `${green(p.name)} — ${green("$" + p.price.amount)} for ${p.duration.months} months.`,
    `${p.duration.totalSessions} live group classes, ${p.duration.sessionMinutes} min each,`,
    `${p.schedule.days.toLowerCase()} at ${p.schedule.startTimeUtc} UTC, with ${p.instructors.map((i: any) => i.name).join(" and ")}.`,
    `Level: ${p.level}. ${p.price.note}`,
    dim(`(${search.matches} programs matched; the other three are the rest of the ladder)`),
  ]);

  // ── 2 ──────────────────────────────────────────────────────────────────
  user("I'm free on November 6. Can I join around then?");
  const avail = await tool("check_availability", {
    programId: p.id,
    date: "2026-11-06",
  });
  agent([
    avail.explanation.replace(/ — /g, "\n        — "),
    dim(`landing page start date: ${avail.landingPageStartDate} · treated as a limit: ${avail.landingPageStartDateIsNotALimit ? "no" : "yes"}`),
  ]);

  // ── 3 ──────────────────────────────────────────────────────────────────
  user("I want to join.");
  const enrol = await tool("create_enrollment", {
    programId: p.id,
    startDate: "2026-11-06",
  });
  agent([
    `${enrol.status} — ${green(enrol.price)}, first session ${green(enrol.firstSession)}.`,
    `Checkout: ${yellow(enrol.checkoutUrl)}`,
    dim(`payment provider: ${enrol.paymentProvider}`),
  ]);

  // ── what the URL actually does ─────────────────────────────────────────
  console.log(dim("\n" + "─".repeat(72)));
  const res = await fetch(enrol.checkoutUrl, { redirect: "manual" });
  const location = res.headers.get("location") ?? "(none)";
  console.log(
    `\n${bold("Following the checkout URL:")} HTTP ${res.status}\n  → ${green(location)}\n`,
  );
  console.log(
    dim("  The redirect lands on the merchant's own Stripe checkout. The\n" +
        "  client_reference_id is what ties the sale back to an AI conversation\n" +
        "  when Stripe fires its webhook.\n"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
