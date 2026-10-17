import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { normalizeKeyword } from "@/lib/keywords/normalize";
import { recomputeStudyPriorities } from "@/lib/keywords/study";

type ItemIn = {
  keyword: string;
  searchVolume?: number | null;
  competition?: string | null;
  cpc?: number | null;
  intent?: string | null;
  monthlySearches?: number[] | null;
  difficulty?: number | null;
  extras?: Record<string, unknown> | null;
  source?: string | null;
};

// Añade keywords al estudio con métricas ya conocidas (vienen de sugerencias,
// que ya los cacheó). Las duplicadas (ya en el estudio) se ignoran. Tras añadir
// se recalculan las prioridades de todo el estudio.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; studyId: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, studyId } = await params;

  if (!(await projectForSession(session, id, { id: true })))
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const study = await prisma.keywordStudy.findUnique({ where: { id: studyId } });
  if (!study || study.projectId !== id) {
    return NextResponse.json({ error: "Estudio no encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? (body.items as ItemIn[]) : [];
  // Normaliza, dedupe dentro del lote y descarta vacíos.
  const seen = new Set<string>();
  const items: ItemIn[] = [];
  for (const it of rawItems) {
    const kw = normalizeKeyword(typeof it.keyword === "string" ? it.keyword : "");
    if (!kw || seen.has(kw)) continue;
    seen.add(kw);
    items.push({ ...it, keyword: kw });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "Nada que añadir" }, { status: 400 });
  }

  // Keywords ya presentes en el estudio → ignorar (no duplicar).
  const existing = await prisma.keyword.findMany({
    where: { studyId, keyword: { in: items.map((i) => i.keyword) } },
    select: { keyword: true },
  });
  const taken = new Set(existing.map((k) => k.keyword));
  const toCreate = items.filter((i) => !taken.has(i.keyword));

  if (toCreate.length > 0) {
    await prisma.keyword.createMany({
      data: toCreate.map((i) => ({
        studyId,
        keyword: i.keyword,
        searchVolume: i.searchVolume ?? null,
        competition: i.competition ?? null,
        cpc: i.cpc ?? null,
        intent: i.intent ?? null,
        monthlySearches: i.monthlySearches ?? undefined,
        difficulty: i.difficulty ?? null,
        extras: i.extras && typeof i.extras === "object" && !Array.isArray(i.extras) ? (i.extras as Prisma.InputJsonValue) : undefined,
        source: i.source ?? null,
        priority: 0, // se recalcula abajo
      })),
    });
    // OJO: aquí NO se escribe en KeywordDataCache. Esa caché es compartida entre
    // todas las cuentas (el volumen es un dato objetivo), y estos valores los
    // manda el navegador: aceptarlos permitiría a un usuario falsear lo que ven
    // los demás. La caché solo la alimentan las respuestas reales de DataForSEO
    // en el servidor (sugerencias y Keyword Overview).
    await recomputeStudyPriorities(studyId);
  }

  return NextResponse.json({ added: toCreate.length, skipped: taken.size }, { status: 201 });
}
