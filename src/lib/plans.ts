// Única fuente de verdad de los planes del SaaS. La usan el guard de gasto
// (assertWithinSpendLimit), el alta de proyectos (maxProyectos), la página de
// precios de la web pública y el panel de administración.
//
// Los módulos por plan y los importes son VALORES INICIALES ajustables: la
// mecánica (qué limita cada plan) es lo estable; las cifras se calibrarán con
// el coste real de DataForSEO por usuario. Stripe (Fase 3) sincroniza el plan
// del usuario por webhook; hasta entonces todos nacen en "free".

import { creditsToUsd } from "@/lib/credits";

export const MODULE_IDS = [
  "keywords",
  "titulos-meta",
  "schema",
  "rank",
  "google",
  "contenido",
  "auditoria",
  "geogrid",
  "backlinks",
  "competidores",
  "copilot",
  "informe",
  "notas",
  "tareas",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

// Módulos que el plan gratuito no incluye (los de mayor coste de API).
export const PAID_MODULES: readonly ModuleId[] = ["backlinks", "competidores", "geogrid"];

export interface PlanDef {
  id: string;
  nombre: string;
  descripcion: string;
  precioEurMes: number;
  // Bolsa mensual de créditos (lo que ve el cliente). El tope de gasto real de
  // DataForSEO de la cuenta (USD/mes, mes natural) se DERIVA de ella:
  // topeUsdMes = creditosMes × USD_PER_CREDIT. Se suma al tope global de la
  // plataforma y al tope por proyecto si lo hay. null = sin tope de cuenta.
  creditosMes: number;
  topeUsdMes: number | null;
  maxProyectos: number | null;
  // Módulos habilitados por el plan. El admin de la plataforma no está
  // limitado por su plan.
  modulos: readonly ModuleId[];
}

export const PLANS: Record<string, PlanDef> = {
  free: {
    id: "free",
    nombre: "Gratis",
    descripcion: "Para probar la herramienta con un proyecto real.",
    precioEurMes: 0,
    creditosMes: 100,
    topeUsdMes: creditsToUsd(100),
    maxProyectos: 1,
    // Los módulos de más coste de API (backlinks, competidores, geogrid) son
    // de pago. Se aplican con moduleGate() en las rutas y con candados en la UI.
    modulos: MODULE_IDS.filter((m) => !PAID_MODULES.includes(m)),
  },
  basic: {
    id: "basic",
    nombre: "Basic",
    descripcion: "Para autónomos y negocios con un par de webs.",
    precioEurMes: 9,
    creditosMes: 600,
    topeUsdMes: creditsToUsd(600),
    maxProyectos: 3,
    modulos: MODULE_IDS,
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcion: "Para freelancers y agencias con varios clientes.",
    precioEurMes: 25,
    creditosMes: 2000,
    topeUsdMes: creditsToUsd(2000),
    maxProyectos: 10,
    modulos: MODULE_IDS,
  },
};

export const DEFAULT_PLAN_ID = "free";

export function getPlan(planId: string | null | undefined): PlanDef {
  return PLANS[planId ?? DEFAULT_PLAN_ID] ?? PLANS[DEFAULT_PLAN_ID];
}

// Tope mensual efectivo de una cuenta: el override manual del admin (si existe)
// sustituye al del plan. null = sin tope de cuenta.
export function effectiveUserLimitUsd(
  planId: string | null | undefined,
  overrideUsd: number | null | undefined
): number | null {
  if (overrideUsd !== null && overrideUsd !== undefined && overrideUsd > 0) return overrideUsd;
  return getPlan(planId).topeUsdMes;
}

export function planAllowsModule(planId: string | null | undefined, moduleId: ModuleId): boolean {
  return getPlan(planId).modulos.includes(moduleId);
}
