import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { DataForSeoError } from "@/lib/dataforseo/client";
import { assertWithinSpendLimit, DataForSeoSpendLimitError } from "@/lib/dataforseo/spend";
import { checkAiOverview, AI_OVERVIEW_EST_COST_USD } from "@/lib/ai-visibility/overview";

export const maxDuration = 300;
const MAX_PER_CALL = 25;

// POST { rankKeywordIds: string[] } — pide a Google el SERP de cada keyword y
// guarda si muestra AI Overview y qué fuentes cita. Tope de créditos antes de
// cada consulta; si se agota, devuelve lo ya hecho.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "ia");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true, domain: true });
  if (!project) return projectNotFound();
  if (!project.domain) {
    return NextResponse.json({ error: "El proyecto necesita un dominio para medir si te citan" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { rankKeywordIds?: unknown };
  const ids = (Array.isArray(body.rankKeywordIds) ? body.rankKeywordIds : []).filter((x): x is string => typeof x === "string");
  if (ids.length === 0) return NextResponse.json({ error: "Elige al menos una keyword" }, { status: 400 });
  if (ids.length > MAX_PER_CALL) {
    return NextResponse.json({ error: `Comprueba como máximo ${MAX_PER_CALL} keywords de una vez` }, { status: 400 });
  }

  const keywords = await prisma.rankKeyword.findMany({ where: { id: { in: ids }, projectId: id } });
  if (keywords.length === 0) return NextResponse.json({ error: "Keywords no encontradas" }, { status: 404 });

  try {
    await assertWithinSpendLimit(id, AI_OVERVIEW_EST_COST_USD * keywords.length);
  } catch (error) {
    if (error instanceof DataForSeoSpendLimitError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }

  let done = 0;
  let stopped: string | null = null;
  const errors = new Set<string>();
  for (const k of keywords) {
    try {
      await assertWithinSpendLimit(id, AI_OVERVIEW_EST_COST_USD);
      const r = await checkAiOverview({
        keyword: k.keyword,
        locationCode: k.locationCode,
        languageCode: k.languageCode,
        device: k.device,
        projectDomain: project.domain,
      });
      await prisma.aiOverviewCheck.create({
        data: {
          rankKeywordId: k.id,
          hasOverview: r.hasOverview,
          cited: r.cited,
          citedRank: r.citedRank,
          references: r.references,
          excerpt: r.excerpt,
          costUsd: r.costUsd,
        },
      });
      if (r.costUsd !== null) {
        await prisma.apiUsageLog.create({
          data: { projectId: id, api: "dataforseo", endpoint: "ia.ai-overview", model: null, costUsd: r.costUsd },
        });
      }
      done++;
    } catch (error) {
      if (error instanceof DataForSeoSpendLimitError) {
        stopped = error.message;
        break;
      }
      errors.add(error instanceof DataForSeoError ? error.message : "No se pudo completar una de las consultas");
    }
  }
  return NextResponse.json({ done, stopped, errors: [...errors] });
}
