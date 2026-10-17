// Utilidades puras (sin red ni BD) para leer respuestas de DataForSEO Labs. Las
// comparten Keywords y Competidores: antes cada módulo tenía su copia y la de
// Competidores no entendía el formato de Labs (estacionalidad, competición y
// posición media llegaban siempre vacías).

export type Competition = "HIGH" | "MEDIUM" | "LOW";
// "informacional" | "mixta" | "transaccional" — vocabulario de 3 buckets del proyecto.
export type IntentValue = "informacional" | "mixta" | "transaccional";

export function isCompetition(v: unknown): v is Competition {
  return v === "HIGH" || v === "MEDIUM" || v === "LOW";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Aplana monthly_searches a number[] ordenado cronológicamente (más antiguo →
// más reciente) y se queda con los ÚLTIMOS 12 meses. Acepta los dos formatos de
// DataForSEO: Keywords Data ({year, month, searches}) y Labs ({year, month,
// search_volume}, con hasta ~100 meses de histórico). Antes solo entendía el
// primero, así que la estacionalidad de las sugerencias (Labs) llegaba siempre
// vacía. Devuelve null si no viene. Exportado para suggestions.ts.
export function flattenMonthlySearches(
  ms: unknown
): number[] | null {
  if (!Array.isArray(ms) || ms.length === 0) return null;
  const valueOf = (m: Record<string, unknown>): number | null =>
    typeof m.searches === "number" ? m.searches : typeof m.search_volume === "number" ? m.search_volume : null;
  const sorted = (ms as Record<string, unknown>[])
    .filter((m) => !!m && typeof m.year === "number" && typeof m.month === "number" && valueOf(m) !== null)
    .sort((a, b) => (a.year as number) * 12 + (a.month as number) - ((b.year as number) * 12 + (b.month as number)));
  if (sorted.length === 0) return null;
  return sorted.slice(-12).map((m) => valueOf(m) as number);
}


// Mapea los 4 labels de intención de DataForSEO al vocabulario de 3 buckets.
// Navigational y commercial son ambos "intermedios" → se agrupan como mixta.
export function mapIntent(label: string | undefined | null): IntentValue | null {
  switch (label) {
    case "informational":
      return "informacional";
    case "transactional":
      return "transaccional";
    case "navigational":
    case "commercial":
      return "mixta";
    default:
      return null;
  }
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Resto de métricas que Labs devuelve junto al volumen (mismo ítem ya pagado) y
// que antes se tiraban: puja de Google Ads, tendencia, índice de competición,
// y cuántos enlaces tienen de media las páginas que posicionan ("para competir").
export type KeywordExtras = {
  bidLow: number | null; // puja baja primera página (€)
  bidHigh: number | null;
  competitionIndex: number | null; // 0-100
  trend: { monthly: number | null; quarterly: number | null; yearly: number | null } | null; // % de variación
  backlinksNeeded: {
    backlinks: number | null;
    referringDomains: number | null;
    referringMainDomains: number | null;
    pageRank: number | null;
    domainRank: number | null;
  } | null;
  categories: number[] | null;
  coreKeyword: string | null;
  wordsCount: number | null;
};

export function parseKeywordExtras(item: Record<string, unknown>): KeywordExtras {
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const ki = obj(item.keyword_info);
  const kp = obj(item.keyword_properties);
  const ab = item.avg_backlinks_info ? obj(item.avg_backlinks_info) : null;
  const tr = ki.search_volume_trend ? obj(ki.search_volume_trend) : null;
  const comp = num(ki.competition);
  return {
    bidLow: num(ki.low_top_of_page_bid) != null ? round2(num(ki.low_top_of_page_bid) as number) : null,
    bidHigh: num(ki.high_top_of_page_bid) != null ? round2(num(ki.high_top_of_page_bid) as number) : null,
    competitionIndex: comp != null ? Math.round(comp * 100) : null,
    trend: tr ? { monthly: num(tr.monthly), quarterly: num(tr.quarterly), yearly: num(tr.yearly) } : null,
    backlinksNeeded: ab
      ? {
          backlinks: num(ab.backlinks),
          referringDomains: num(ab.referring_domains),
          referringMainDomains: num(ab.referring_main_domains),
          pageRank: num(ab.rank),
          domainRank: num(ab.main_domain_rank),
        }
      : null,
    categories: Array.isArray(ki.categories) && ki.categories.length > 0 ? (ki.categories as number[]) : null,
    coreKeyword: str(kp.core_keyword),
    wordsCount: num(kp.words_count),
  };
}
