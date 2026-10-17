// Cliente de DataForSEO (Módulo 1 — Keyword Research). Auth HTTP Basic con
// el login/password de la cuenta de la plataforma. Se usan dos endpoints:
//
//   • Volumen/competición/CPC → keywords_data/google_ads/search_volume/live
//     (Keywords Data API; la mejor fuente para mirar un lote de keywords ya
//      conocidas, hasta 1000 por llamada plana).
//   • Intención de búsqueda  → dataforseo_labs/google/search_intent/live
//     (DataForSEO Labs; no acepta ubicación, solo idioma obligatorio).
//
// Principio del proyecto: nada se inventa. Toda métrica proviene de la
// respuesta real de DataForSEO; si la llamada falla se lanza DataForSeoError
// con el status_message real de la API, nunca un dato fabricado.

import {
  DataForSeoError,
  postTask,
} from "@/lib/dataforseo/client";
import {
  flattenMonthlySearches,
  isCompetition,
  mapIntent,
  round2,
  parseKeywordExtras,
  type KeywordExtras,
  type Competition,
  type IntentValue,
} from "@/lib/keywords/parse-labs";

export { DataForSeoError, flattenMonthlySearches, mapIntent };
export type { Competition, IntentValue, KeywordExtras };


export type KeywordVolume = {
  searchVolume: number | null;
  competition: Competition | null;
  cpc: number | null;
  // Estacionalidad (12 meses, orden cronológico ascendente). Llega gratis en
  // la misma respuesta de search_volume (campo monthly_searches); antes se
  // tiraba. Null si DataForSEO no la devuelve para esa keyword.
  monthlySearches: number[] | null;
};

export type VolumeResult = {
  byKeyword: Map<string, KeywordVolume>;
  costUsd: number | null;
};

export type IntentResult = {
  byKeyword: Map<string, IntentValue | null>;
  costUsd: number | null;
};


// Volumen de búsqueda + competición + CPC. `result` es un ARRAY con un
// elemento por keyword pedida (las que no tienen dato llegan con sus campos
// a null, no se omiten). Coste leído del campo real `tasks[0].cost`.
export async function fetchSearchVolume(
  keywords: string[],
  locationCode: number,
  languageCode: string
): Promise<VolumeResult> {
  const task = await postTask(
    "/v3/keywords_data/google_ads/search_volume/live",
    { keywords, location_code: locationCode, language_code: languageCode },
    "volumen"
  );

  const result = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const byKeyword = new Map<string, KeywordVolume>();

  for (const item of result) {
    const kw = typeof item.keyword === "string" ? item.keyword : null;
    if (!kw) continue;
    byKeyword.set(kw, {
      searchVolume: typeof item.search_volume === "number" ? item.search_volume : null,
      competition: isCompetition(item.competition) ? item.competition : null,
      cpc: typeof item.cpc === "number" ? round2(item.cpc) : null,
      monthlySearches: flattenMonthlySearches(item.monthly_searches),
    });
  }

  return { byKeyword, costUsd: typeof task.cost === "number" ? task.cost : null };
}

// Keyword Overview (DataForSEO Labs): volumen, competición, CPC, estacionalidad,
// dificultad SEO e intención de un lote de keywords en UNA llamada (hasta 700).
// Sustituye a search_volume (tarifa plana de 0,09$) + search_intent: unas 5 veces
// más barato con 50 keywords y, además, trae la dificultad. Las keywords sin dato
// en Labs (muy long-tail) NO se devuelven ni se cobran: llegan como "sin dato".
export type OverviewDatum = KeywordVolume & {
  intent: IntentValue | null;
  difficulty: number | null;
  extras: KeywordExtras;
};

const OVERVIEW_MAX_PER_CALL = 700;

export async function fetchKeywordOverview(
  keywords: string[],
  locationCode: number,
  languageCode: string
): Promise<{ byKeyword: Map<string, OverviewDatum>; costUsd: number | null }> {
  const byKeyword = new Map<string, OverviewDatum>();
  let cost = 0;
  let anyCost = false;

  for (let i = 0; i < keywords.length; i += OVERVIEW_MAX_PER_CALL) {
    const chunk = keywords.slice(i, i + OVERVIEW_MAX_PER_CALL);
    const task = await postTask(
      "/v3/dataforseo_labs/google/keyword_overview/live",
      { keywords: chunk, location_code: locationCode, language_code: languageCode },
      "keyword-overview"
    );
    const resultArr = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
    const items = Array.isArray(resultArr[0]?.items) ? (resultArr[0]!.items as Array<Record<string, unknown>>) : [];
    for (const item of items) {
      const kw = typeof item.keyword === "string" ? item.keyword : null;
      if (!kw) continue;
      const ki = (item.keyword_info ?? {}) as Record<string, unknown>;
      const kp = (item.keyword_properties ?? {}) as Record<string, unknown>;
      const si = (item.search_intent_info ?? {}) as Record<string, unknown>;
      byKeyword.set(kw, {
        searchVolume: typeof ki.search_volume === "number" ? ki.search_volume : null,
        competition: isCompetition(ki.competition_level) ? ki.competition_level : null,
        cpc: typeof ki.cpc === "number" ? round2(ki.cpc) : null,
        monthlySearches: flattenMonthlySearches(ki.monthly_searches),
        intent: mapIntent(typeof si.main_intent === "string" ? si.main_intent : undefined),
        difficulty: typeof kp.keyword_difficulty === "number" ? kp.keyword_difficulty : null,
        extras: parseKeywordExtras(item),
      });
    }
    if (typeof task.cost === "number") {
      cost += task.cost;
      anyCost = true;
    }
  }
  return { byKeyword, costUsd: anyCost ? cost : null };
}

// Intención de búsqueda. Aquí la estructura es más profunda:
// `tasks[0].result[0].items[i]`, y cada item trae `keyword_intent.label`
// (informational | navigational | commercial | transactional). El endpoint
// no admite ubicación, solo idioma (obligatorio).
export async function fetchSearchIntent(
  keywords: string[],
  languageCode: string
): Promise<IntentResult> {
  const task = await postTask(
    "/v3/dataforseo_labs/google/search_intent/live",
    { keywords, language_code: languageCode },
    "intención"
  );

  const resultArr = Array.isArray(task.result) ? (task.result as Array<Record<string, unknown>>) : [];
  const resultObj = resultArr[0] ?? {};
  const items = Array.isArray(resultObj.items) ? (resultObj.items as Array<Record<string, unknown>>) : [];
  const byKeyword = new Map<string, IntentValue | null>();

  for (const item of items) {
    const kw = typeof item.keyword === "string" ? item.keyword : null;
    if (!kw) continue;
    const intentObj = item.keyword_intent as { label?: string } | undefined;
    byKeyword.set(kw, mapIntent(intentObj?.label));
  }

  return { byKeyword, costUsd: typeof task.cost === "number" ? task.cost : null };
}

