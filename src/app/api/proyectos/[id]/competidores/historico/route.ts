import { requireSession, projectForSession, moduleGate } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { postTask, DataForSeoError } from "@/lib/dataforseo/client";
import { DataForSeoSpendLimitError, assertWithinSpendLimit } from "@/lib/dataforseo/spend";
import { TRAFFIC_HISTORY_COST_USD } from "@/lib/dataforseo/pricing";
import { parseHistoricalRank } from "@/lib/competitors/parse";
import { normalizeDomain } from "@/lib/competitors/dataforseo";

// Curva mensual de tráfico/keywords de un dominio (propio o competidor).
// GET: lo ya guardado (gratis). POST: lo pide a Labs (~0,13 $) y lo guarda; si
// hay una curva de hace menos de 30 días, la devuelve sin pagar.
const FRESH_MS = 30 * 24 * 3600 * 1000;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const gate = await moduleGate(session, "competidores");
  if (gate) return gate;
  const { id } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const rows = await prisma.trafficHistory.findMany({ where: { projectId: id }, orderBy: { fetchedAt: "desc" }, distinct: ["domain"] });
  return NextResponse.json(rows.map((r) => ({ domain: r.domain, points: r.points, fetchedAt: r.fetchedAt })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const gate = await moduleGate(session, "competidores");
  if (gate) return gate;
  const { id } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }
  const domain = normalizeDomain(typeof body.domain === "string" ? body.domain : "");
  if (!domain) return NextResponse.json({ error: "Dominio inválido" }, { status: 400 });
  const locationCode = typeof body.locationCode === "number" ? body.locationCode : 2724;
  const languageCode = typeof body.languageCode === "string" ? body.languageCode : "es";

  const fresh = await prisma.trafficHistory.findFirst({ where: { projectId: id, domain, fetchedAt: { gt: new Date(Date.now() - FRESH_MS) } }, orderBy: { fetchedAt: "desc" } });
  if (fresh) return NextResponse.json({ domain, points: fresh.points, fetchedAt: fresh.fetchedAt, fromCache: true });

  try {
    await assertWithinSpendLimit(id, TRAFFIC_HISTORY_COST_USD);
    const task = await postTask("/v3/dataforseo_labs/google/historical_rank_overview/live", { target: domain, location_code: locationCode, language_code: languageCode }, "competidores.historico");
    const result = (Array.isArray(task.result) ? task.result[0] : null) as Record<string, unknown> | null;
    if (typeof task.cost === "number") {
      await prisma.apiUsageLog.create({ data: { projectId: id, api: "dataforseo", endpoint: "competidores.historico", model: null, costUsd: task.cost } });
    }
    const points = parseHistoricalRank(result);
    const row = await prisma.trafficHistory.create({ data: { projectId: id, domain, points: points as unknown as object } });
    return NextResponse.json({ domain, points, fetchedAt: row.fetchedAt, fromCache: false }, { status: 201 });
  } catch (error) {
    if (error instanceof DataForSeoSpendLimitError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof DataForSeoError) return NextResponse.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
