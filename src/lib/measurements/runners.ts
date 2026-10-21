import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { checkRankKeyword } from "@/lib/rank/check";
import { getPsiMetrics } from "@/lib/audit/psi";
import { getSetting } from "@/lib/settings";
import { analyzeCompetitorVisibility } from "@/lib/competitors/analyze";
import { COMPETITORS_ANALYZE_DEFAULT_LIMIT, backlinkAnalysisCostUsd } from "@/lib/dataforseo/pricing";
import { assertWithinSpendLimit } from "@/lib/dataforseo/spend";
import { fetchBacklinkSummary, fetchTopBacklinks } from "@/lib/backlinks/dataforseo";
import { alertBacklinksLost } from "@/lib/notifications/alerts";
import { normalizeDomain } from "@/lib/rank/serp";
import type { MeasurementModuleId } from "@/lib/measurements/modules";

// Cada runner repite UNA medición de un módulo para un proyecto y guarda el resultado donde lo guardaría el
// botón manual (el histórico del propio módulo). Devuelven un mensaje corto para la pestaña Mediciones.
// Un runner que no puede medir (falta un dato, plan sin el módulo...) lanza Error con el motivo: el job lo
// anota como error de esa medición, sin parar las demás.
export type RunResult = { message: string };

type ProjectRow = { id: string; domain: string | null; isLocalBusiness: boolean };

const MAX_RANK_KEYWORDS = 100;
const MAX_GEOGRID_REPEATS = 3;
const MAX_SPEED_URLS = 6;
const BACKLINKS_SCHEDULED_LIMIT = 50;

async function runRank(project: ProjectRow): Promise<RunResult> {
  const keywords = await prisma.rankKeyword.findMany({
    where: { projectId: project.id },
    orderBy: { lastCheckedAt: "asc" },
    take: MAX_RANK_KEYWORDS,
    select: { id: true, keyword: true },
  });
  if (keywords.length === 0) throw new Error("No hay keywords en Rank Tracking.");
  let done = 0;
  let fixed = 0;
  let firstError: string | null = null;
  for (const k of keywords) {
    try {
      const r = await checkRankKeyword(k.id);
      if (r.fromCache) fixed++;
      else done++;
    } catch (e) {
      firstError = firstError ?? (e instanceof Error ? e.message : "Error al comprobar");
      break; // tope de gasto o fallo de API: no seguir gastando
    }
  }
  if (firstError && done === 0 && fixed === 0) throw new Error(firstError);
  return {
    message: `${done} keywords comprobadas${fixed ? `, ${fixed} ya medidas hoy` : ""}${firstError ? `. Se paró: ${firstError}` : ""}`,
  };
}

async function runGeogrid(project: ProjectRow): Promise<RunResult> {
  if (!project.isLocalBusiness) throw new Error("El proyecto no es un negocio local.");
  const pending = await prisma.geogridRun.count({ where: { projectId: project.id, status: { in: ["pending", "running"] } } });
  if (pending > 0) throw new Error("Ya hay un mapa en curso.");
  const recent = await prisma.geogridRun.findMany({
    where: { projectId: project.id, status: "completed" },
    orderBy: { triggeredAt: "desc" },
    take: 30,
    select: { keyword: true, gridSize: true, radiusKm: true, centerLat: true, centerLng: true, zoom: true },
  });
  const seen = new Set<string>();
  const configs = recent.filter((r) => (seen.has(r.keyword) ? false : (seen.add(r.keyword), true))).slice(0, MAX_GEOGRID_REPEATS);
  if (configs.length === 0) throw new Error("Aún no hay ningún mapa de calor que repetir. Lanza uno desde SEO local.");
  await prisma.geogridRun.createMany({ data: configs.map((c) => ({ projectId: project.id, ...c })) });
  return { message: `${configs.length} mapa${configs.length === 1 ? "" : "s"} en cola: ${configs.map((c) => `«${c.keyword}»`).join(", ")}` };
}

async function runAudit(project: ProjectRow): Promise<RunResult> {
  if (!project.domain) throw new Error("El proyecto no tiene dominio.");
  const active = await prisma.auditRun.count({ where: { projectId: project.id, status: { in: ["pending", "running"] } } });
  if (active > 0) throw new Error("Ya hay una auditoría en curso.");
  await prisma.$transaction([
    prisma.auditRun.create({
      data: { projectId: project.id, startUrl: `https://${project.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}` },
    }),
    prisma.project.update({ where: { id: project.id }, data: { auditLastRunAt: new Date() } }),
  ]);
  return { message: "Auditoría en cola: empieza en el próximo minuto." };
}

