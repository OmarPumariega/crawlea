// Créditos: la moneda que ve el CLIENTE. Por dentro el gasto sigue siendo el
// coste real de DataForSEO en USD (ApiUsageLog.costUsd); un crédito es una
// cantidad fija de ese coste. Así el cliente tiene una bolsa mensual sencilla
// (Gratis 100, Basic 600, Pro 2000) y no ve céntimos ni qué cuesta cada
// llamada. Sin dependencias de servidor: se importa también desde el cliente.
//
// 1 crédito = 0,002 $ → un chequeo de posición Top-10 (0,002 $) cuesta 1 crédito.
// Solo cuenta DataForSEO; la IA (OpenRouter) y el rastreo propio no gastan créditos.
export const USD_PER_CREDIT = 0.002;

export function usdToCredits(usd: number): number {
  if (!(usd > 0)) return 0;
  return Math.max(1, Math.ceil(usd / USD_PER_CREDIT - 1e-9));
}

export function creditsToUsd(credits: number): number {
  return Math.round(credits * USD_PER_CREDIT * 10000) / 10000;
}

// "1 crédito" / "1.250 créditos"
export function creditsLabel(credits: number): string {
  return `${credits.toLocaleString("es-ES")} ${credits === 1 ? "crédito" : "créditos"}`;
}

// Atajo para estimaciones de acción ("~25 créditos").
export function fmtCredits(usd: number): string {
  return `~${creditsLabel(usdToCredits(usd))}`;
}

// Fecha en la que se renueva la bolsa (día 1 del mes siguiente).
export function creditsRenewalLabel(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}
