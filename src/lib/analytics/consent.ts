// Consentimiento de cookies (cliente). Una sola cookie propia, `crawlea_consent`,
// guarda la decisión: "v1:a1" = analítica aceptada, "v1:a0" = rechazada. Si el
// texto de las políticas cambia de forma sustancial, se sube CONSENT_VERSION y
// se vuelve a preguntar. No usamos cookies de publicidad: ad_* siempre denegado.
export const CONSENT_VERSION = "v1";
export const CONSENT_COOKIE = "crawlea_consent";
export const CONSENT_EVENT = "crawlea:consent-change";
export const OPEN_CONSENT_EVENT = "crawlea:open-consent";

export type ConsentState = "unset" | "granted" | "denied";

export function readConsent(): ConsentState {
  if (typeof document === "undefined") return "unset";
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!m) return "unset";
  const [ver, flag] = decodeURIComponent(m[1]).split(":");
  if (ver !== CONSENT_VERSION) return "unset";
  return flag === "a1" ? "granted" : flag === "a0" ? "denied" : "unset";
}

export function writeConsent(analytics: boolean): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const value = encodeURIComponent(`${CONSENT_VERSION}:${analytics ? "a1" : "a0"}`);
  // 12 meses; Lax: solo se envía en navegación normal.
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

// Borra las cookies de Google Analytics del dominio (al retirar el consentimiento).
export function clearAnalyticsCookies(): void {
  const host = location.hostname;
  const bases = [host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    if (/^_ga($|_)|^_gid$|^_gat/.test(name)) {
      for (const d of bases) document.cookie = `${name}=; Path=/; Domain=${d}; Max-Age=0`;
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
  }
}
