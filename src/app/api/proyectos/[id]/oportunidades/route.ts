import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleClient, GoogleNotConnectedError } from "@/lib/google/client";
import { listQueryPageRows } from "@/lib/google/search-console";
import { classifyGoogleError } from "@/lib/google/errors";
import { computeQuickWins, computeDecay } from "@/lib/opportunities/compute";

// Oportunidades a partir de Search Console (gratis: misma cuota de Google, sin
// DataForSEO ni créditos). Dos vistas sobre las mismas filas query×página:
//   • ?vista=quickwins → keywords cerca del top, con CTR bajo, etc.
//   • ?vista=perdidas  → páginas que pierden tráfico frente al periodo anterior.
const DAYS = 90;
const GSC_DATA_LAG_DAYS = 2;
const ROW_LIMIT = 5000;

const fmt = (d: Date) => d.toISOString().slice(0, 10);
function rangeFor(days: number, offsetBack = 0) {
  const end = new Date();
  end.setDate(end.getDate() - GSC_DATA_LAG_DAYS - offsetBack);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { startDate: fmt(start), endDate: fmt(end) };
}

// Términos de marca (nombre del proyecto y dominio sin TLD): las búsquedas de
// marca no son una oportunidad de posicionamiento y ensucian la lista.
function brandTerms(name: string, domain: string | null): string[] {
  const terms = new Set<string>();
  const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const w of clean(name).split(/[^a-z0-9]+/)) if (w.length >= 4) terms.add(w);
  if (domain) {
    const host = clean(domain).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const root = host.split(".")[0];
    if (root.length >= 4) terms.add(root);
  }
  return [...terms];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (!project.gscSiteUrl) return NextResponse.json({ needsGsc: true });

  let auth;
  try {
    auth = await getGoogleClient(project.userId);
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) return NextResponse.json({ needsGsc: true });
    throw error;
  }

  const vista = req.nextUrl.searchParams.get("vista") === "perdidas" ? "perdidas" : "quickwins";

  try {
    if (vista === "quickwins") {
      const [rows, tracked] = await Promise.all([
        listQueryPageRows(auth, project.gscSiteUrl, rangeFor(DAYS), ROW_LIMIT),
        prisma.rankKeyword.findMany({ where: { projectId: id }, select: { keyword: true } }),
      ]);
      const result = computeQuickWins(rows, brandTerms(project.name, project.domain));
      const trackedSet = new Set(tracked.map((t) => t.keyword.toLowerCase()));
      return NextResponse.json({
        ...result,
        items: result.items.slice(0, 150).map((i) => ({ ...i, tracked: trackedSet.has(i.query.toLowerCase()) })),
        days: DAYS,
        truncated: rows.length >= ROW_LIMIT,
      });
    }

    const [cur, prev] = await Promise.all([
      listQueryPageRows(auth, project.gscSiteUrl, rangeFor(DAYS), ROW_LIMIT),
      listQueryPageRows(auth, project.gscSiteUrl, rangeFor(DAYS, DAYS), ROW_LIMIT),
    ]);
    return NextResponse.json({
      items: computeDecay(cur, prev).slice(0, 100),
      days: DAYS,
      truncated: cur.length >= ROW_LIMIT || prev.length >= ROW_LIMIT,
    });
  } catch (error) {
    const { status, message } = classifyGoogleError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
