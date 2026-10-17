// Parsers puros del API de Backlinks de DataForSEO (sin imports de la app, para
// poder probarlos en node contra respuestas reales). Todo lo que devuelve el
// summary ya se paga: se guarda entero en `BacklinkSnapshot.profile`.

export type Dist = { key: string; count: number }[];

export type BacklinkProfile = {
  firstSeen: string | null;
  spamScore: number | null; // backlinks_spam_score del dominio, 0-100
  crawledPages: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  brokenPages: number | null;
  referringIps: number | null;
  referringSubnets: number | null;
  referringPages: number | null;
  referringPagesNofollow: number | null;
  referringDomainsNofollow: number | null;
  site: {
    server: string | null;
    cms: string | null;
    platformType: string[] | null;
    ip: string | null;
    country: string | null;
  };
  tld: Dist;
  countries: Dist;
  platformTypes: Dist;
  attributes: Dist;
  linkTypes: Dist;
  semanticLocations: Dist;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

// {"com": 35, "": 47} → [{key:"com",count:35}, ...] ordenado desc, sin clave vacía
// (la API usa "" para "sin dato"; se suma aparte como "unknown" no se inventa).
export function toDist(obj: unknown): Dist {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>)
    .filter(([k, v]) => k !== "" && typeof v === "number")
    .map(([key, count]) => ({ key, count: count as number }))
    .sort((a, b) => b.count - a.count);
}

export function parseBacklinkProfile(item: Record<string, unknown>): BacklinkProfile {
  const info = (item.info ?? {}) as Record<string, unknown>;
  return {
    firstSeen: str(item.first_seen),
    spamScore: num(item.backlinks_spam_score),
    crawledPages: num(item.crawled_pages),
    internalLinks: num(item.internal_links_count),
    externalLinks: num(item.external_links_count),
    brokenPages: num(item.broken_pages),
    referringIps: num(item.referring_ips),
    referringSubnets: num(item.referring_subnets),
    referringPages: num(item.referring_pages),
    referringPagesNofollow: num(item.referring_pages_nofollow),
    referringDomainsNofollow: num(item.referring_domains_nofollow),
    site: {
      server: str(info.server),
      cms: str(info.cms),
      platformType: Array.isArray(info.platform_type) ? (info.platform_type as string[]) : null,
      ip: str(info.ip_address),
      country: str(info.country),
    },
    tld: toDist(item.referring_links_tld),
    countries: toDist(item.referring_links_countries),
    platformTypes: toDist(item.referring_links_platform_types),
    attributes: toDist(item.referring_links_attributes),
    linkTypes: toDist(item.referring_links_types),
    semanticLocations: toDist(item.referring_links_semantic_locations),
  };
}
