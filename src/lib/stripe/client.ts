import Stripe from "stripe";
import { getSetting } from "@/lib/settings";

// Cliente de Stripe. Las claves siguen la cascada de Configuración (BD cifrada
// → .env), igual que el resto de integraciones. Se crea por llamada: la clave
// puede cambiar desde la UI sin reiniciar el servidor.
export async function getStripe(): Promise<Stripe | null> {
  const key = await getSetting("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 });
}

export const PAID_PLAN_IDS = ["basic", "pro"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

const PRICE_KEYS = {
  basic: "STRIPE_PRICE_ID_BASIC",
  pro: "STRIPE_PRICE_ID_PRO",
} as const;

export async function priceIdForPlan(plan: PaidPlanId): Promise<string | null> {
  return getSetting(PRICE_KEYS[plan]);
}

export async function planFromPriceId(priceId: string | null | undefined): Promise<PaidPlanId | null> {
  if (!priceId) return null;
  for (const plan of PAID_PLAN_IDS) {
    if ((await priceIdForPlan(plan)) === priceId) return plan;
  }
  return null;
}

// ¿Está Stripe listo para cobrar? (clave + al menos un precio)
export async function stripeReady(): Promise<boolean> {
  if (!(await getSetting("STRIPE_SECRET_KEY"))) return false;
  return (await priceIdForPlan("basic")) !== null || (await priceIdForPlan("pro")) !== null;
}
