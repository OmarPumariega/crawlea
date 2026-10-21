import { requireSession, projectForSession, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { planAllowsModule } from "@/lib/plans";
import { getSetting } from "@/lib/settings";
import { geogridCostUsd, rankCheckCostUsd, competitorAnalysisCostUsd, backlinkAnalysisCostUsd } from "@/lib/dataforseo/pricing";
import { executeMeasurement } from "@/lib/measurements/job";
import {
  MEASUREMENT_MODULES,
  isFrequency,
  isMeasurementModule,
  nextRunFrom,
  type MeasurementFrequency,
} from "@/lib/measurements/modules";

// Mediciones programadas del proyecto (pestaña Mediciones de la Ficha).
//   GET   → cada medición con su programación, si el plan/proyecto la permite y el coste estimado por vez.
//   PUT   → { module, enabled, frequency } guarda la programación. La primera medición automática es una
//           frecuencia después de activarla (no se gasta nada al marcar la casilla).
//   POST  → { module } «Medir ahora»: la ejecuta en segundo plano y devuelve enseguida.

async function loadContext(projectId: string) {
  const [rankKeywords, geoRuns, competitors] = await Promise.all([
    prisma.rankKeyword.findMany({ where: { projectId }, select: { depth: true } }),
    prisma.geogridRun.findMany({
      where: { projectId, status: "completed" },
      orderBy: { triggeredAt: "desc" },
      take: 30,
      select: { keyword: true, gridSize: true },
    }),
    prisma.competitor.count({ where: { projectId } }),
  ]);
  const seen = new Set<string>();
  const geoConfigs = geoRuns.filter((r) => (seen.has(r.keyword) ? false : (seen.add(r.keyword), true))).slice(0, 3);
  return { rankKeywords, geoConfigs, competitors };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return projectNotFound();

  const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { plan: true, role: true } });
  const isAdmin = owner?.role === "admin";
  const [schedules, ctx, hasPsiKey] = await Promise.all([
    prisma.measurementSchedule.findMany({ where: { projectId: id } }),
    loadContext(id),
    getSetting("PAGESPEED_API_KEY").then((k) => !!k),
  ]);

  const costPerRun: Record<string, number> = {
    rank: ctx.rankKeywords.reduce((s, k) => s + rankCheckCostUsd(k.depth), 0),
    geogrid: ctx.geoConfigs.reduce((s, c) => s + geogridCostUsd(c.gridSize), 0),
    audit: 0,
    velocidad: 0,
    competidores: (1 + ctx.competitors) * competitorAnalysisCostUsd(),
    backlinks: backlinkAnalysisCostUsd(50),
  };

  const modules = MEASUREMENT_MODULES.map((m) => {
    const sch = schedules.find((s) => s.module === m.id);
    let unavailable: string | null = null;
    if (m.planModule && !isAdmin && !planAllowsModule(owner?.plan, m.planModule)) unavailable = "No está incluido en tu plan.";
    else if (!project.domain && m.id !== "geogrid") unavailable = "Añade el dominio del proyecto en Datos.";
    else if (m.id === "geogrid" && !project.isLocalBusiness) unavailable = "Solo para negocios locales: elige la ficha de Google en Datos.";
    else if (m.id === "rank" && ctx.rankKeywords.length === 0) unavailable = "Aún no sigues ninguna keyword en Rank Tracking.";
    else if (m.id === "geogrid" && ctx.geoConfigs.length === 0) unavailable = "Lanza antes un mapa de calor en SEO local.";
    else if (m.id === "velocidad" && !hasPsiKey) unavailable = "Falta configurar la clave de PageSpeed.";
    return {
      id: m.id,
      label: m.label,
      description: m.description,
      unavailable,
      enabled: sch?.enabled ?? false,
      frequency: (sch?.frequency as MeasurementFrequency | undefined) ?? "monthly",
      nextRunAt: sch?.nextRunAt ?? null,
      lastRunAt: sch?.lastRunAt ?? null,
      lastStatus: sch?.lastStatus ?? null,
      lastMessage: sch?.lastMessage ?? null,
      costPerRunUsd: costPerRun[m.id] ?? 0,
    };
  });
  return NextResponse.json({ modules });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return projectNotFound();

  const body = (await req.json().catch(() => ({}))) as { module?: unknown; enabled?: unknown; frequency?: unknown };
  if (!isMeasurementModule(body.module)) return NextResponse.json({ error: "Medición desconocida" }, { status: 400 });
  const def = MEASUREMENT_MODULES.find((m) => m.id === body.module)!;
  const frequency = isFrequency(body.frequency) ? body.frequency : "monthly";
  const enabled = body.enabled === true;

  if (enabled && def.planModule) {
    const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { plan: true, role: true } });
    if (owner?.role !== "admin" && !planAllowsModule(owner?.plan, def.planModule)) {
      return NextResponse.json({ error: "Tu plan no incluye este módulo." }, { status: 402 });
    }
  }

  const existing = await prisma.measurementSchedule.findUnique({ where: { projectId_module: { projectId: id, module: def.id } } });
  // Solo se recalcula la próxima fecha si se activa ahora o cambia la frecuencia.
  const needsNext = enabled && (!existing?.enabled || existing.frequency !== frequency || !existing.nextRunAt);
  const saved = await prisma.measurementSchedule.upsert({
    where: { projectId_module: { projectId: id, module: def.id } },
    create: { projectId: id, module: def.id, enabled, frequency, nextRunAt: enabled ? nextRunFrom(new Date(), frequency) : null },
    update: { enabled, frequency, nextRunAt: !enabled ? null : needsNext ? nextRunFrom(new Date(), frequency) : existing?.nextRunAt },
  });
  return NextResponse.json({ ok: true, nextRunAt: saved.nextRunAt });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return projectNotFound();

  const body = (await req.json().catch(() => ({}))) as { module?: unknown };
  if (!isMeasurementModule(body.module)) return NextResponse.json({ error: "Medición desconocida" }, { status: 400 });

  const sch = await prisma.measurementSchedule.upsert({
    where: { projectId_module: { projectId: id, module: body.module } },
    create: { projectId: id, module: body.module },
    update: {},
  });
  // Segundo plano: algunas mediciones (rank con muchas keywords, PageSpeed) tardan más de lo que espera un clic.
  void executeMeasurement(sch.id);
  return NextResponse.json({ ok: true }, { status: 202 });
}
