// Única fuente de verdad de los planes del SaaS. La usan el guard de gasto
// (assertWithinSpendLimit), el alta de proyectos (maxProyectos), la página de
// precios de la web pública y el panel de administración.
//
// Los módulos por plan y los importes son VALORES INICIALES ajustables: la
// mecánica (qué limita cada plan) es lo estable; las cifras se calibrarán con
// el coste real de DataForSEO por usuario. Stripe (Fase 3) sincroniza el plan
// del usuario por webhook; hasta entonces todos nacen en "free".

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

export interface PlanDef {
  id: string;
  nombre: string;
  descripcion: string;
  precioEurMes: number;
  // Tope de gasto de DataForSEO de la CUENTA (USD/mes, mes natural). Se suma
  // al tope global de la plataforma y al tope por proyecto si lo hay. null =
  // sin tope a nivel de cuenta (el global sigue aplicando).
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
    topeUsdMes: 3,
    maxProyectos: 1,
    // De entrada el plan free no excluye módulos: no hay vía de pago todavía
    // y los primeros usuarios son beta testers. Cuando Stripe esté listo
    // (Fase 3), este listado se recorta y se añade el enforcement en las
    // rutas de módulo (assertModuleAllowed).
    modulos: MODULE_IDS,
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcion: "Para freelancers y negocios con varios proyectos.",
    precioEurMes: 29,
    topeUsdMes: 25,
    maxProyectos: 5,
    modulos: MODULE_IDS,
  },
  business: {
    id: "business",
    nombre: "Business",
    descripcion: "Para agencias con muchos clientes y mucho volumen.",
    precioEurMes: 79,
    topeUsdMes: 75,
    maxProyectos: 20,
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
