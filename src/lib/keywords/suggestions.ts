import { postTask } from "@/lib/dataforseo/client";
import { mapIntent, flattenMonthlySearches, type IntentValue, type Competition } from "@/lib/keywords/dataforseo";
import { parseKeywordExtras, type KeywordExtras } from "@/lib/keywords/parse-labs";
import { upsertCache } from "@/lib/keywords/cache";
import { normalizeKeyword } from "@/lib/keywords/normalize";
import { isCountryCode } from "@/lib/keywords/countries";

// Sugerencias de keywords (Módulo 1, modo Planificador). A partir de una
// keyword semilla, DataForSEO Labs devuelve keywords relacionadas con sus
// métricas completas ya incluidas (keyword_info + search_intent_info), así que
// aquí NO hace falta llamar aparte a volumen ni a intención — vienen en cada
// item. Las métricas se cachean en KeywordDataCache al traerlas, de modo que
// añadir una sugerencia al estudio después sea instantáneo y gratis (cache hit).

export type Suggestion = {
  keyword: string;
  searchVolume: number | null;
  competition: Competition | null;
  cpc: number | null;
  intent: IntentValue | null;
  // keyword_properties.keyword_difficulty (0-100) — dificultad SEO real, ya
  // venía en la misma respuesta y no se leía (mismo hueco que tenía
  // Competidores). monthlySearches también venía y se calculaba solo para
  // calentar el caché, nunca llegaba a la UI — ahora sí.
  difficulty: number | null;
  monthlySearches: number[] | null;
  extras: KeywordExtras; // puja, tendencia, enlaces para competir...
};

