import { getProgram } from "@/lib/profile";
import { checkAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

/**
 * The action endpoint: the one URL an assistant can hand a user to move from
 * "I want to join" to a real payment.
 *
 * It stays a thin redirect on purpose. The business's existing Stripe link is
 * the system of record for money; this layer only records that the customer
 * arrived through an AI conversation and carries the intent along. Replacing
 * the redirect with a Stripe Checkout Session created server-side is a change
 * to this file alone.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const program = getProgram(url.searchParams.get("program") ?? undefined);
  if (!program) {
    return Response.json({ error: "unknown program" }, { status: 404 });
  }

  const requestedStart = url.searchParams.get("start") ?? undefined;
  const availability = checkAvailability(program, requestedStart);

  // Attribution: in production this is a row in an enrolments table, which is
  // what makes "how much business did AI generate?" answerable later.
  console.log(
    JSON.stringify({
      event: "enrollment_started",
      program: program.id,
      price: program.price.amount,
      requestedStart,
      firstSession: availability.nextSessions[0]?.date,
      referrer: req.headers.get("referer"),
      source: url.searchParams.get("src") ?? "direct",
      at: new Date().toISOString(),
    }),
  );

  const target = new URL(program.checkout.url);
  // Stripe payment links accept client_reference_id, which comes back on the
  // webhook — that is how the AI-attributed sale is tied to the payment.
  target.searchParams.set(
    "client_reference_id",
    `ai-${program.id}-${Date.now().toString(36)}`,
  );

  return Response.redirect(target.toString(), 302);
}
