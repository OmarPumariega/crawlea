import { requireSession, projectForSession, moduleGate } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { postTask, DataForSeoError } from "@/lib/dataforseo/client";
import { DataForSeoSpendLimitError, assertWithinSpendLimit } from "@/lib/dataforseo/spend";
import { discoverCompetitorsCostUsd, DISCOVER_COMPETITORS_LIMIT } from "@/lib/dataforseo/pricing";
import { parseCompetitorsDomain } from "@/lib/competitors/parse";
import { normalizeDomain } from "@/lib/competitors/dataforseo";

// Descubre los dominios que de verdad compiten contigo en Google (Labs
// competitors_domain: comparten keywords con tu web). Excluye los gigantes
// genéricos que DataForSEO marca como "top domains" (Wikipedia, YouTube...).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const gate = await moduleGate(session, "competidores");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (!project.domain) return NextResponse.json({ error: "Define el dominio del proyecto en su ficha." }, { status: 400 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* sin cuerpo: ubicación por defecto */
  }
  const locationCode = typeof body.locationCode === "number" ? body.locationCode : 2724;
  const languageCode = typeof body.languageCode === "string" ? body.languageCode : "es";
  const own = normalizeDomain(project.domain);

  try {
    await assertWithinSpendLimit(id, discoverCompetitorsCostUsd());
    const task = await postTask(
      "/v3/dataforseo_labs/google/competitors_domain/live",
      { target: own, location_code: locationCode, language_code: languageCode, limit: DISCOVER_COMPETITORS_LIMIT, exclude_top_domains: true },
      "competidores.descubrir"
    );
    const result = (Array.isArray(task.result) ? task.result[0] : null) as Record<string, unknown> | null;
    if (typeof task.cost === "number") {
      await prisma.apiUsageLog.create({ data: { projectId: id, api: "dataforseo", endpoint: "competidores.descubrir", model: null, costUsd: task.cost } });
    }
    const existing = new Set((await prisma.competitor.findMany({ where: { projectId: id }, select: { domain: true } })).map((c) => c.domain));
    const items = parseCompetitorsDomain(result, own).filter((c) => !existing.has(c.domain));
    return NextResponse.json({ items, totalFound: typeof result?.total_count === "number" ? result.total_count : null });
  } catch (error) {
    if (error instanceof DataForSeoSpendLimitError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof DataForSeoError) return NextResponse.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
