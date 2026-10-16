import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PLAN_ID } from "@/lib/plans";
import { planFromPriceId, PAID_PLAN_IDS, type PaidPlanId } from "@/lib/stripe/client";

// Estados de Stripe en los que el cliente conserva el plan de pago. past_due
// mantiene el acceso mientras Stripe reintenta el cobro; al agotar los
// reintentos la suscripción pasa a canceled/unpaid y baja a Gratis.
const ACTIVE_STATES = new Set(["active", "trialing", "past_due"]);

function periodEnd(sub: Stripe.Subscription): Date | null {
  // En las API recientes el fin de periodo vive en cada ítem; antes, en la
  // suscripción. Se admiten ambos.
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const ts = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

// Aplica el estado de una suscripción de Stripe a la cuenta. Respeta
// planOverride (plan asignado a mano por el admin): en ese caso solo se
// refrescan los datos de facturación, nunca el plan.
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id;
  const metaPlan = sub.metadata?.plan as PaidPlanId | undefined;
  const plan =
    (await planFromPriceId(priceId)) ??
    (metaPlan && PAID_PLAN_IDS.includes(metaPlan) ? metaPlan : null);

  const userId = sub.metadata?.userId;
  const user = await prisma.user.findFirst({
    where: userId ? { OR: [{ id: userId }, { stripeCustomerId: customerId }] } : { stripeCustomerId: customerId },
    select: { id: true, planOverride: true },
  });
  if (!user) return;

  const active = ACTIVE_STATES.has(sub.status) && plan !== null;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: active ? sub.id : null,
      planStatus: sub.status === "canceled" || sub.status === "unpaid" ? "canceled" : sub.status,
      currentPeriodEnd: active ? periodEnd(sub) : null,
      ...(user.planOverride ? {} : { plan: active ? plan! : DEFAULT_PLAN_ID }),
    },
  });
}

// Cancela la suscripción de Stripe de una cuenta que se va a borrar, para no
// seguir cobrando a alguien sin cuenta. Falla en silencio si Stripe no está
// configurado; si Stripe devuelve error, se propaga y el borrado no sigue.
export async function cancelStripeSubscriptionForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeSubscriptionId: true } });
  if (!user?.stripeSubscriptionId) return;
  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = await getStripe();
  if (!stripe) return;
  try {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
  } catch (err) {
    // Ya cancelada/inexistente en Stripe: no debe bloquear el borrado.
    if ((err as { code?: string }).code !== "resource_missing") throw err;
  }
}
