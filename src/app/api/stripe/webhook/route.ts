import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSetting } from "@/lib/settings";
import { getStripe } from "@/lib/stripe/client";
import { syncSubscription } from "@/lib/stripe/sync";

// Webhook de Stripe. La firma se verifica sobre el cuerpo CRUDO (por eso
// req.text(), nunca req.json()); sin firma válida no se toca la BD.
export async function POST(req: NextRequest) {
  const stripe = await getStripe();
  const secret = await getSetting("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");
  if (!stripe || !secret || !signature) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Firma no válida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.mode === "subscription" && cs.subscription) {
          const id = typeof cs.subscription === "string" ? cs.subscription : cs.subscription.id;
          await syncSubscription(await stripe.subscriptions.retrieve(id));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, err);
    // 500 para que Stripe reintente el evento.
    return NextResponse.json({ error: "Error procesando el evento" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
