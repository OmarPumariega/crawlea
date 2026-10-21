import { fetchKeywordOverview, fetchSearchVolume, type IntentValue } from "@/lib/keywords/dataforseo";
import type { KeywordExtras } from "@/lib/keywords/parse-labs";
import { getFreshCache, upsertCache } from "@/lib/keywords/cache";
import { assertWithinSpendLimit } from "@/lib/dataforseo/spend";
import { keywordOverviewCostUsd, LOCAL_VOLUME_COST_USD } from "@/lib/dataforseo/pricing";
import { isCountryCode } from "@/lib/keywords/countries";

// Orquesta la resolución de datos de keyword combinando caché (primera
// fuente, 30 días) y DataForSEO (solo para lo no cacheado).
//
// Regla de coste: TODAS las keywords pendientes van en una única llamada de
// Keyword Overview (volumen + intención + dificultad + estacionalidad), nunca
// una por keyword: 0,012$ + 0,00012$ por keyword devuelta. Si todo estaba en
// caché, no hay ninguna llamada y se devuelven 0 usageLogs — la prueba de que
// el caché funciona de verdad.

export type KeywordDatum = {
  searchVolume: number | null;
  competition: string | null;
  cpc: number | null;
  intent: IntentValue | null;
  monthlySearches: number[] | null;
  difficulty: number | null;
  extras: KeywordExtras | null;
};

export type UsageLogInput = {
  endpoint: string;
  costUsd: number | null;
};

export async function fetchKeywordData(params: {
  keywords: string[];
  languageCode: string;
  locationCode: number;
  projectId?: string;
}): Promise<{
  data: Map<string, KeywordDatum>;
  usageLogs: UsageLogInput[];
}> {
  const { keywords, languageCode, locationCode, projectId } = params;

  const fresh = await getFreshCache(keywords, languageCode, locationCode);
  const pending = keywords.filter((kw) => !fresh.has(kw));

  const data = new Map<string, KeywordDatum>();
  const usageLogs: UsageLogInput[] = [];

  // 1. Todo lo cacheado se reutiliza sin pagar otra vez.
  for (const kw of keywords) {
    const cached = fresh.get(kw);
    if (cached) {
      data.set(kw, {
        searchVolume: cached.searchVolume,
        competition: cached.competition,
        cpc: cached.cpc,
        intent: cached.intent as IntentValue | null,
        monthlySearches: cached.monthlySearches,
        difficulty: cached.difficulty,
        extras: cached.extras,
      });
    }
  }

  if (pending.length === 0) {
    return { data, usageLogs };
  }

  // Tope de gasto: bloquea ANTES de pagar por keywords nuevas, con el coste
  // real esperado de ESTA llamada (no una tarifa plana). Las cacheadas ya se
  // sirvieron arriba sin coste, así que un estudio 100% cacheado nunca tropieza
  // con el tope (el dato ya se pagó antes).
  // Ubicación local (comunidad, provincia, ciudad): Labs no la admite, el volumen sale de
  // Google Ads (sin dificultad ni intención) a tarifa plana por petición.
  if (!isCountryCode(locationCode)) {
    await assertWithinSpendLimit(projectId, LOCAL_VOLUME_COST_USD);
    const vol = await fetchSearchVolume(pending, locationCode, languageCode);
    for (const kw of pending) {
      const v = vol.byKeyword.get(kw);
      data.set(kw, {
        searchVolume: v?.searchVolume ?? null,
        competition: v?.competition ?? null,
        cpc: v?.cpc ?? null,
        intent: null,
        monthlySearches: v?.monthlySearches ?? null,
        difficulty: null,
        extras: null,
      });
    }
    if (vol.costUsd !== null) usageLogs.push({ endpoint: "modulo1.keywords.volumen-local", costUsd: vol.costUsd });
    await upsertCache(pending, data, languageCode, locationCode);
    return { data, usageLogs };
  }

  await assertWithinSpendLimit(projectId, keywordOverviewCostUsd(pending.length));

  const overview = await fetchKeywordOverview(pending, locationCode, languageCode);

  // Las que Labs no devuelve (long-tail sin datos) quedan "sin dato" y se
  // cachean así: no se vuelven a pagar durante 30 días, y nunca se inventa un volumen.
  for (const kw of pending) {
    const o = overview.byKeyword.get(kw);
    data.set(kw, {
      searchVolume: o?.searchVolume ?? null,
      competition: o?.competition ?? null,
      cpc: o?.cpc ?? null,
      intent: o?.intent ?? null,
      monthlySearches: o?.monthlySearches ?? null,
      difficulty: o?.difficulty ?? null,
      extras: o?.extras ?? null,
    });
  }

  if (overview.costUsd !== null) {
    usageLogs.push({ endpoint: "modulo1.keywords.overview", costUsd: overview.costUsd });
  }

  // Persistir al caché para la próxima vez.
  await upsertCache(pending, data, languageCode, locationCode);

  return { data, usageLogs };
}
