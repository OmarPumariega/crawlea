import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCachedSerpEntry } from "@/lib/dataforseo/serp-cache";
import { fetchTopOrganic } from "@/lib/tfidf/serp";
import { DataForSeoError } from "@/lib/dataforseo/client";
import { DataForSeoSpendLimitError, assertWithinSpendLimit } from "@/lib/dataforseo/spend";
import { rankCheckCostUsd } from "@/lib/dataforseo/pricing";
import { clusterBySerp } from "@/lib/keywords/cluster";

// Clusters de un estudio por coincidencia del top-10 de Google. GET usa solo
// los SERP que ya están guardados (gratis) y dice cuántas keywords faltan y
// cuánto costaría traerlas; POST trae las que faltan (pago, con guard de
// gasto). Máximo por petición para que un estudio enorme no dispare el coste.
const MAX_FETCH_PER_REQUEST = 40;
const DEVICE = "desktop";
const CONCURRENCY = 3;

async function load(id: string, studyId: string) {
  const study = await prisma.keywordStudy.findUnique({
    where: { id: studyId },
    select: {
      projectId: true,
      languageCode: true,
      locationCode: true,
      keywords: { select: { keyword: true, searchVolume: true }, orderBy: { searchVolume: "desc" }, take: 500 },
    },
  });
  if (!study || study.projectId !== id) return null;
  const withSerp: { keyword: string; volume: number | null; urls: string[] }[] = [];
  const missing: { keyword: string; volume: number | null }[] = [];
  for (const k of study.keywords) {
    const cached = await getCachedSerpEntry({ keyword: k.keyword, locationCode: study.locationCode, languageCode: study.languageCode, device: DEVICE });
    if (cached && cached.results.length > 0) withSerp.push({ keyword: k.keyword, volume: k.searchVolume, urls: cached.results.map((r) => r.url) });
    else missing.push({ keyword: k.keyword, volume: k.searchVolume });
  }
  return { study, withSerp, missing };
}

function payload(data: NonNullable<Awaited<ReturnType<typeof load>>>, extra: Record<string, unknown> = {}) {
  const clusters = clusterBySerp(data.withSerp, 3);
  return {
    clusters,
    analyzed: data.withSerp.length,
    missing: data.missing.length,
    missingCostUsd: Math.round(Math.min(data.missing.length, MAX_FETCH_PER_REQUEST) * rankCheckCostUsd(10) * 1000) / 1000,
    maxPerRequest: MAX_FETCH_PER_REQUEST,
    ...extra,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; studyId: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id, studyId } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const data = await load(id, studyId);
  if (!data) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
  return NextResponse.json(payload(data));
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; studyId: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id, studyId } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const data = await load(id, studyId);
  if (!data) return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });

  const queue = data.missing.slice(0, MAX_FETCH_PER_REQUEST);
  let fetched = 0;
  let stopped: string | null = null;
  const errors = new Set<string>();

  async function worker() {
    while (queue.length > 0 && !stopped) {
      const k = queue.shift()!;
      try {
        await assertWithinSpendLimit(id, rankCheckCostUsd(10));
        const out = await fetchTopOrganic({ keyword: k.keyword, locationCode: data!.study.locationCode, languageCode: data!.study.languageCode, device: DEVICE });
        if (out.costUsd !== null) {
          await prisma.apiUsageLog.create({ data: { projectId: id, api: "dataforseo", endpoint: "keywords.clusters.serp", model: null, costUsd: out.costUsd } });
        }
        fetched++;
      } catch (e) {
        if (e instanceof DataForSeoSpendLimitError) stopped = e.message;
        else errors.add(e instanceof DataForSeoError ? e.message : "No se pudo consultar alguna keyword");
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const fresh = await load(id, studyId);
  return NextResponse.json(payload(fresh!, { fetched, stopped, errors: [...errors] }));
}
