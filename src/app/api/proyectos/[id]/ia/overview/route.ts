import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AI_OVERVIEW_EST_COST_USD } from "@/lib/ai-visibility/overview";
import { rootDomain } from "@/lib/ai-visibility/detect";

// GET — keywords del Rank Tracking con su última comprobación de AI Overview.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "ia");
  if (gate) return gate;
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true, domain: true });
  if (!project) return projectNotFound();

  const [keywords, competitors] = await Promise.all([
    prisma.rankKeyword.findMany({
      where: { projectId: id },
      orderBy: [{ lastPosition: { sort: "asc", nulls: "last" } }, { keyword: "asc" }],
      select: {
        id: true, keyword: true, device: true, locationName: true, lastPosition: true,
        aiOverviewChecks: {
          orderBy: { checkedAt: "desc" },
          take: 1,
          select: { hasOverview: true, cited: true, citedRank: true, references: true, excerpt: true, checkedAt: true },
        },
      },
    }),
    prisma.competitor.findMany({ where: { projectId: id }, select: { domain: true } }),
  ]);

  return NextResponse.json({
    domain: project.domain ? rootDomain(project.domain) : null,
    competitors: competitors.map((c) => rootDomain(c.domain)),
    estCostUsd: AI_OVERVIEW_EST_COST_USD,
    keywords: keywords.map((k) => ({
      id: k.id,
      keyword: k.keyword,
      device: k.device,
      locationName: k.locationName,
      lastPosition: k.lastPosition,
      check: k.aiOverviewChecks[0] ?? null,
    })),
  });
}
