import { prisma } from "@/lib/db/prisma";
import { usdToCredits } from "@/lib/credits";

// Construye un resumen en texto plano de los datos REALES del proyecto para
// inyectarlo como contexto del system prompt del Copilot. Conciso (datos, no
// párrafos) — el LLM se encarga de redactar la respuesta final.
export async function buildProjectContext(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, domain: true },
  });
  if (!project) return "El proyecto no existe.";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [latestAudit, rankKeywords, studyCount, monthCostAgg, gscSnapshot, ga4Snapshot] = await Promise.all([
    prisma.auditRun.findFirst({
      where: { projectId, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { overallScore: true, pagesCrawled: true, completedAt: true },
    }),
    prisma.rankKeyword.findMany({
      where: { projectId },
      select: {
        keyword: true,
        device: true,
        lastPosition: true,
        bestPosition: true,
      },
    }),
    prisma.keywordStudy.count({ where: { projectId } }),
    prisma.apiUsageLog.aggregate({
      where: { projectId, api: "dataforseo", createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    }),
    prisma.gscSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { month: true, rangeDays: true, totals: true, topQueries: true },
    }),
    prisma.ga4Snapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { month: true, rangeDays: true, totals: true, byChannel: true },
    }),
  ]);

  const monthCost = monthCostAgg._sum.costUsd ? Number(monthCostAgg._sum.costUsd) : 0;

  // Datos de los módulos de Competidores, Backlinks, SEO local y Visibilidad IA:
  // el último snapshot por dominio (distinct) — ya pagado, el Copilot solo lo lee.
  const [visSnapshots, blSnapshots, geoRun, aiOverviews, speed, lastAudits] = await Promise.all([
    prisma.visibilitySnapshot.findMany({
      where: { projectId },
      orderBy: { fetchedAt: "desc" },
      distinct: ["domain"],
      select: { domain: true, organicTraffic: true, organicKeywords: true, trafficValue: true, positionBuckets: true, movement: true, paid: true },
    }),
    prisma.backlinkSnapshot.findMany({
      where: { projectId },
      orderBy: { fetchedAt: "desc" },
      distinct: ["domain"],
      select: { domain: true, rank: true, backlinksTotal: true, referringDomains: true, brokenBacklinks: true, profile: true },
    }),
    prisma.geogridRun.findFirst({
      where: { projectId, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { keyword: true, gridSize: true, foundCount: true, averagePosition: true },
    }),
    prisma.aiOverviewCheck.findMany({
      where: { rankKeyword: { projectId } },
      orderBy: { checkedAt: "desc" },
      distinct: ["rankKeywordId"],
      select: { hasOverview: true, cited: true },
    }),
    prisma.pageSpeedCheck.findMany({
      where: { projectId, strategy: "mobile" },
      orderBy: { fetchedAt: "desc" },
      distinct: ["url"],
      take: 10,
      select: { url: true, performance: true, lcpMs: true },
    }),
    prisma.auditRun.findMany({
      where: { projectId, status: "completed" },
      orderBy: { completedAt: "desc" },
      take: 2,
      select: { overallScore: true },
    }),
  ]);

  const hasData =
    latestAudit !== null ||
    rankKeywords.length > 0 ||
    studyCount > 0 ||
    monthCost > 0 ||
    gscSnapshot !== null ||
    ga4Snapshot !== null ||
    visSnapshots.length > 0 ||
    blSnapshots.length > 0 ||
    geoRun !== null ||
    aiOverviews.length > 0 ||
    speed.length > 0;
  if (!hasData) return "El proyecto aún no tiene datos suficientes.";

  const lines: string[] = [];
  lines.push(`Proyecto: ${project.name}${project.domain ? ` (${project.domain})` : ""}`);

  if (latestAudit) {
    const fecha = latestAudit.completedAt
      ? new Date(latestAudit.completedAt).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
    lines.push(
      `Última auditoría: puntuación ${latestAudit.overallScore ?? "—"}/100, ` +
        `${latestAudit.pagesCrawled} páginas rastreadas (${fecha}).`
    );
  }

  if (rankKeywords.length > 0) {
    const top = [...rankKeywords]
      .sort((a, b) => {
        if (a.bestPosition == null && b.bestPosition == null) return 0;
        if (a.bestPosition == null) return 1;
        if (b.bestPosition == null) return -1;
        return a.bestPosition - b.bestPosition;
      })
      .slice(0, 10);
    lines.push(
      `Keywords en seguimiento: ${rankKeywords.length} totales. Top 10 por mejor posición:`
    );
    for (const k of top) {
      const dev = k.device === "mobile" ? " (móvil)" : "";
      lines.push(
        `  - ${k.keyword}${dev}: última ${k.lastPosition ?? "—"}, mejor ${k.bestPosition ?? "—"}`
      );
    }
  }

  lines.push(`Estudios de keywords: ${studyCount}.`);
  // El cliente ve créditos, nunca dólares: el Copilot habla en créditos.
  lines.push(`Créditos gastados este mes en este proyecto: ${usdToCredits(monthCost)}.`);

  // Rendimiento real de Search Console (del snapshot persistido al abrir el
  // panel de GSC). Datos reales de tráfico, no estimados.
  if (gscSnapshot) {
    const totals = gscSnapshot.totals as {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    const qs = (gscSnapshot.topQueries as Array<{ query: string; clicks: number; position: number }> | null) ?? [];
    lines.push(
      `Search Console (snapshot ${gscSnapshot.month}, últimos ${gscSnapshot.rangeDays} días): ` +
        `${Math.round(totals.clicks)} clics, ${Math.round(totals.impressions)} impresiones, ` +
        `CTR ${(totals.ctr * 100).toFixed(1)}%, posición media ${totals.position.toFixed(1)}.`
    );
    if (qs.length > 0) {
      const topQ = qs
        .slice(0, 10)
        .map((q) => `${q.query} (${Math.round(q.clicks)} clics, pos. ${q.position.toFixed(1)})`)
        .join("; ");
      lines.push(`Top queries reales que traen tráfico: ${topQ}.`);
    }
  }

  // Comportamiento on-site real de GA4 (del snapshot persistido al abrir el
  // panel) — antes ausente por completo del contexto del Copilot, que solo
  // veía el lado SERP (GSC). Permite cruzar "impresiones altas en GSC" con
  // "poco engagement en GA4", por ejemplo.
  if (ga4Snapshot) {
    const totals = ga4Snapshot.totals as {
      sessions: number;
      conversions: number;
      engagementRate: number;
      averageSessionDuration: number;
    };
    lines.push(
      `Google Analytics (snapshot ${ga4Snapshot.month}, últimos ${ga4Snapshot.rangeDays} días): ` +
        `${Math.round(totals.sessions)} sesiones, ${Math.round(totals.conversions)} conversiones, ` +
        `engagement rate ${(totals.engagementRate * 100).toFixed(1)}%, duración media ${Math.round(totals.averageSessionDuration)}s.`
    );
    const channels = (ga4Snapshot.byChannel as Array<{ channel: string; sessions: number }> | null) ?? [];
    if (channels.length > 0) {
      const topChannels = channels
        .slice(0, 5)
        .map((c) => `${c.channel} (${Math.round(c.sessions)} sesiones)`)
        .join("; ");
      lines.push(`Canales de tráfico principales: ${topChannels}.`);
    }
  }

  // Competidores: visibilidad estimada por dominio (propio y competidores).
  if (visSnapshots.length > 0) {
    lines.push("Visibilidad orgánica (Labs, último análisis por dominio):");
    for (const v of visSnapshots.slice(0, 8)) {
      const b = v.positionBuckets as { top3?: number; top10?: number; top100?: number } | null;
      const m = v.movement as { new?: number; up?: number; down?: number; lost?: number } | null;
      const paid = v.paid as { keywords?: number } | null;
      lines.push(
        `  - ${v.domain}: ~${Math.round(v.organicTraffic ?? 0)} visitas/mes, ${v.organicKeywords ?? "—"} keywords` +
          (b ? ` (top3 ${b.top3 ?? 0}, top10 ${b.top10 ?? 0}, top100 ${b.top100 ?? 0})` : "") +
          (v.trafficValue != null ? `, ese tráfico valdría ${Math.round(v.trafficValue)} € en anuncios` : "") +
          (m ? `, movimiento: +${m.new ?? 0} nuevas, ${m.up ?? 0} suben, ${m.down ?? 0} bajan, ${m.lost ?? 0} perdidas` : "") +
          (paid?.keywords ? `, ${paid.keywords} keywords de pago` : "")
      );
    }
  }

  // Backlinks: autoridad y calidad del perfil de enlaces por dominio.
  if (blSnapshots.length > 0) {
    lines.push("Backlinks (último análisis por dominio):");
    for (const b of blSnapshots.slice(0, 8)) {
      const p = b.profile as { spamScore?: number | null; referringIps?: number | null } | null;
      lines.push(
        `  - ${b.domain}: autoridad ${b.rank ?? "—"}/1000, ${b.backlinksTotal ?? "—"} backlinks de ${b.referringDomains ?? "—"} dominios` +
          (p?.spamScore != null ? `, spam score ${p.spamScore}/100` : "") +
          (p?.referringIps != null ? `, ${p.referringIps} IPs distintas` : "") +
          ((b.brokenBacklinks ?? 0) > 0 ? `, ${b.brokenBacklinks} enlaces rotos` : "")
      );
    }
  }

  if (geoRun) {
    lines.push(
      `Último geogrid (SEO local): «${geoRun.keyword}», rejilla ${geoRun.gridSize}×${geoRun.gridSize}, ` +
        `apareces en ${geoRun.foundCount ?? 0} de ${geoRun.gridSize * geoRun.gridSize} puntos, ` +
        `posición media ${geoRun.averagePosition != null ? geoRun.averagePosition.toFixed(1) : "—"}.`
    );
  }

  if (aiOverviews.length > 0) {
    const withOv = aiOverviews.filter((a) => a.hasOverview).length;
    const cited = aiOverviews.filter((a) => a.cited).length;
    lines.push(
      `AI Overview de Google (${aiOverviews.length} keywords medidas): lo muestra en ${withOv}, te cita en ${cited}.`
    );
  }

  if (speed.length > 0) {
    const worst = [...speed].sort((x, y) => (x.performance ?? 101) - (y.performance ?? 101))[0];
    lines.push(
      `Velocidad (PageSpeed móvil, ${speed.length} páginas medidas): la más lenta es ${worst.url} con ${worst.performance ?? "—"}/100` +
        (worst.lcpMs != null ? ` (LCP ${(worst.lcpMs / 1000).toFixed(1)} s).` : ".")
    );
  }
  if (lastAudits.length === 2 && lastAudits[0].overallScore != null && lastAudits[1].overallScore != null) {
    const d = lastAudits[0].overallScore - lastAudits[1].overallScore;
    lines.push(`Frente a la auditoría anterior, la puntuación ${d === 0 ? "no ha cambiado" : d > 0 ? `ha subido ${d} puntos` : `ha bajado ${-d} puntos`}.`);
  }

  return lines.join("\n");
}
