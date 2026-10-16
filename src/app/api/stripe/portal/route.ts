import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { SITE_URL } from "@/lib/site";
import { getStripe } from "@/lib/stripe/client";

// Portal de cliente de Stripe: cambiar de plan, método de pago, facturas y
// cancelar. Solo para cuentas que ya tienen cliente en Stripe.
export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const stripe = await getStripe();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });
  if (!stripe || !user?.stripeCustomerId) {
    return NextResponse.json({ error: "No hay suscripción que gestionar." }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${SITE_URL}/app/perfil`,
  });
  return NextResponse.json({ url: portal.url });
}
