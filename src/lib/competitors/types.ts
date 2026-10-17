// Tipos de Competidores compartidos entre servidor y cliente (sin imports de
// servidor). Todo sale de las respuestas reales de DataForSEO Labs.

export type PositionBuckets = {
  top3: number; // pos_1 + pos_2_3
  top10: number; // pos_4_10
  top100: number; // resto (pos_11_20 ... pos_91_100)
};

// Movimiento de posiciones del dominio respecto a la medición anterior de Labs.
export type DomainMovement = { new: number; up: number; down: number; lost: number };

// Presencia de pago del dominio (anuncios en Google).
export type PaidMetrics = { keywords: number | null; traffic: number | null; cost: number | null };

export type DomainOverview = {
  organicTraffic: number | null; // metrics.organic.etv
  organicKeywords: number | null; // metrics.organic.count
  positionBuckets: PositionBuckets | null;
  // Valor del tráfico: lo que costaría ese tráfico comprándolo en Google Ads
  // (metrics.organic.estimated_paid_traffic_cost).
  trafficValue: number | null;
  movement: DomainMovement | null;
  paid: PaidMetrics | null;
};

// Backlinks y dominios que, de media, tienen las páginas que ya posicionan para
// una keyword (keyword_data.avg_backlinks_info): lo que hace falta para competir.
export type BacklinksNeeded = {
  backlinks: number | null;
  referringDomains: number | null;
  referringMainDomains: number | null;
  dofollow: number | null;
  mainDomainRank: number | null; // autoridad media de los dominios del top
};

export type RankMovement = { previous: number | null; isNew: boolean; isUp: boolean; isDown: boolean };

export type SearchTrend = { monthly: number | null; quarterly: number | null; yearly: number | null };

// Keyword de un dominio (visibilidad o content gap). Los campos posteriores a
// `description` son los que antes se pagaban y se tiraban.
export type RankedKeyword = {
  keyword: string;
  position: number | null;
  volume: number | null;
  competition: string | null; // HIGH | MEDIUM | LOW (Google Ads — NO es dificultad SEO)
  competitionIndex: number | null; // 0-100 (Google Ads)
  cpc: number | null;
  monthlySearches: number[] | null; // últimos 12 meses
  difficulty: number | null; // 0-100, dificultad SEO real
  title: string | null;
  url: string | null;
  description: string | null;
  // --- ampliación ---
  etv?: number | null; // tráfico estimado que recibe el dominio por ESTA keyword
  trafficValue?: number | null; // valor de ese tráfico en Google Ads
  intent?: string | null; // informacional | mixta | transaccional
  trend?: SearchTrend | null; // variación del volumen de búsqueda (%)
  bidLow?: number | null; // puja baja / alta de la parte superior de la página
  bidHigh?: number | null;
  backlinksNeeded?: BacklinksNeeded | null;
  pageLinks?: { backlinks: number | null; referringDomains: number | null } | null; // de la URL que posiciona
  pageRank?: number | null; // autoridad de esa página (0-1000)
  domainRank?: number | null; // autoridad del dominio
  movement?: RankMovement | null;
  isLost?: boolean;
  serpFeatures?: string[] | null; // bloques que hay en ese SERP (people_also_ask, local_pack…)
  serpResults?: number | null; // nº de resultados del SERP
};
