import { prisma } from "@/lib/db/prisma";
import { getSetting } from "@/lib/settings";
import { effectiveUserLimitUsd } from "@/lib/plans";
import { usdToCredits, creditsLabel } from "@/lib/credits";

// Tope de gasto mensual de DataForSEO (sección 5 del spec: "topes de gasto
// configurables, con opción de bloquear nuevas llamadas al superarlo").
// Dos niveles, de fuera hacia dentro:
//   1. Global de plataforma: DATAFORSEO_MONTHLY_LIMIT_USD (AppSetting/env).
//   2. Por cuenta (SaaS): topeUsdMes del plan del dueño del proyecto (o el
//      override manual del admin, que lo sustituye). El
//      admin de la plataforma no está limitado por plan.
// (Ya no hay tope por proyecto: la bolsa de créditos es de la cuenta.)
// El cómputo suma el coste real registrado en ApiUsageLog (api='dataforseo')
// del mes natural en curso.

export class DataForSeoSpendLimitError extends Error {
  readonly spentUsd: number;
  readonly limitUsd: number;
  readonly scope: string;
  constructor(spentUsd: number, limitUsd: number, scope: string = "global", estimatedUsd = 0) {
    super(
      scope === "user" && estimatedUsd > 0 && spentUsd < limitUsd
        ? `Esta acción gasta ${creditsLabel(usdToCredits(estimatedUsd))} y te quedan ${creditsLabel(usdToCredits(limitUsd - spentUsd))} este mes. Se renuevan el día 1 del mes que viene; si los necesitas antes, sube de plan.`
        : scope === "global"
        ? `Tope mensual de DataForSEO alcanzado: ${spentUsd.toFixed(2)}$ de ${limitUsd.toFixed(2)}$ configurados. Sube DATAFORSEO_MONTHLY_LIMIT_USD o espera al próximo mes para nuevas llamadas.`
        : scope === "user"
          ? `Has gastado tus créditos de este mes (${creditsLabel(usdToCredits(spentUsd))} de ${creditsLabel(usdToCredits(limitUsd))}). Se renuevan el día 1 del mes que viene; si los necesitas antes, sube de plan.`
          : `Tope de gasto del proyecto alcanzado: ${spentUsd.toFixed(2)}$ de ${limitUsd.toFixed(2)}$ este mes. Sube el tope del proyecto en su ficha o espera al próximo mes.`
    );
    this.name = "DataForSeoSpendLimitError";
    this.spentUsd = spentUsd;
    this.limitUsd = limitUsd;
    this.scope = scope;
  }
}

export async function getMonthlyLimitUsd(): Promise<number | null> {
  const raw = await getSetting("DATAFORSEO_MONTHLY_LIMIT_USD");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Coste real acumulado en el mes natural en curso (día 1 hasta ahora), de
// toda la instalación.
export async function getMonthSpendUsd(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const agg = await prisma.apiUsageLog.aggregate({
    where: { api: "dataforseo", createdAt: { gte: startOfMonth } },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ? Number(agg._sum.costUsd) : 0;
}

// Coste del mes de un proyecto concreto (para su tope de proyecto).
export async function getProjectMonthSpendUsd(projectId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const agg = await prisma.apiUsageLog.aggregate({
    where: { api: "dataforseo", projectId, createdAt: { gte: startOfMonth } },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ? Number(agg._sum.costUsd) : 0;
}

// Coste del mes de una cuenta: la suma de todos sus proyectos (para el tope
// del plan). Los registros sin proyecto (ApiUsageLog.projectId nullable) no
// cuentan para ninguna cuenta.
export async function getUserMonthSpendUsd(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const agg = await prisma.apiUsageLog.aggregate({
    where: {
      api: "dataforseo",
      project: { userId },
      createdAt: { gte: startOfMonth },
    },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ? Number(agg._sum.costUsd) : 0;
}

// Tope mensual efectivo de una cuenta (override manual → plan). Para mostrarlo
// en la UI; assertWithinSpendLimit calcula lo mismo por su cuenta.
export async function getUserLimitUsd(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, spendLimitOverrideUsd: true },
  });
  return user ? effectiveUserLimitUsd(user.plan, user.spendLimitOverrideUsd) : null;
}

// Comprueba los DOS topes (global → bolsa de créditos de la cuenta). Llamar ANTES de cualquier llamada nueva a DataForSEO. Si no
// hay topes configurados, no hace nada. Las lecturas de caché no gastan → no
// pasan por aquí.
//
// `estimatedUsd` (opcional): coste previsto de la acción. Con él, el tope de la
// cuenta y el del proyecto también bloquean si gastado + estimado lo
// superaría, para que nadie se pase de la bolsa de créditos por una sola
// acción grande. Sin él, solo bloquea si el tope ya estaba alcanzado.
export async function assertWithinSpendLimit(projectId?: string, estimatedUsd = 0): Promise<void> {
  // Tope global de la plataforma.
  const limit = await getMonthlyLimitUsd();
  if (limit !== null) {
    const spent = await getMonthSpendUsd();
    if (spent >= limit) throw new DataForSeoSpendLimitError(spent, limit, "global");
  }

  if (!projectId) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      user: { select: { role: true, plan: true, spendLimitOverrideUsd: true } },
    },
  });
  if (!project) return;

  // Tope del plan del dueño (el admin de la plataforma no está limitado).
  if (project.user.role !== "admin") {
    const userLimit = effectiveUserLimitUsd(project.user.plan, project.user.spendLimitOverrideUsd);
    if (userLimit !== null) {
      const userSpent = await getUserMonthSpendUsd(project.userId);
      if (userSpent >= userLimit || userSpent + estimatedUsd > userLimit) {
        throw new DataForSeoSpendLimitError(userSpent, userLimit, "user", estimatedUsd);
      }
    }
  }
}
