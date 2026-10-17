// Panorama de un SERP de Google: qué bloques hay, quién ocupa el pack local y el
// snippet destacado y cómo se ve el resultado propio. Todo sale de la MISMA
// respuesta de SERP orgánico que ya pagamos para medir la posición (antes solo
// se miraban los resultados orgánicos y el resto se tiraba). Puro: sin red ni BD.

export type LocalPackBusiness = {
  title: string;
  domain: string | null;
  url: string | null;
  rating: number | null;
  votes: number | null;
  phone: string | null;
  isPaid: boolean;
};

// Cómo aparece NUESTRO resultado orgánico (enriquecimientos de Google).
export type OwnResultInfo = {
  sitelinks: number; // nº de enlaces de sección bajo el resultado
  rating: { value: number | null; votes: number | null } | null; // estrellas en el resultado
  faq: boolean; // desplegables de preguntas frecuentes
  price: boolean;
  breadcrumb: string | null;
  isVideo: boolean;
  isFeatured: boolean; // es el snippet destacado
};

export type SerpPanorama = {
  features: string[]; // tipos de bloque presentes, sin repetir, en orden de aparición
  resultsCount: number | null; // nº de resultados que Google dice tener
  localPack: LocalPackBusiness[];
  featuredSnippet: { domain: string | null; title: string | null; url: string | null } | null;
  peopleAlsoAsk: number; // nº de preguntas del bloque
  own?: OwnResultInfo | null; // solo en chequeos de Rank Tracking
};

type Obj = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parsePanorama(items: Obj[], resultsCount: number | null): SerpPanorama {
  const features: string[] = [];
  for (const it of items) {
    const t = s(it.type);
    if (t && !features.includes(t)) features.push(t);
  }

  const localPack: LocalPackBusiness[] = items
    .filter((it) => it.type === "local_pack")
    .map((it) => {
      const rating = it.rating && typeof it.rating === "object" ? (it.rating as Obj) : null;
      // En el pack local Google pone su propio dominio y un enlace interno del
      // buscador, no la web del negocio: solo valen nombre, valoración y teléfono.
      const dom = s(it.domain);
      return {
        title: s(it.title) ?? "(sin nombre)",
        domain: dom && !dom.includes("google.") ? dom : null,
        url: null,
        rating: n(rating?.value),
        votes: n(rating?.votes_count),
        phone: s(it.phone),
        isPaid: it.is_paid === true,
      };
    });

  const snippet = items.find((it) => it.type === "featured_snippet");
  const paa = items.find((it) => it.type === "people_also_ask");

  return {
    features,
    resultsCount,
    localPack,
    featuredSnippet: snippet ? { domain: s(snippet.domain), title: s(snippet.title), url: s(snippet.url) } : null,
    peopleAlsoAsk: Array.isArray(paa?.items) ? (paa!.items as unknown[]).length : 0,
  };
}

// Extras del mejor resultado orgánico del dominio (menor posición), o null si no aparece.
export function parseOwnResult(items: Obj[], matchesDomain: (domain: string) => boolean): OwnResultInfo | null {
  const own = items
    .filter((it) => it.type === "organic" && typeof it.domain === "string" && matchesDomain(it.domain as string))
    .sort((a, b) => (n(a.rank_absolute) ?? 999) - (n(b.rank_absolute) ?? 999))[0];
  if (!own) return null;
  const rating = own.rating && typeof own.rating === "object" ? (own.rating as Obj) : null;
  return {
    sitelinks: Array.isArray(own.links) ? own.links.length : 0,
    rating: rating ? { value: n(rating.value), votes: n(rating.votes_count) } : null,
    faq: own.faq != null,
    price: own.price != null,
    breadcrumb: s(own.breadcrumb),
    isVideo: own.is_video === true,
    isFeatured: own.is_featured_snippet === true,
  };
}
