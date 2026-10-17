import { postTask } from "@/lib/dataforseo/client";
import { detectVisibility, type AiSource } from "@/lib/ai-visibility/detect";

// AI Overview de Google por keyword (DataForSEO SERP, orgánico Live Advanced
// con load_async_ai_overview para obtener también los que Google carga de forma
// asíncrona). Es una medición estable y atada a una keyword: o Google muestra
// el AI Overview para esa búsqueda o no, y si lo muestra lista sus fuentes.
// Coste medido ~0,002$ por keyword; se estima a 0,004$ por si el extra
// asíncrono se factura (la propia API lo reembolsa si no aplica).

export const AI_OVERVIEW_EST_COST_USD = 0.004;

type Reference = { source?: string | null; domain?: string | null; url?: string | null; title?: string | null };
type Item = { type?: string; markdown?: string | null; references?: Reference[] | null };

export type AiOverviewResult = {
  hasOverview: boolean;
  cited: boolean;
  citedRank: number | null;
  references: (AiSource & { source: string | null })[];
  excerpt: string | null;
  costUsd: number | null;
};

export async function checkAiOverview(params: {
  keyword: string;
  locationCode: number;
  languageCode: string;
  device: string;
  projectDomain: string;
}): Promise<AiOverviewResult> {
  const task = await postTask(
    "/v3/serp/google/organic/live/advanced",
    {
      keyword: params.keyword,
      location_code: params.locationCode,
      language_code: params.languageCode,
      device: params.device,
      depth: 10,
      load_async_ai_overview: true,
    },
    "serp.ai-overview"
  );
  const result = (Array.isArray(task.result) ? task.result[0] : null) as { items?: Item[] | null } | null;
  const costUsd = typeof task.cost === "number" ? task.cost : null;
  const aio = (result?.items ?? []).find((i) => i.type === "ai_overview");
  if (!aio) {
    return { hasOverview: false, cited: false, citedRank: null, references: [], excerpt: null, costUsd };
  }

  const refs = (aio.references ?? []).filter((r): r is Reference & { url: string } => typeof r.url === "string" && r.url.length > 0);
  const det = detectVisibility({
    answer: aio.markdown ?? "",
    annotations: refs.map((r) => ({ url: r.url, title: r.title ?? null })),
    projectDomain: params.projectDomain,
    brandNames: [],
  });
  const sourceByUrl = new Map(refs.map((r) => [r.url, r.source ?? null]));
  return {
    hasOverview: true,
    cited: det.cited,
    citedRank: det.citedRank,
    references: det.sources.map((s) => ({ ...s, source: sourceByUrl.get(s.url) ?? null })),
    // Se quitan los marcadores de cita [[1]](url) del inicio del texto.
    excerpt: (aio.markdown ?? "").replace(/\[\[\d+\]\]\([^)]*\)/g, "").slice(0, 600) || null,
    costUsd,
  };
}
