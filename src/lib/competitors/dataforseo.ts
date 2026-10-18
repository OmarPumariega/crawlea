import { postTask } from "@/lib/dataforseo/client";
import { normalizeDomain } from "@/lib/rank/serp";

// Espionaje de competidores (Tier 2). Tres endpoints de DataForSEO Labs:
//   • domain_rank_overview → visibilidad (tráfico orgánico estimado + nº keywords
//     + distribución de posiciones top3/10/100 + posición media)
//   • ranked_keywords      → keywords por las que un dominio rankea (+ posición,
//     volumen, CPC, dificultad y la URL + snippet con el que posiciona)
//   • domain_intersection  → content gap (mismo detalle por keyword)
//
// Mismo principio que el resto: nada se inventa, todo viene de la respuesta
// real. El coste (tasks[0].cost) se devuelve para registrarlo en ApiUsageLog.
//
// >>> APROVECHAR CADA CÉNTIMO <<<: DataForSEO Labs cobra por ÍTEM DEVUELTO, no
// por `limit` pedido, y cada ítem ya viene con keyword_info COMPLETA
// (competition, cpc, monthly_searches) y con el serp_element (title, url,
// description). Antes se extraían solo 3 campos y se tiraba el resto; ahora se
// persiste todo — es dato que ya habíamos pagado.

export type { RankedKeyword, PositionBuckets, DomainOverview, DomainMovement, PaidMetrics } from "@/lib/competitors/types";
import type { RankedKeyword, DomainOverview } from "@/lib/competitors/types";
import { parseDomainOverview, parseRankedItem, parseIntersectionItem } from "@/lib/competitors/parse";

export async function fetchDomainOverview(params: {
  domain: string;
  locationCode: number;
  languageCode: string;
}): Promise<DomainOverview & { costUsd: number | null }> {
  const task = await postTask(
    "/v3/dataforseo_labs/google/domain_rank_overview/live",
    { target: params.domain, location_code: params.locationCode, language_code: params.languageCode },
    "visibilidad"
  );
  const resultArr = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const item = Array.isArray(resultArr[0]?.items) ? (resultArr[0]!.items as Array<Record<string, unknown>>)[0] : null;
  return { ...parseDomainOverview(item), costUsd: typeof task.cost === "number" ? task.cost : null };
}

// Top keywords por las que rankea un dominio, con posición, volumen, CPC,
// dificultad, estacionalidad y la URL + snippet del competidor.
export async function fetchRankedKeywords(params: {
  domain: string;
  locationCode: number;
  languageCode: string;
  limit: number;
}): Promise<{ items: RankedKeyword[]; costUsd: number | null }> {
  const task = await postTask(
    "/v3/dataforseo_labs/google/ranked_keywords/live",
    {
      target: params.domain,
      location_code: params.locationCode,
      language_code: params.languageCode,
      item_types: ["organic"],
      // Primero las keywords que más tráfico aportan al dominio (antes el orden
      // era arbitrario y con límite podían quedar fuera las importantes).
      order_by: ["ranked_serp_element.serp_item.etv,desc"],
      limit: params.limit,
    },
    "ranked_keywords"
  );
  const resultArr = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const items = Array.isArray(resultArr[0]?.items) ? (resultArr[0]!.items as Array<Record<string, unknown>>) : [];
  const ranked: RankedKeyword[] = [];
  for (const raw of items) {
    const k = parseRankedItem(raw);
    if (k) ranked.push(k);
  }
  return { items: ranked, costUsd: typeof task.cost === "number" ? task.cost : null };
}

// Content gap: keywords por las que `competitorDomain` rankea y `projectDomain`
// NO. domain_intersection con intersections:false (target1=competidor,
// target2=proyecto) → solo keywords del competidor que el proyecto no tiene.
// Mismo nivel de detalle por keyword que ranked_keywords (cpc, dificultad,
// URL y snippet del competidor — antes se tiraban).
export async function fetchContentGap(params: {
  competitorDomain: string;
  projectDomain: string;
  locationCode: number;
  languageCode: string;
  limit: number;
}): Promise<{ items: RankedKeyword[]; costUsd: number | null }> {
  const task = await postTask(
    "/v3/dataforseo_labs/google/domain_intersection/live",
    {
      target1: params.competitorDomain,
      target2: params.projectDomain,
      location_code: params.locationCode,
      language_code: params.languageCode,
      intersections: false,
      item_types: ["organic"],
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      limit: params.limit,
    },
    "content_gap"
  );
  const resultArr = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const items = Array.isArray(resultArr[0]?.items) ? (resultArr[0]!.items as Array<Record<string, unknown>>) : [];
  const gap: RankedKeyword[] = [];
  for (const raw of items) {
    const k = parseIntersectionItem(raw);
    if (k) gap.push(k);
  }
  return { items: gap, costUsd: typeof task.cost === "number" ? task.cost : null };
}

export { normalizeDomain };