async function runVelocidad(project: ProjectRow): Promise<RunResult> {
  if (!project.domain) throw new Error("El proyecto no tiene dominio.");
  if (!(await getSetting("PAGESPEED_API_KEY"))) throw new Error("La clave de PageSpeed no está configurada.");
  const rows = await prisma.pageSpeedCheck.findMany({
    where: { projectId: project.id },
    orderBy: { fetchedAt: "desc" },
    take: 200,
    select: { url: true, strategy: true },
  });
  const seen = new Set<string>();
  let targets = rows.filter((r) => (seen.has(`${r.url}|${r.strategy}`) ? false : (seen.add(`${r.url}|${r.strategy}`), true)));
  if (targets.length === 0) targets = [{ url: `https://${normalizeDomain(project.domain)}/`, strategy: "mobile" }];
  targets = targets.slice(0, MAX_SPEED_URLS);
  const pct = (v: number | null) => (v === null ? null : Math.round(v * 100));
  let ok = 0;
  for (const t of targets) {
    const psi = await getPsiMetrics(t.url, t.strategy === "desktop" ? "desktop" : "mobile");
    if (!psi) continue;
    await prisma.pageSpeedCheck.create({
      data: {
        projectId: project.id,
        url: t.url,
        strategy: t.strategy,
        performance: pct(psi.scores.performance),
        accessibility: pct(psi.scores.accessibility),
        bestPractices: pct(psi.scores.bestPractices),
        seo: pct(psi.scores.seo),
        lcpMs: psi.lcpMs,
        cls: psi.cls,
        inpMs: psi.inpMs,
        fieldData: (psi.fieldData ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
        opportunities: psi.opportunities as unknown as Prisma.InputJsonValue,
      },
    });
    ok++;
  }
  if (ok === 0) throw new Error("Google no pudo medir ninguna página ahora mismo.");
  return { message: `${ok} de ${targets.length} páginas medidas` };
}

async function runCompetidores(project: ProjectRow): Promise<RunResult> {
  if (!project.domain) throw new Error("El proyecto no tiene dominio.");
  const competitors = await prisma.competitor.findMany({ where: { projectId: project.id }, select: { domain: true } });
  const domains = [normalizeDomain(project.domain), ...competitors.map((c) => normalizeDomain(c.domain))];
  let done = 0;
  let cached = 0;
  let firstError: string | null = null;
  for (const domain of domains) {
    try {
      const r = await analyzeCompetitorVisibility(project.id, domain, {
        locationCode: 2724,
        languageCode: "es",
        limit: COMPETITORS_ANALYZE_DEFAULT_LIMIT,
      });
      if (r.fromCache) cached++;
      else done++;
    } catch (e) {
      firstError = e instanceof Error ? e.message : "Error al analizar";
      break;
    }
  }
  if (firstError && done === 0 && cached === 0) throw new Error(firstError);
  return { message: `${done} dominios analizados${cached ? `, ${cached} con datos de hace menos de 7 días` : ""}${firstError ? `. Se paró: ${firstError}` : ""}` };
}

async function runBacklinks(project: ProjectRow): Promise<RunResult> {
  if (!project.domain) throw new Error("El proyecto no tiene dominio.");
  const domain = normalizeDomain(project.domain);
  await assertWithinSpendLimit(project.id, backlinkAnalysisCostUsd(BACKLINKS_SCHEDULED_LIMIT));
  const summary = await fetchBacklinkSummary(domain);
  const top = await fetchTopBacklinks(domain, BACKLINKS_SCHEDULED_LIMIT);
  const previous = await prisma.backlinkSnapshot.findFirst({
    where: { projectId: project.id, domain },
    orderBy: { fetchedAt: "desc" },
    select: { referringDomains: true },
  });
  await prisma.backlinkSnapshot.create({
    data: {
      projectId: project.id,
      domain,
      rank: summary.data.rank,
      backlinksTotal: summary.data.backlinksTotal,
      referringDomains: summary.data.referringDomains,
      referringMainDomains: summary.data.referringMainDomains,
      dofollowBacklinks: summary.data.dofollowBacklinks,
      nofollowBacklinks: summary.data.nofollowBacklinks,
      brokenBacklinks: summary.data.brokenBacklinks,
      profile: summary.data.profile as unknown as Prisma.InputJsonValue,
      topBacklinks: top.items as unknown as Prisma.InputJsonValue,
    },
  });
  await alertBacklinksLost(project.id, domain, previous?.referringDomains ?? null, summary.data.referringDomains);
  for (const [endpoint, costUsd] of [["backlinks.summary", summary.costUsd], ["backlinks.top", top.costUsd]] as const) {
    if (costUsd !== null) {
      await prisma.apiUsageLog.create({ data: { projectId: project.id, api: "dataforseo", endpoint, model: null, costUsd } });
    }
  }
  return { message: `${summary.data.backlinksTotal ?? "—"} backlinks de ${summary.data.referringDomains ?? "—"} dominios` };
}

export const RUNNERS: Record<MeasurementModuleId, (project: ProjectRow) => Promise<RunResult>> = {
  rank: runRank,
  geogrid: runGeogrid,
  audit: runAudit,
  velocidad: runVelocidad,
  competidores: runCompetidores,
  backlinks: runBacklinks,
};
