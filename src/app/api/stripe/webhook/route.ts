import { createDrizzleBillingWebhookStore, handleStripeWebhookEvent, verifyStripeSignature } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });
  }

  const payload = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  if (!verifyStripeSignature({ payload, signatureHeader, webhookSecret })) {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let event: unknown;

  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!isStripeWebhookEvent(event)) {
    return Response.json({ error: "Invalid Stripe event." }, { status: 400 });
  }

  const result = await handleStripeWebhookEvent(event, createDrizzleBillingWebhookStore());

  return Response.json({ received: true, ...result });
}

function isStripeWebhookEvent(value: unknown): value is Parameters<typeof handleStripeWebhookEvent>[0] {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string" &&
    Boolean((value as { data?: { object?: unknown } }).data?.object)
  );
}
