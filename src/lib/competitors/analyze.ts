import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { assertWithinSpendLimit } from "@/lib/dataforseo/spend";
import { alertCompetitorGrowth } from "@/lib/notifications/alerts";
import { competitorAnalysisCostUsd, contentGapCostUsd } from "@/lib/dataforseo/pricing";
import { fetchDomainOverview, fetchRankedKeywords, fetchContentGap, type RankedKeyword } from "@/lib/competitors/dataforseo";

// Guard de frescura compartido por Competidores/Geogrid/Bootstrap: si ya
// sabemos la visibilidad o el content gap de un dominio de hace menos de 7
// días (mismo TTL que SerpCache), no se vuelve a pagar — mismo criterio
// "bloqueo estricto, sin override" que el guard diario de Rank Tracking. Vive
// AQUÍ (no en cada endpoint) para que TODO caller (botón "Analizar", "Analizar
// todos", Bootstrap, Geogrid "Ver keywords") quede protegido igual, sin poder
// saltárselo por otra puerta.
export const DOMAIN_DATA_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

async function getFreshVisibilitySnapshot(projectId: string, domain: string) {
  const cutoff = new Date(Date.now() - DOMAIN_DATA_FRESH_MS);
  return prisma.visibilitySnapshot.findFirst({
    where: { projectId, domain, fetchedAt: { gt: cutoff }, dataVersion: { gte: 2 } },
    orderBy: { fetchedAt: "desc" },
  });
}

export async function isVisibilityFresh(projectId: string, domain: string): Promise<boolean> {
  return (await getFreshVisibilitySnapshot(projectId, domain)) !== null;
}

export function isContentGapFresh(contentGapAt: Date | null, version = 2): boolean {
  if (!contentGapAt || version < 2) return false;
  return contentGapAt.getTime() > Date.now() - DOMAIN_DATA_FRESH_MS;
}

// Visibilidad de un dominio (overview + ranked keywords): si hay un
// VisibilitySnapshot fresco, lo devuelve gratis; si no, paga las dos llamadas
// Labs, crea el snapshot y registra el coste. Usado por el botón "Analizar"
// de Competidores y por el bloque de competidores del Bootstrap.
export async function analyzeCompetitorVisibility(
  projectId: string,
  domain: string,
  opts: { locationCode: number; languageCode: string; limit: number }
): Promise<{
  snapshot: Awaited<ReturnType<typeof prisma.visibilitySnapshot.create>>;
  fromCache: boolean;
}> {
  const existing = await getFreshVisibilitySnapshot(projectId, domain);
  if (existing) return { snapshot: existing, fromCache: true };

  await assertWithinSpendLimit(projectId, competitorAnalysisCostUsd(opts.limit));
  const [overview, ranked] = await Promise.all([
    fetchDomainOverview({ domain, locationCode: opts.locationCode, languageCode: opts.languageCode }),
    fetchRankedKeywords({ domain, locationCode: opts.locationCode, languageCode: opts.languageCode, limit: opts.limit }),
  ]);

  const previous = await prisma.visibilitySnapshot.findFirst({
    where: { projectId, domain },
    orderBy: { fetchedAt: "desc" },
    select: { organicTraffic: true },
  });
  const snapshot = await prisma.visibilitySnapshot.create({
    data: {
      projectId,
      domain,
      organicTraffic: overview.organicTraffic,
      organicKeywords: overview.organicKeywords,
      positionBuckets: overview.positionBuckets ?? undefined,
      trafficValue: overview.trafficValue ?? undefined,
      movement: overview.movement ?? undefined,
      paid: overview.paid ?? undefined,
      dataVersion: 2,
      topKeywords: ranked.items as unknown as Prisma.InputJsonValue,
    },
  });

  await alertCompetitorGrowth(projectId, domain, previous?.organicTraffic ?? null, overview.organicTraffic);

  for (const [endpoint, cost] of [
    ["competidores.visibilidad", overview.costUsd],
    ["competidores.ranked", ranked.costUsd],
  ] as const) {
    if (cost !== null) {
      await prisma.apiUsageLog.create({
        data: { projectId, api: "dataforseo", endpoint, model: null, costUsd: cost },
      });
    }
  }

  return { snapshot, fromCache: false };
}

// Content gap de un competidor: si Competitor.contentGapAt es de hace menos
// de 7 días, devuelve lo ya guardado gratis; si no, paga domain_intersection,
// actualiza el competidor y registra el coste.
export async function computeCompetitorContentGap(
  projectId: string,
  competitor: { id: string; domain: string; contentGap: unknown; contentGapAt: Date | null; contentGapVersion?: number },
  projectDomain: string,
  opts: { locationCode: number; languageCode: string; limit: number }
): Promise<{ contentGap: RankedKeyword[]; contentGapAt: Date; fromCache: boolean }> {
  if (isContentGapFresh(competitor.contentGapAt, competitor.contentGapVersion ?? 1)) {
    return {
      contentGap: ((competitor.contentGap as unknown as RankedKeyword[]) ?? []),
      contentGapAt: competitor.contentGapAt as Date,
      fromCache: true,
    };
  }

  await assertWithinSpendLimit(projectId, contentGapCostUsd(opts.limit));
  const { items, costUsd } = await fetchContentGap({
    competitorDomain: competitor.domain,
    projectDomain,
    locationCode: opts.locationCode,
    languageCode: opts.languageCode,
    limit: opts.limit,
  });

  const updated = await prisma.competitor.update({
    where: { id: competitor.id },
    data: { contentGap: items as unknown as Prisma.InputJsonValue, contentGapAt: new Date(), contentGapVersion: 2 },
  });

  if (costUsd !== null) {
    await prisma.apiUsageLog.create({
      data: { projectId, api: "dataforseo", endpoint: "competidores.contentgap", model: null, costUsd },
    });
  }

  return { contentGap: items, contentGapAt: updated.contentGapAt as Date, fromCache: false };
}
