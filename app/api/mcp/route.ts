import { profile, getProgram, searchPrograms, enrolUrl } from "@/lib/profile";
import { checkAvailability } from "@/lib/availability";
import { siteOrigin } from "@/lib/origin";
import type { Program } from "@/adapters/types";

export const dynamic = "force-dynamic";

/**
 * Model Context Protocol server, Streamable HTTP transport.
 *
 * Written against the protocol directly rather than through an SDK: it is a
 * small, stable JSON-RPC surface, and spelling it out keeps the dependency
 * count at zero and makes the contract auditable.
 *
 * This is the *action* half of the system. A retrieval engine such as
 * Perplexity cannot reach it — those engines read pages, they do not call
 * tools — which is exactly why the discovery half (JSON-LD, llms.txt, feed)
 * exists alongside it. An agent host that does speak MCP (Claude Desktop,
 * Cursor, an agent framework) connects here and can carry a conversation all
 * the way from "I want to improve my double axel" to a checkout URL.
 */

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: "search_programs",
    description:
      "Find training programs offered by Victory Skating Academy (also known as VSA or VSA World) that match a natural-language request. Use this first when a user describes what they want to learn, optionally with a budget.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "What the user is looking for, in their own words. Example: 'online double axel training'.",
        },
        maxPrice: {
          type: "number",
          description: "Optional budget ceiling in USD for the whole program.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_program",
    description:
      "Return every detail of one program: price, duration, number of classes, schedule, coach, required skater level, what is included, and how to enrol.",
    inputSchema: {
      type: "object",
      properties: {
        programId: {
          type: "string",
          description:
            "Program id or part of its name. Omit to get the default program.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "check_availability",
    description:
      "Check whether a skater can join around a given date, and return the next sessions. This program runs continuously every weekend, so enrolment is open regardless of the start date printed on the original landing page — always call this instead of inferring availability from page text.",
    inputSchema: {
      type: "object",
      properties: {
        programId: { type: "string", description: "Program id. Optional." },
        date: {
          type: "string",
          description:
            "The date the user mentioned, as YYYY-MM-DD. Optional — omit for the next available sessions.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_enrollment",
    description:
      "Start enrolment for a program and return a checkout URL the user can open to pay. Call this once the user has said they want to join.",
    inputSchema: {
      type: "object",
      properties: {
        programId: { type: "string", description: "Program id. Optional." },
        startDate: {
          type: "string",
          description:
            "Preferred first session date as YYYY-MM-DD. Optional.",
        },
      },
      additionalProperties: false,
    },
  },
] as const;

/** Compact, quotable view of a program — what an assistant reads out loud. */
function describe(p: Program, origin: string) {
  const a = checkAvailability(p);
  return {
    id: p.id,
    name: p.name,
    brand: {
      name: profile.brand.name,
      alsoKnownAs: profile.brand.aliases,
    },
    summary: p.summary,
    price: {
      amount: p.price.amount,
      currency: p.price.currency,
      listPrice: p.price.listAmount,
      perClass: p.unitPrice?.amount,
      note: `$${p.price.amount} covers the whole ${p.duration.months}-month program.`,
    },
    duration: p.duration,
    schedule: {
      days: "Every Saturday and Sunday",
      startTimeUtc: `${String(Math.floor(p.schedule.recurrence.startMinutesUtc / 60)).padStart(2, "0")}:${String(p.schedule.recurrence.startMinutesUtc % 60).padStart(2, "0")}`,
      localTimes: p.schedule.localTimes.map((t) => t.label),
    },
    instructors: p.instructors,
    level: p.level,
    audience: p.audience,
    prerequisites: p.prerequisites,
    includes: p.includes,
    deliveryMode: p.deliveryMode,
    availability: a,
    enrollUrl: enrolUrl(p, origin),
    sourceUrl: p.sourceUrl,
  };
}

function text(value: unknown) {
  return {
    content: [
      {
        type: "text",
        text:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function callTool(name: string, args: Record<string, any>, origin: string) {
  switch (name) {
    case "search_programs": {
      const matches = searchPrograms(String(args.query ?? ""), args.maxPrice);
      if (!matches.length) {
        return text(
          `No program at ${profile.brand.name} matches "${args.query}"${args.maxPrice ? ` under $${args.maxPrice}` : ""}.`,
        );
      }
      return text({
        matches: matches.length,
        programs: matches.map((p) => describe(p, origin)),
      });
    }

    case "get_program": {
      const p = getProgram(args.programId);
      if (!p) return text(`No program found for "${args.programId}".`);
      return text(describe(p, origin));
    }

    case "check_availability": {
      const p = getProgram(args.programId);
      if (!p) return text(`No program found for "${args.programId}".`);
      const a = checkAvailability(p, args.date);
      return text({
        program: p.name,
        ...a,
        // Stated explicitly so an assistant does not re-derive availability
        // from the landing page and contradict the answer above.
        landingPageStartDate: p.schedule.recurrence.firstCohortDate,
        landingPageStartDateIsNotALimit: true,
        enrollUrl: enrolUrl(p, origin, a.nextSessions[0]?.date),
      });
    }

    case "create_enrollment": {
      const p = getProgram(args.programId);
      if (!p) return text(`No program found for "${args.programId}".`);
      const a = checkAvailability(p, args.startDate);
      const url = enrolUrl(p, origin, a.nextSessions[0]?.date);
      return text({
        status: "ready_for_checkout",
        program: p.name,
        price: `$${p.price.amount} ${p.price.currency}`,
        firstSession: a.nextSessions[0]
          ? `${a.nextSessions[0].weekday} ${a.nextSessions[0].date}`
          : null,
        checkoutUrl: url,
        paymentProvider: p.checkout.provider,
        instruction: `Give the user this link to complete enrolment: ${url}`,
      });
    }

    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

function handle(req: JsonRpcRequest, origin: string) {
  switch (req.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "ai-commerce-layer",
          version: "0.1.0",
          description: `Product, availability and checkout tools for ${profile.brand.name}.`,
        },
      };

    case "ping":
      return {};

    case "tools/list":
      return { tools: TOOLS };

    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments ?? {}) as Record<string, any>;
      try {
        return callTool(name, args, origin);
      } catch (e) {
        // Tool failures are results, not transport errors — the model should
        // see the message and be able to recover.
        return {
          isError: true,
          content: [{ type: "text", text: (e as Error).message }],
        };
      }
    }

    default:
      throw Object.assign(new Error(`Unknown method: ${req.method}`), {
        code: -32601,
      });
  }
}

export async function POST(request: Request) {
  const origin = siteOrigin();
  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  const batch = Array.isArray(body) ? body : [body];
  const responses = [];

  for (const req of batch) {
    // Notifications carry no id and get no reply, per JSON-RPC.
    if (req.id === undefined || req.id === null) continue;
    try {
      responses.push({ jsonrpc: "2.0", id: req.id, result: handle(req, origin) });
    } catch (e) {
      const err = e as Error & { code?: number };
      responses.push({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: err.code ?? -32603, message: err.message },
      });
    }
  }

  if (!responses.length) return new Response(null, { status: 202 });

  return Response.json(Array.isArray(body) ? responses : responses[0], {
    headers: { "mcp-protocol-version": PROTOCOL_VERSION },
  });
}

/** Discovery for clients that probe before connecting. */
export async function GET() {
  return Response.json({
    protocol: "mcp",
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    note:
      "POST JSON-RPC 2.0 to this endpoint. Retrieval engines that cannot speak MCP should read / , /llms.txt or /api/feed instead.",
  });
}