function isLevel(v: unknown): v is Competition {
  return v === "HIGH" || v === "MEDIUM" || v === "LOW";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function fetchSuggestions(params: {
  seed: string;
  locationCode: number;
  languageCode: string;
  limit: number;
}): Promise<{ items: Suggestion[]; costUsd: number | null }> {
  const { seed, locationCode, languageCode, limit } = params;

  // Comunidad, provincia o ciudad: Labs solo admite países, así que el volumen local sale de
  // Google Ads (sin dificultad ni intención, que Google Ads no da).
  if (!isCountryCode(locationCode)) return fetchLocalSuggestions(params);

  const task = await postTask(
    "/v3/dataforseo_labs/google/keyword_suggestions/live",
    { keyword: seed, location_code: locationCode, language_code: languageCode, limit },
    "sugerencias"
  );

  const resultArr = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const rawItems = Array.isArray(resultArr[0]?.items) ? (resultArr[0]!.items as Array<Record<string, unknown>>) : [];

  const items: Suggestion[] = [];
  const cacheData = new Map<string, { searchVolume: number | null; competition: string | null; cpc: number | null; intent: string | null; monthlySearches: number[] | null; difficulty: number | null; extras: KeywordExtras }>();

  for (const item of rawItems) {
    const rawKw = typeof item.keyword === "string" ? item.keyword : null;
    if (!rawKw) continue;
    // Normalizada igual que el resto de escrituras en KeywordDataCache — si
    // no, una keyword con distinto casing/espaciado al que produce
    // normalizeKeyword() queda huérfana en caché y se paga de nuevo en el
    // siguiente lookup (pegar lista, resolver).
    const kw = normalizeKeyword(rawKw);
    const ki = (item.keyword_info ?? {}) as Record<string, unknown>;
    const kp = (item.keyword_properties ?? {}) as Record<string, unknown>;
    const si = (item.search_intent_info ?? {}) as Record<string, unknown>;
    const intent = mapIntent(typeof si.main_intent === "string" ? si.main_intent : undefined);
    // monthly_searches también viene en keyword_info del endpoint de
    // sugerencias — se aprovecha igual que en search_volume (gratis).
    const monthlySearches = flattenMonthlySearches(ki.monthly_searches);
    const suggestion: Suggestion = {
      keyword: kw,
      searchVolume: typeof ki.search_volume === "number" ? ki.search_volume : null,
      competition: isLevel(ki.competition_level) ? ki.competition_level : null,
      cpc: typeof ki.cpc === "number" ? round2(ki.cpc) : null,
      intent,
      difficulty: typeof kp.keyword_difficulty === "number" ? kp.keyword_difficulty : null,
      monthlySearches,
      extras: parseKeywordExtras(item),
    };
    items.push(suggestion);
    cacheData.set(kw, {
      searchVolume: suggestion.searchVolume,
      competition: suggestion.competition,
      cpc: suggestion.cpc,
      intent,
      monthlySearches,
      difficulty: suggestion.difficulty,
      extras: suggestion.extras,
    });
  }

  // Calienta el caché: al añadir estas keywords al estudio después, serán
  // cache hit (gratis) y consistente con lo que vio el usuario en sugerencias.
  if (items.length > 0) {
    await upsertCache(
      items.map((i) => i.keyword),
      cacheData,
      languageCode,
      locationCode
    );
  }

  return { items, costUsd: typeof task.cost === "number" ? task.cost : null };
}

// Sugerencias con volumen LOCAL (Google Ads, keywords_for_keywords). Una sola petición de tarifa
// plana; se piden ordenadas por volumen y nos quedamos con las `limit` primeras. Los campos que
// Google Ads no tiene (dificultad SEO, intención) quedan a null — nunca se rellenan con otra cosa.
async function fetchLocalSuggestions(params: {
  seed: string;
  locationCode: number;
  languageCode: string;
  limit: number;
}): Promise<{ items: Suggestion[]; costUsd: number | null }> {
  const { seed, locationCode, languageCode, limit } = params;
  const task = await postTask(
    "/v3/keywords_data/google_ads/keywords_for_keywords/live",
    { keywords: [seed], location_code: locationCode, language_code: languageCode, sort_by: "search_volume" },
    "sugerencias-locales"
  );
  const raw = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const items: Suggestion[] = [];
  const cacheData = new Map<string, { searchVolume: number | null; competition: string | null; cpc: number | null; intent: string | null; monthlySearches: number[] | null; difficulty: number | null; extras: KeywordExtras }>();
  for (const item of raw) {
    const rawKw = typeof item.keyword === "string" ? item.keyword : null;
    if (!rawKw) continue;
    const kw = normalizeKeyword(rawKw);
    if (items.some((i) => i.keyword === kw)) continue;
    const volume = typeof item.search_volume === "number" ? item.search_volume : null;
    // Sin volumen en esa ubicación no es una sugerencia útil (Google Ads devuelve miles de
    // términos sin dato local).
    if (volume === null || volume <= 0) continue;
    const bid = (v: unknown) => (typeof v === "number" ? round2(v) : null);
    const suggestion: Suggestion = {
      keyword: kw,
      searchVolume: volume,
      competition: isLevel(item.competition) ? item.competition : null,
      cpc: typeof item.cpc === "number" ? round2(item.cpc) : null,
      intent: null,
      difficulty: null,
      monthlySearches: flattenMonthlySearches(item.monthly_searches),
      extras: {
        bidLow: bid(item.low_top_of_page_bid),
        bidHigh: bid(item.high_top_of_page_bid),
        competitionIndex: typeof item.competition_index === "number" ? item.competition_index : null,
        trend: null,
        backlinksNeeded: null,
        categories: Array.isArray(item.categories) && item.categories.length > 0 ? (item.categories as number[]) : null,
        coreKeyword: null,
        wordsCount: null,
      },
    };
    items.push(suggestion);
    if (items.length >= limit) break;
  }
  for (const s of items) {
    cacheData.set(s.keyword, {
      searchVolume: s.searchVolume,
      competition: s.competition,
      cpc: s.cpc,
      intent: null,
      monthlySearches: s.monthlySearches,
      difficulty: null,
      extras: s.extras,
    });
  }
  if (items.length > 0) {
    await upsertCache(items.map((i) => i.keyword), cacheData, languageCode, locationCode);
  }
  return { items, costUsd: typeof task.cost === "number" ? task.cost : null };
}
