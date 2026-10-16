import { RateLimiterMemory } from "rate-limiter-flexible";

// Login por IP: 10 intentos cada 10 minutos.
export const loginIpLimiter = new RateLimiterMemory({
  points: 10,
  duration: 600,
  blockDuration: 900,
});

// Login por email: 5 intentos cada 15 minutos (frena fuerza bruta dirigida).
export const loginEmailLimiter = new RateLimiterMemory({
  points: 5,
  duration: 900,
  blockDuration: 900,
});

// Formulario público de contacto: 5 mensajes por hora y por IP.
export const contactIpLimiter = new RateLimiterMemory({
  points: 5,
  duration: 3600,
});

// Analizador público de la home: hace peticiones salientes, así que se limita
// bastante (6 análisis cada 10 minutos por IP).
export const analyzeIpLimiter = new RateLimiterMemory({ points: 6, duration: 600 });

/**
 * Devuelve la IP real del cliente leyendo X-Forwarded-For (cabecera que
 * inyecta Traefik en producción). Fallback "unknown" si no está presente.
 */
export function getClientIp(
  headers: Headers | Record<string, string | string[] | undefined>
): string {
  let raw: string | undefined;
  if (headers instanceof Headers) {
    raw = headers.get("x-forwarded-for") ?? undefined;
  } else {
    const v = (headers as Record<string, string | string[] | undefined>)["x-forwarded-for"];
    raw = Array.isArray(v) ? v[0] : v;
  }
  if (typeof raw === "string" && raw.length > 0) return raw.split(",")[0].trim();
  return "unknown";
}
