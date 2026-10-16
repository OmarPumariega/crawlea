// API única de medición. Todo evento de la app pasa por track(): empuja a la
// capa de datos (dataLayer) de Google Tag Manager SOLO si el usuario ha
// aceptado la analítica. Reglas de oro:
//  - Nunca enviar emails, nombres, dominios de clientes, palabras clave ni
//    textos que escriba el usuario. Solo identificadores de acción/módulo.
//  - Los nombres de evento van en snake_case, y los parámetros son escalares.
import { readConsent } from "@/lib/analytics/consent";

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function analyticsAllowed(): boolean {
  return typeof window !== "undefined" && readConsent() === "granted";
}

export function track(event: string, params: Params = {}): void {
  if (!analyticsAllowed()) return;
  const clean: Record<string, unknown> = { event };
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v;
  (window.dataLayer = window.dataLayer || []).push(clean);
}

// Sustituye identificadores (cuid/uuid) por :id para no exponer ids de
// proyecto en las rutas que se miden.
export function normalizePath(pathname: string): string {
  return pathname
    .split("/")
    .map((s) => (/^[a-z0-9]{24,26}$/.test(s) || /^[0-9a-f-]{32,36}$/.test(s) ? ":id" : s))
    .join("/");
}

export function describePath(pathname: string): { page_type: string; module?: string; submodule?: string } {
  const p = normalizePath(pathname);
  if (p.startsWith("/app/proyectos/:id")) {
    const [, , , , mod, sub] = p.split("/");
    return { page_type: "app", module: mod || "perfil", submodule: sub };
  }
  if (p.startsWith("/app")) return { page_type: "app", module: p.split("/")[2] || "panel" };
  if (p.startsWith("/admin")) return { page_type: "admin", module: p.split("/")[2] || "resumen" };
  if (p.startsWith("/legal")) return { page_type: "legal", module: p.split("/")[2] };
  if (["/acceso", "/registro"].includes(p)) return { page_type: "auth", module: p.slice(1) };
  return { page_type: "marketing", module: p === "/" ? "home" : p.split("/")[1] };
}
