import { prisma } from "@/lib/db/prisma";
import { notify } from "@/lib/notifications/notify";
import { diffAudits } from "@/lib/audit/diff";
import { ISSUE_META } from "@/lib/audit/issue-meta";

// Avisos de cambios relevantes, sobre datos que YA se guardan (sin llamadas
// nuevas). Cada aviso usa notify(): dedupe por (usuario, tipo, clave) y no hace
// nada si el correo no está configurado. Todos son "best effort": un fallo al
// avisar nunca debe romper el trabajo que los dispara.

async function owner(projectId: string): Promise<{ userId: string; name: string } | null> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true, name: true } });
  return p ? { userId: p.userId, name: p.name } : null;
}

const day = () => new Date().toISOString().slice(0, 10);

// Auditoría que empeora respecto a la anterior: puntuación −5 o más, o varias
// incidencias nuevas. Se llama justo tras completar una auditoría.
export async function alertAuditRegression(runId: string, projectId: string): Promise<void> {
  try {
    const o = await owner(projectId);
    if (!o) return;
    const runs = await prisma.auditRun.findMany({
      where: { projectId, status: "completed" },
      orderBy: { completedAt: "desc" },
      take: 2,
      select: { id: true, overallScore: true },
    });
    if (runs.length < 2 || runs[0].id !== runId) return;
    const [cur, prev] = runs;
    const [curPages, prevPages] = await Promise.all([
      prisma.auditPage.findMany({ where: { auditRunId: cur.id }, select: { url: true, issues: true } }),
      prisma.auditPage.findMany({ where: { auditRunId: prev.id }, select: { url: true, issues: true } }),
    ]);
    const norm = (rows: { url: string; issues: unknown }[]) => rows.map((r) => ({ url: r.url, issues: Array.isArray(r.issues) ? (r.issues as string[]) : [] }));
    const diff = diffAudits(norm(prevPages), norm(curPages));
    const scoreDelta = cur.overallScore != null && prev.overallScore != null ? cur.overallScore - prev.overallScore : 0;
    if (scoreDelta > -5 && diff.totalAppeared < 10) return;
    const worst = diff.changes.filter((c) => c.appeared > 0).slice(0, 3).map((c) => `${ISSUE_META[c.issue]?.label ?? c.issue} (${c.appeared})`).join(", ");
    await notify({
      userId: o.userId,
      type: "audit_regression",
      key: runId,
      subject: `La auditoría de ${o.name} ha empeorado`,
      body: `La puntuación ha pasado de ${prev.overallScore ?? "—"} a ${cur.overallScore ?? "—"} y hay ${diff.totalAppeared} incidencias nuevas${worst ? `: ${worst}` : ""}. Revisa los cambios en /app/proyectos/${projectId}/auditoria/cambios`,
    });
  } catch (e) {
    console.error("[alerts] audit regression:", e);
  }
}

// Una keyword que estaba en el top 10 y sale (sin llegar a la caída de 10 que
// ya avisa rank_drop).
export async function alertLeftTop10(projectId: string, rankKeywordId: string, keyword: string, prev: number | null, now: number | null): Promise<void> {
  try {
    if (prev === null || prev > 10) return;
    if (now !== null && now <= 10) return;
    if (now !== null && now >= prev + 10) return; // ya lo cubre rank_drop
    const o = await owner(projectId);
    if (!o) return;
    await notify({
      userId: o.userId,
      type: "rank_left_top10",
      key: `${rankKeywordId}:${day()}`,
      subject: `«${keyword}» sale del top 10`,
      body: `La keyword «${keyword}» ha pasado de la posición #${prev} a ${now === null ? "fuera del rango medido" : `#${now}`} en ${o.name}. Detalle: /app/proyectos/${projectId}/rank`,
    });
  } catch (e) {
    console.error("[alerts] left top10:", e);
  }
}

// AI Overview: Google deja de citarte, o empieza a mostrar uno donde no lo había.
export async function alertAiOverviewChange(
  projectId: string,
  rankKeywordId: string,
  keyword: string,
  prev: { hasOverview: boolean; cited: boolean } | null,
  now: { hasOverview: boolean; cited: boolean }
): Promise<void> {
  try {
    if (!prev) return;
    const o = await owner(projectId);
    if (!o) return;
    if (prev.cited && !now.cited) {
      await notify({
        userId: o.userId,
        type: "ai_overview_lost",
        key: `${rankKeywordId}:${day()}`,
        subject: `Google ya no te cita en el AI Overview de «${keyword}»`,
        body: `En ${o.name}, el AI Overview de «${keyword}» ${now.hasOverview ? "ya no incluye tu web entre sus fuentes" : "ha desaparecido"}. Detalle: /app/proyectos/${projectId}/ia`,
      });
    } else if (!prev.hasOverview && now.hasOverview) {
      await notify({
        userId: o.userId,
        type: "ai_overview_new",
        key: `${rankKeywordId}:${day()}`,
        subject: `Google muestra ahora un AI Overview para «${keyword}»`,
        body: `En ${o.name}, «${keyword}» ahora tiene AI Overview ${now.cited ? "y te cita" : "y no te cita"}. Detalle: /app/proyectos/${projectId}/ia`,
      });
    }
  } catch (e) {
    console.error("[alerts] ai overview:", e);
  }
}

// Un competidor que crece de golpe (tráfico estimado +30 % y al menos +100 visitas).
export async function alertCompetitorGrowth(projectId: string, domain: string, prevTraffic: number | null, nowTraffic: number | null): Promise<void> {
  try {
    if (prevTraffic == null || nowTraffic == null || prevTraffic <= 0) return;
    if (nowTraffic < prevTraffic * 1.3 || nowTraffic - prevTraffic < 100) return;
    const o = await owner(projectId);
    if (!o) return;
    await notify({
      userId: o.userId,
      type: "competitor_growth",
      key: `${domain}:${day()}`,
      subject: `${domain} está creciendo`,
      body: `El tráfico orgánico estimado de ${domain} ha pasado de ~${Math.round(prevTraffic)} a ~${Math.round(nowTraffic)} visitas al mes (estimación de DataForSEO). Detalle: /app/proyectos/${projectId}/competidores`,
    });
  } catch (e) {
    console.error("[alerts] competitor growth:", e);
  }
}

// Pérdida de dominios que te enlazan entre dos análisis de backlinks.
export async function alertBacklinksLost(projectId: string, domain: string, prevDomains: number | null, nowDomains: number | null): Promise<void> {
  try {
    if (prevDomains == null || nowDomains == null) return;
    const lost = prevDomains - nowDomains;
    if (lost < 5 || lost < prevDomains * 0.1) return;
    const o = await owner(projectId);
    if (!o) return;
    await notify({
      userId: o.userId,
      type: "backlinks_lost",
      key: `${domain}:${day()}`,
      subject: `${domain} ha perdido ${lost} dominios que le enlazaban`,
      body: `Entre los dos últimos análisis, los dominios de referencia de ${domain} han pasado de ${prevDomains} a ${nowDomains}. Detalle: /app/proyectos/${projectId}/competidores/backlinks`,
    });
  } catch (e) {
    console.error("[alerts] backlinks lost:", e);
  }
}
