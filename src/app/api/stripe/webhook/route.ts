import {
  createDrizzleBillingWebhookStore,
  parseStripeWebhookEvent,
  processStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "@/lib/stripe-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: "Stripe webhook secret is not configured." }, { status: 500 });
  }

  const payload = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  const verified = verifyStripeWebhookSignature({ payload, signatureHeader, webhookSecret });

  if (!verified) {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    const event = parseStripeWebhookEvent(payload);
    const result = await processStripeWebhookEvent(event, createDrizzleBillingWebhookStore());
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
