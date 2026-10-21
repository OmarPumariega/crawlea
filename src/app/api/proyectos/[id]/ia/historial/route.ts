import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

const MAX_ROWS = 300;

// GET — historial completo de comprobaciones del módulo: cada vez que se midió el AI Overview de una
// keyword o se hizo una pregunta a ChatGPT/Perplexity, de la más reciente a la más antigua.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "ia");
  if (gate) return gate;
  const { id } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return projectNotFound();

  const [overviews, answers] = await Promise.all([
    prisma.aiOverviewCheck.findMany({
      where: { rankKeyword: { projectId: id } },
      orderBy: { checkedAt: "desc" },
      take: MAX_ROWS,
      select: {
        id: true, hasOverview: true, cited: true, citedRank: true, references: true, excerpt: true, checkedAt: true,
        rankKeyword: { select: { keyword: true, locationName: true, device: true } },
      },
    }),
    prisma.aiCheck.findMany({
      where: { prompt: { projectId: id } },
      orderBy: { checkedAt: "desc" },
      take: MAX_ROWS,
      select: {
        id: true, platform: true, cited: true, mentioned: true, citedRank: true, sources: true, answer: true,
        fanOutQueries: true, checkedAt: true,
        prompt: { select: { prompt: true } },
      },
    }),
  ]);

  const items = [
    ...overviews.map((o) => ({
      id: `o-${o.id}`,
      kind: "overview" as const,
      title: o.rankKeyword.keyword,
      detail: [o.rankKeyword.locationName, o.rankKeyword.device === "mobile" ? "móvil" : null].filter(Boolean).join(" · ") || null,
      outcome: o.hasOverview ? (o.cited ? "citado" : "no_citado") : "sin_overview",
      citedRank: o.citedRank,
      text: o.excerpt,
      sources: o.references,
      fanOutQueries: null as string[] | null,
      checkedAt: o.checkedAt,
    })),
    ...answers.map((a) => ({
      id: `a-${a.id}`,
      kind: a.platform === "perplexity" ? ("perplexity" as const) : ("chatgpt" as const),
      title: a.prompt.prompt,
      detail: null as string | null,
      outcome: a.cited ? "citado" : a.mentioned ? "mencionado" : "no_aparece",
      citedRank: a.citedRank,
      text: a.answer,
      sources: a.sources,
      fanOutQueries: (a.fanOutQueries as string[] | null) ?? null,
      checkedAt: a.checkedAt,
    })),
  ].sort((x, y) => y.checkedAt.getTime() - x.checkedAt.getTime());

  return NextResponse.json({ items });
}
