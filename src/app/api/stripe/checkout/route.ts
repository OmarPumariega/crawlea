import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { SITE_URL } from "@/lib/site";
import { getStripe, priceIdForPlan, PAID_PLAN_IDS, type PaidPlanId } from "@/lib/stripe/client";

// Crea una sesión de Stripe Checkout (modo suscripción) para el plan pedido.
// El plan lo fija el webhook al confirmarse el pago, nunca esta ruta.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = body?.plan as PaidPlanId;
  if (!PAID_PLAN_IDS.includes(plan)) {
    return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
  }

  const stripe = await getStripe();
  const priceId = await priceIdForPlan(plan);
  if (!stripe || !priceId) {
    return NextResponse.json({ error: "El pago todavía no está disponible." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, plan: true, planOverride: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "Ya tienes una suscripción. Cámbiala desde Gestionar suscripción." },
      { status: 409 }
    );
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    subscription_data: { metadata: { userId: user.id, plan } },
    allow_promotion_codes: true,
    success_url: `${SITE_URL}/app/perfil?pago=ok`,
    cancel_url: `${SITE_URL}/precios?pago=cancelado`,
  });

  return NextResponse.json({ url: checkout.url });
}
