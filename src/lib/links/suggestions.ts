import { normalizeUrl } from "@/lib/seo/normalize-url";
import type { LinkNode } from "@/lib/links/pagerank";

// Sugerencias de enlazado interno — 100% determinista y sin coste de API.
// Cruza tres datos reales que Crawlea ya tiene: el grafo de enlaces del último
// rastreo, los títulos/H1/meta de cada página y las posiciones del Rank
// Tracking. No inventa nada: la "relación temática" se mide como términos que
// la página de origen comparte con la keyword/título de destino, y si no hay
// ninguna página relacionada lo dice (related=false) en vez de forzarlo.

export type SuggestionPage = {
  url: string;
  title: string | null;
  h1Text: string | null;
  metaDescription: string | null;
  statusCode: number | null;
  isRedirect: boolean;
  metaRobots: string | null;
};

export type TrackedUrl = { url: string; keyword: string; position: number | null };

export type SuggestionReason = "opportunity" | "orphan" | "weak";

export type LinkSuggestion = {
  target: {
    url: string;
    title: string | null;
    incoming: number;
    pagerank: number;
    keyword: string | null;
    position: number | null;
  };
  reason: SuggestionReason;
  anchor: string;
  sources: {
    url: string;
    title: string | null;
    pagerank: number;
    sharedTerms: string[];
    related: boolean;
  }[];
};

const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas", "en", "y", "o", "a", "al",
  "con", "por", "para", "que", "su", "sus", "se", "es", "lo", "como", "mas", "más", "the", "and",
  "for", "of", "to", "in", "tu", "tus", "mi", "nuestro", "nuestros", "sobre", "entre",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// Quita el nombre del sitio del final del título ("Servicio | Marca" → "Servicio").
function cleanTitle(title: string | null): string | null {
  if (!title) return null;
  const t = title.split(/\s[|–—-]\s/)[0].trim();
  return t || title.trim();
}

const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|gif|webp|svg|mp4|mp3|xml|txt)(\?.*)?$/i;

function isIndexable(p: SuggestionPage): boolean {
  // Solo páginas HTML con contenido propio: ni ficheros (PDF, imágenes...) ni
  // URLs sin título/H1 (no se les puede insertar un enlace ni medir su tema).
  if (FILE_EXT.test(p.url) || (!p.title && !p.h1Text)) return false;
  if (p.statusCode !== 200 || p.isRedirect) return false;
  return !(p.metaRobots ?? "").toLowerCase().includes("noindex");
}

const MAX_TARGETS = 30;
const MAX_SOURCES = 3;

export function computeLinkSuggestions(input: {
  graph: LinkNode[];
  pages: SuggestionPage[];
  pagerank: Map<string, number>;
  tracked: TrackedUrl[];
}): LinkSuggestion[] {
  const { graph, pages, pagerank, tracked } = input;

  const pageByUrl = new Map(pages.map((p) => [p.url, p]));
  const nodeSet = new Set(graph.map((g) => g.url));

  const outgoing = new Map<string, Set<string>>();
  const incomingCount = new Map<string, number>();
  for (const entry of graph) {
    const targets = new Set<string>();
    for (const l of entry.links) if (l !== entry.url && nodeSet.has(l)) targets.add(l);
    outgoing.set(entry.url, targets);
    for (const t of targets) incomingCount.set(t, (incomingCount.get(t) ?? 0) + 1);
  }

  // Mejor keyword en seguimiento por URL (la de mejor posición).
  const bestByUrl = new Map<string, TrackedUrl>();
  for (const t of tracked) {
    const n = normalizeUrl(t.url);
    if (!n || !nodeSet.has(n)) continue;
    const cur = bestByUrl.get(n);
    if (!cur || (t.position ?? 999) < (cur.position ?? 999)) bestByUrl.set(n, { ...t, url: n });
  }

  type Candidate = { url: string; reason: SuggestionReason; priority: number };
  const candidates: Candidate[] = [];
  for (const [url, page] of pageByUrl) {
    if (!nodeSet.has(url) || !isIndexable(page)) continue;
    const incoming = incomingCount.get(url) ?? 0;
    const tr = bestByUrl.get(url);
    if (tr && tr.position !== null && tr.position >= 4 && tr.position <= 30) {
      // Cuanto más cerca de la primera página, más rentable empujarla.
      candidates.push({ url, reason: "opportunity", priority: 1000 - tr.position });
    } else if (incoming === 0) {
      candidates.push({ url, reason: "orphan", priority: 500 });
    } else if (incoming === 1) {
      candidates.push({ url, reason: "weak", priority: 100 });
    }
  }
  candidates.sort((a, b) => b.priority - a.priority);

  const sourcePool = [...pageByUrl.values()]
    .filter((p) => nodeSet.has(p.url) && isIndexable(p))
    .map((p) => ({
      page: p,
      pr: pagerank.get(p.url) ?? 0,
      terms: new Set(tokens([p.title, p.h1Text, p.metaDescription].filter(Boolean).join(" "))),
    }));

  const suggestions: LinkSuggestion[] = [];
  for (const cand of candidates.slice(0, MAX_TARGETS)) {
    const page = pageByUrl.get(cand.url)!;
    const tr = bestByUrl.get(cand.url) ?? null;
    const anchor = tr?.keyword ?? page.h1Text?.trim() ?? cleanTitle(page.title) ?? cand.url;
    const targetTerms = [...new Set(tokens(tr?.keyword ?? `${page.h1Text ?? ""} ${cleanTitle(page.title) ?? ""}`))];
    if (targetTerms.length === 0) continue;

    const scored = sourcePool
      .filter((s) => s.page.url !== cand.url && !outgoing.get(s.page.url)?.has(cand.url))
      .map((s) => {
        const shared = targetTerms.filter((t) => s.terms.has(t));
        return { s, shared, ratio: shared.length / targetTerms.length };
      })
      .filter((x) => x.shared.length > 0 && x.ratio >= 0.34)
      .sort((a, b) => b.ratio - a.ratio || b.s.pr - a.s.pr)
      .slice(0, MAX_SOURCES);

    let sources: LinkSuggestion["sources"];
    if (scored.length > 0) {
      sources = scored.map(({ s, shared }) => ({
        url: s.page.url,
        title: cleanTitle(s.page.title),
        pagerank: s.pr,
        sharedTerms: shared,
        related: true,
      }));
    } else {
      // Sin ninguna página relacionada por título/H1/meta: se ofrecen las de
      // más fuerza, marcadas como "sin relación temática detectada".
      sources = sourcePool
        .filter((s) => s.page.url !== cand.url && !outgoing.get(s.page.url)?.has(cand.url))
        .sort((a, b) => b.pr - a.pr)
        .slice(0, 2)
        .map((s) => ({
          url: s.page.url,
          title: cleanTitle(s.page.title),
          pagerank: s.pr,
          sharedTerms: [],
          related: false,
        }));
    }
    if (sources.length === 0) continue;

    suggestions.push({
      target: {
        url: cand.url,
        title: cleanTitle(page.title),
        incoming: incomingCount.get(cand.url) ?? 0,
        pagerank: pagerank.get(cand.url) ?? 0,
        keyword: tr?.keyword ?? null,
        position: tr?.position ?? null,
      },
      reason: cand.reason,
      anchor,
      sources,
    });
  }
  return suggestions;
}
