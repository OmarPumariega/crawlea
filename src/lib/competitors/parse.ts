import { flattenMonthlySearches, mapIntent, num, str, round2, type Competition } from "../keywords/parse-labs";
import type { DomainOverview, DomainMovement, PaidMetrics, PositionBuckets, RankedKeyword, BacklinksNeeded } from "./types";

// Lectura de las respuestas de DataForSEO Labs para Competidores. Puro (sin red
// ni BD) para poder probarlo con respuestas reales guardadas.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

function buckets(o: Obj | undefined): PositionBuckets | null {
  if (!o) return null;
  const n = (k: string) => (typeof o[k] === "number" ? (o[k] as number) : 0);
  if (o.pos_1 == null && o.pos_2_3 == null && o.pos_4_10 == null && o.pos_11_20 == null) return null;
  return {
    top3: n("pos_1") + n("pos_2_3"),
    top10: n("pos_4_10"),
    top100: ["pos_11_20", "pos_21_30", "pos_31_40", "pos_41_50", "pos_51_60", "pos_61_70", "pos_71_80", "pos_81_90", "pos_91_100"].reduce((s, k) => s + n(k), 0),
  };
}

function movement(o: Obj | undefined): DomainMovement | null {
  if (!o || (o.is_new == null && o.is_up == null && o.is_down == null && o.is_lost == null)) return null;
  return { new: num(o.is_new) ?? 0, up: num(o.is_up) ?? 0, down: num(o.is_down) ?? 0, lost: num(o.is_lost) ?? 0 };
}

function paid(o: Obj | undefined): PaidMetrics | null {
  if (!o) return null;
  const keywords = num(o.count);
  if (!keywords) return null; // sin anuncios: no se muestra
  return { keywords, traffic: num(o.etv), cost: num(o.estimated_paid_traffic_cost) };
}

// domain_rank_overview → items[0].metrics
export function parseDomainOverview(item: Obj | null | undefined): DomainOverview {
  const metrics = obj(item?.metrics);
  const organic = obj(metrics?.organic);
  return {
    organicTraffic: num(organic?.etv),
    organicKeywords: num(organic?.count),
    positionBuckets: buckets(organic),
    trafficValue: num(organic?.estimated_paid_traffic_cost),
    movement: movement(organic),
    paid: paid(obj(metrics?.paid)),
  };
}

function backlinksNeeded(o: Obj | undefined): BacklinksNeeded | null {
  if (!o) return null;
  const r: BacklinksNeeded = {
    backlinks: num(o.backlinks),
    referringDomains: num(o.referring_domains),
    referringMainDomains: num(o.referring_main_domains),
    dofollow: num(o.dofollow),
    mainDomainRank: num(o.main_domain_rank),
  };
  return Object.values(r).every((v) => v === null) ? null : r;
}

// Lee un item de ranked_keywords o de domain_intersection: la información de la
// keyword vive en `keyword_data` y la del resultado del dominio en `serp`.
function parseKeywordItem(raw: Obj, serp: Obj | undefined, serpInfo: Obj | undefined): RankedKeyword | null {
  const kd = obj(raw.keyword_data);
  const keyword = str(kd?.keyword);
  if (!kd || !keyword) return null;
  const ki = obj(kd.keyword_info);
  const kp = obj(kd.keyword_properties);
  const si = obj(kd.search_intent_info);
  const trend = obj(ki?.search_volume_trend);
  const rankChanges = obj(serp?.rank_changes);
  const rankInfo = obj(serp?.rank_info);
  const bl = obj(serp?.backlinks_info);
  const compLevel = str(ki?.competition_level);
  const compNum = num(ki?.competition);
  const features = Array.isArray(serpInfo?.serp_item_types) ? (serpInfo!.serp_item_types as unknown[]).filter((x): x is string => typeof x === "string") : null;
  return {
    keyword,
    position: num(serp?.rank_absolute),
    volume: num(ki?.search_volume),
    // Labs da competition_level (texto) y competition (0-1); antes se leían como
    // texto/competition_index y llegaban siempre vacíos.
    competition: compLevel as Competition | null,
    competitionIndex: compNum !== null ? Math.round(compNum * 100) : null,
    cpc: num(ki?.cpc),
    monthlySearches: flattenMonthlySearches(ki?.monthly_searches),
    difficulty: num(kp?.keyword_difficulty),
    title: str(serp?.title),
    url: str(serp?.url),
    description: str(serp?.description),
    etv: num(serp?.etv),
    trafficValue: num(serp?.estimated_paid_traffic_cost),
    intent: mapIntent(str(si?.main_intent)),
    trend: trend ? { monthly: num(trend.monthly), quarterly: num(trend.quarterly), yearly: num(trend.yearly) } : null,
    bidLow: num(ki?.low_top_of_page_bid) !== null ? round2(num(ki?.low_top_of_page_bid) as number) : null,
    bidHigh: num(ki?.high_top_of_page_bid) !== null ? round2(num(ki?.high_top_of_page_bid) as number) : null,
    backlinksNeeded: backlinksNeeded(obj(kd.avg_backlinks_info)),
    pageLinks: bl ? { backlinks: num(bl.backlinks), referringDomains: num(bl.referring_domains) } : null,
    pageRank: num(rankInfo?.page_rank),
    domainRank: num(rankInfo?.main_domain_rank),
    movement: rankChanges
      ? { previous: num(rankChanges.previous_rank_absolute), isNew: rankChanges.is_new === true, isUp: rankChanges.is_up === true, isDown: rankChanges.is_down === true }
      : null,
    isLost: false,
    serpFeatures: features && features.length > 0 ? features : null,
    serpResults: num(serpInfo?.se_results_count),
  };
}

export function parseRankedItem(raw: Obj): RankedKeyword | null {
  const el = obj(raw.ranked_serp_element);
  const k = parseKeywordItem(raw, obj(el?.serp_item), obj(obj(raw.keyword_data)?.serp_info) ?? (el ? { serp_item_types: el.serp_item_types, se_results_count: el.se_results_count } : undefined));
  if (k && el?.is_lost === true) k.isLost = true;
  return k;
}

export function parseIntersectionItem(raw: Obj): RankedKeyword | null {
  return parseKeywordItem(raw, obj(raw.first_domain_serp_element), obj(obj(raw.keyword_data)?.serp_info));
}
