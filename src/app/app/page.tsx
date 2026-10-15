import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth-guards";
import { getMonthSpendUsd, getMonthlyLimitUsd, getUserMonthSpendUsd } from "@/lib/dataforseo/spend";
import { getPlan } from "@/lib/plans";
import PageHeader from "@/components/app/PageHeader";
import StatHero from "@/components/app/StatHero";
import {
  FolderKanban,
  Wallet,
  Target,
  ListChecks,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Gauge,
} from "lucide-react";

const ENDPOINT_LABELS: Record<string, string> = {
  "modulo1.keywords.volumen": "M1 · Volumen de keywords",
  "modulo1.keywords.intencion": "M1 · Intención de keywords",
  "modulo1.estructura": "M1 · Estructura de URLs (IA)",
  "modulo3.titulos-meta": "M3 · Títulos y meta (IA)",
  "modulo4.schema.article": "M4 · Schema Article (IA)",
  "modulo4.schema.faq": "M4 · Schema FAQ (IA)",
  "modulo7.contenido": "M7 · Contenido (IA)",
  "modulo5.rankcheck": "M5 · Rank tracking",
  "modulo9.geogrid": "M9 · Geogrid",
};

function scoreTone(score: number | null | undefined): string {
  if (score == null) return "text-gray-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

export default async function DashboardPage() {
  // Aislamiento multi-tenant: el panel general de un usuario solo agrega SUS
  // proyectos; el admin de la plataforma ve la instalación entera.
  const session = await requireSession();
  if (!session) redirect("/acceso");
  const admin = session.user.role === "admin";
  const own = admin ? undefined : { project: { userId: session.user.id } };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    projects,
    totalKeywordCount,
    studyCount,
    monthTotalAgg,
    dfsSpent,
    dfsLimit,
    failedAudits,
    latestCompletedAudits,
    latestGeogrids,
    monthCostRows,
    endpointRows,
    rankKeywords,
  ] = await Promise.all([
    prisma.project.findMany({
      where: admin ? undefined : { userId: session.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, domain: true, isLocalBusiness: true },
    }),
    prisma.rankKeyword.count({ where: own }),
    prisma.keywordStudy.count({ where: own }),
    prisma.apiUsageLog.aggregate({
      where: { ...own, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    }),
    admin ? getMonthSpendUsd() : getUserMonthSpendUsd(session.user.id),
    admin ? getMonthlyLimitUsd() : Promise.resolve(getPlan(session.user.plan).topeUsdMes),
    // Auditorías fallidas recientes (últimos 30 días).
    prisma.auditRun.findMany({
      where: { ...own, status: "failed", triggeredAt: { gte: recentWindow } },
      orderBy: { triggeredAt: "desc" },
      select: { id: true, projectId: true, errorMessage: true },
      take: 10,
    }),
    // Todas las auditorías completadas con nota, ordenadas para deducir la
    // más reciente por proyecto (take generoso, acotado para no crecer infinito).
    prisma.auditRun.findMany({
      where: { ...own, status: "completed", overallScore: { not: null } },
      orderBy: { triggeredAt: "desc" },
      select: { id: true, projectId: true, overallScore: true },
      take: 500,
    }),
    prisma.geogridRun.findMany({
      where: { ...own, status: "completed" },
      orderBy: { triggeredAt: "desc" },
      select: { id: true, projectId: true, foundCount: true, gridSize: true, averagePosition: true },
      take: 500,
    }),
    prisma.apiUsageLog.groupBy({
      by: ["projectId"],
      where: { ...own, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    }),
    prisma.apiUsageLog.groupBy({
      by: ["api", "endpoint"],
      where: { ...own, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
      _count: true,
    }),
    prisma.rankKeyword.findMany({
      where: own,
      select: { id: true, projectId: true, keyword: true },
    }),
  ]);

  // Tendencia de rank por keyword: comparamos las 2 últimas posiciones de los
  // últimos 90 días (suficiente para cualquier frecuencia diaria/semanal/mensual).
  const keywordIds = rankKeywords.map((k) => k.id);
  const positions =
    keywordIds.length > 0
      ? await prisma.rankPosition.findMany({
          where: { rankKeywordId: { in: keywordIds }, checkedAt: { gte: ninetyDaysAgo } },
          orderBy: { checkedAt: "desc" },
          select: { rankKeywordId: true, position: true },
        })
      : [];

  // Nos quedamos con las 2 posiciones más recientes por keyword (ya vienen
  // ordenadas desc por checkedAt).
  const posByKeyword = new Map<string, (number | null)[]>();
  for (const p of positions) {
    let arr = posByKeyword.get(p.rankKeywordId);
    if (!arr) {
      arr = [];
      posByKeyword.set(p.rankKeywordId, arr);
    }
    if (arr.length < 2) arr.push(p.position);
  }

  const trendByProject = new Map<string, { up: number; down: number }>();
  const bigDrops: { projectId: string; keyword: string; delta: number }[] = [];
  for (const k of rankKeywords) {
    const arr = posByKeyword.get(k.id);
    if (!arr || arr.length < 2 || arr[0] == null || arr[1] == null) continue;
    const latest = arr[0] as number;
    const prev = arr[1] as number;
    const tally = trendByProject.get(k.projectId) ?? { up: 0, down: 0 };
    if (latest < prev) tally.up++;
    else if (latest > prev) {
      tally.down++;
      const delta = latest - prev;
      if (delta >= 10) bigDrops.push({ projectId: k.projectId, keyword: k.keyword, delta });
    }
    trendByProject.set(k.projectId, tally);
  }

  // Agregado global de movimiento para el StatHero de keywords.
  let trendUpTotal = 0;
  let trendDownTotal = 0;
  for (const t of trendByProject.values()) {
    trendUpTotal += t.up;
    trendDownTotal += t.down;
  }

  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const latestAuditByProject = new Map<string, number | null>();
  for (const a of latestCompletedAudits) {
    if (!latestAuditByProject.has(a.projectId)) latestAuditByProject.set(a.projectId, a.overallScore);
  }

  const latestGeogridByProject = new Map<
    string,
    { foundCount: number | null; gridSize: number; averagePosition: number | null }
  >();
  for (const g of latestGeogrids) {
    if (!latestGeogridByProject.has(g.projectId)) {
      latestGeogridByProject.set(g.projectId, {
        foundCount: g.foundCount,
        gridSize: g.gridSize,
        averagePosition: g.averagePosition,
      });
    }
  }

  const monthCostByProject = new Map<string, number>();
  for (const r of monthCostRows) {
    if (r.projectId) monthCostByProject.set(r.projectId, r._sum.costUsd ? Number(r._sum.costUsd) : 0);
  }

  const monthTotal = monthTotalAgg._sum.costUsd ? Number(monthTotalAgg._sum.costUsd) : 0;
  const monthLabel = startOfMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const dfsPct = dfsLimit !== null ? (dfsSpent / dfsLimit) * 100 : null;
  const projectsWithoutDomain = projects.filter((p) => !p.domain);

  type Alert = { tone: "danger" | "warning"; text: string; href?: string };
  const alerts: Alert[] = [];

  // Lo más importante primero: tope superado (rojo), cerca del tope (ámbar).
  if (dfsLimit !== null && dfsSpent >= dfsLimit) {
    alerts.push({
      tone: "danger",
      text: `Tope mensual de DataForSEO superado: ${dfsSpent.toFixed(2)}$ de ${dfsLimit.toFixed(2)}$.`,
      href: "/app/costes",
    });
  } else if (dfsLimit !== null && dfsSpent >= dfsLimit * 0.8) {
    alerts.push({
      tone: "warning",
      text: `Cerca del tope mensual de DataForSEO: ${dfsPct!.toFixed(0)}% (${dfsSpent.toFixed(2)}$ de ${dfsLimit.toFixed(2)}$).`,
      href: "/app/costes",
    });
  }

  for (const fa of failedAudits) {
    alerts.push({
      tone: "danger",
      text: `Auditoría fallida en ${projectName.get(fa.projectId) ?? "proyecto eliminado"}${fa.errorMessage ? ` — ${fa.errorMessage}` : ""}.`,
      href: `/app/proyectos/${fa.projectId}/auditoria`,
    });
  }

  if (projectsWithoutDomain.length > 0) {
    alerts.push({
      tone: "warning",
      text:
        projectsWithoutDomain.length === 1
          ? `${projectsWithoutDomain[0].name} no tiene dominio configurado.`
          : `${projectsWithoutDomain.length} proyectos sin dominio configurado.`,
      href:
        projectsWithoutDomain.length === 1
          ? `/app/proyectos/${projectsWithoutDomain[0].id}`
          : "/app/proyectos",
    });
  }

  for (const d of bigDrops.slice(0, 5)) {
    alerts.push({
      tone: "warning",
      text: `«${d.keyword}» ha caído ${d.delta} posiciones en ${projectName.get(d.projectId) ?? "proyecto"}.`,
      href: `/app/proyectos/${d.projectId}/rank`,
    });
  }

  const topEndpoints = endpointRows
    .map((r) => ({
      endpoint: r.endpoint,
      cost: r._sum.costUsd ? Number(r._sum.costUsd) : 0,
      count: r._count,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);
  const topEndpointsMax = topEndpoints[0]?.cost ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sala de control"
        title="Panel general"
        description={admin ? "Resumen de toda la instalación: proyectos, costes, posicionamiento y avisos." : "Resumen de tus proyectos: costes, posicionamiento y avisos."}
      />

      {/* Bento superior: presupuesto (héroe de tinta) + stats clave */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Presupuesto DataForSEO — tarjeta protagonista */}
        <div className="md:col-span-2 bg-brand text-white rounded-2xl p-6 relative overflow-hidden shadow-[0_10px_30px_-10px_rgba(14,107,79,0.55)]">
          {/* Barras de ranking como textura de fondo */}
          <div
            className="absolute inset-y-0 right-5 flex items-end gap-2 opacity-[0.10] pointer-events-none"
            aria-hidden="true"
          >
            {[36, 56, 48, 76, 62, 96].map((h, i) => (
              <div key={i} className="w-5 rounded-t-md bg-white" style={{ height: h }} />
            ))}
          </div>
          <div className="relative flex flex-col gap-5 h-full">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-medium text-white/60">
                Presupuesto DataForSEO · <span className="capitalize">{monthLabel}</span>
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-signal">
                <Gauge className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight tabular-nums leading-none">
                {dfsSpent.toFixed(2)}$
              </span>
              <span className="text-sm text-white/50">
                {dfsLimit !== null ? `de ${dfsLimit.toFixed(2)}$` : "sin tope configurado"}
              </span>
            </div>
            {dfsLimit !== null && (
              <div className="mt-auto">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs text-white/50">Consumo del mes</span>
                  <span className={`text-lg font-bold tabular-nums ${dfsPct! >= 100 ? "text-red-300" : dfsPct! >= 80 ? "text-amber-200" : "text-signal"}`}>
                    {dfsPct!.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dfsPct! >= 100 ? "bg-red-400" : dfsPct! >= 80 ? "bg-amber-300" : "bg-signal"}`}
                    style={{ width: `${Math.min(100, Math.max(0, dfsPct!))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <StatHero
          label="Proyectos activos"
          value={String(projects.length)}
          sub={projectsWithoutDomain.length > 0 ? `${projectsWithoutDomain.length} sin dominio` : "todos con dominio"}
          icon={<FolderKanban className="h-4 w-4" />}
        />

        <StatHero
          label="Coste total del mes"
          value={`${monthTotal.toFixed(2)}$`}
          sub={monthLabel}
          icon={<Wallet className="h-4 w-4" />}
        />

        <StatHero
          label="Keywords en seguimiento"
          value={String(totalKeywordCount)}
          sub="últimos 90 días"
          icon={<Target className="h-4 w-4" />}
          delta={
            trendUpTotal + trendDownTotal > 0
              ? {
                  dir: trendUpTotal >= trendDownTotal ? "up" : "down",
                  text: `${trendUpTotal}↑ · ${trendDownTotal}↓`,
                }
              : undefined
          }
        />

        <StatHero
          label="Estudios de keywords"
          value={String(studyCount)}
          sub="DataForSEO Labs"
          icon={<ListChecks className="h-4 w-4" />}
        />

        {/* Avisos — timeline con puntos */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-line p-5 shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold tracking-tight text-gray-900">Avisos</h2>
            {alerts.length === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-400">Todo en orden. Nada que revisar hoy.</p>
          ) : (
            <ul className="space-y-3">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.tone === "danger" ? "bg-red-500" : "bg-amber-400"}`}
                    aria-hidden="true"
                  />
                  <Link href={a.href ?? "#"} className="group flex-1 min-w-0">
                    <span className={`text-sm leading-snug ${a.tone === "danger" ? "text-red-700" : "text-amber-700"}`}>
                      {a.text}
                    </span>
                    <ArrowRight className="inline h-3.5 w-3.5 ml-1.5 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Salud de los proyectos */}
      <div className="bg-white rounded-2xl border border-line p-5 shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold tracking-tight text-gray-900">Salud de los proyectos</h2>
          <Link
            href="/app/proyectos"
            className="text-[13px] font-medium text-gray-400 hover:text-brand transition-colors"
          >
            Ver todos →
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no hay proyectos.{" "}
            <Link href="/app/proyectos" className="text-brand underline underline-offset-2">
              Crear el primero
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-wide bg-foreground text-white/80">
                  <th className="py-2.5 pl-4 pr-3 font-medium rounded-tl-lg">Proyecto</th>
                  <th className="py-2.5 px-3 font-medium">Nota auditoría</th>
                  <th className="py-2.5 px-3 font-medium">Tendencia rank</th>
                  <th className="py-2.5 px-3 font-medium">Último geogrid</th>
                  <th className="py-2.5 pl-3 pr-4 font-medium text-right rounded-tr-lg">Coste mes</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const score = latestAuditByProject.get(p.id) ?? null;
                  const trend = trendByProject.get(p.id);
                  const geo = latestGeogridByProject.get(p.id);
                  const cost = monthCostByProject.get(p.id) ?? 0;
                  const trendTotal = trend ? trend.up + trend.down : 0;
                  return (
                    <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-black/[0.025] transition-colors">
                      <td className="py-2.5 pl-4 pr-3">
                        <Link href={`/app/proyectos/${p.id}`} className="flex items-center gap-2.5 group">
                          {/* Monograma del proyecto (inicial sobre verde suave) */}
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[13px] font-bold text-brand">
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-gray-900 group-hover:text-brand transition-colors truncate">
                              {p.name}
                            </span>
                            {p.domain ? (
                              <span className="block text-xs text-gray-400 truncate">{p.domain}</span>
                            ) : (
                              <span className="block text-xs text-amber-600">sin dominio</span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className={`py-2.5 px-3 font-bold tabular-nums ${scoreTone(score)}`}>
                        {score == null ? "—" : `${score}/100`}
                      </td>
                      <td className="py-2.5 px-3">
                        {trend && trendTotal > 0 ? (
                          <span className="flex items-center gap-3">
                            {trend.up > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold tabular-nums">
                                <TrendingUp className="h-3.5 w-3.5" />
                                {trend.up}
                              </span>
                            )}
                            {trend.down > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold tabular-nums">
                                <TrendingDown className="h-3.5 w-3.5" />
                                {trend.down}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 tabular-nums">
                        {geo ? (
                          <span>
                            {geo.foundCount ?? 0}/{geo.gridSize * geo.gridSize}
                            {geo.averagePosition != null && (
                              <span className="text-gray-400"> · {geo.averagePosition.toFixed(1)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right font-semibold text-gray-900 tabular-nums">
                        {cost > 0 ? `${cost.toFixed(2)}$` : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Costes del mes — barras horizontales proporcionales */}
      <div className="bg-white rounded-2xl border border-line p-5 shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold tracking-tight text-gray-900">¿A dónde va el gasto?</h2>
          <Link
            href="/app/costes"
            className="text-[13px] font-medium text-gray-400 hover:text-brand transition-colors"
          >
            Ver detalle →
          </Link>
        </div>
        {topEndpoints.length === 0 ? (
          <p className="text-sm text-gray-400">Sin consumo este mes.</p>
        ) : (
          <div className="space-y-3">
            {topEndpoints.map((r) => (
              <div key={r.endpoint} className="flex items-center gap-3">
                <span className="w-56 shrink-0 text-[13px] text-gray-600 truncate">
                  {ENDPOINT_LABELS[r.endpoint] ?? r.endpoint}
                  <span className="text-gray-400"> · {r.count}</span>
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-black/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand/70"
                    style={{ width: `${Math.max(4, (r.cost / topEndpointsMax) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-[13px] font-semibold text-gray-900 tabular-nums">
                  {r.cost.toFixed(3)}$
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
