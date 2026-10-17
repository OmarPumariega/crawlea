// Parser puro de los campos On-Page de DataForSEO que antes se descartaban
// (rendimiento, peso, recursos, coherencia del contenido, redes sociales...).
// Sin imports de la app para poder probarlo contra respuestas reales.

export type OnPageExtras = {
  statusCode: number | null;
  timing: {
    timeToInteractive: number | null; // ms
    domComplete: number | null;
    largestContentfulPaint: number | null; // 0 = no medido
    firstInputDelay: number | null;
    connection: number | null;
    secureConnection: number | null;
    waiting: number | null; // ≈ TTFB
    download: number | null;
    duration: number | null;
  } | null;
  cumulativeLayoutShift: number | null;
  scripts: { count: number | null; size: number | null };
  stylesheets: { count: number | null; size: number | null };
  imagesSize: number | null;
  renderBlockingScripts: number | null;
  renderBlockingStylesheets: number | null;
  domSize: number | null; // bytes del DOM
  size: number | null; // bytes sin comprimir
  encodedSize: number | null;
  transferSize: number | null;
  contentEncoding: string | null;
  server: string | null;
  cacheable: boolean | null;
  cacheTtl: number | null;
  lastModified: { header: string | null; sitemap: string | null; metaTag: string | null } | null;
  consistency: { description: number | null; title: number | null; keywords: number | null };
  canonical: string | null;
  generator: string | null;
  charset: number | null;
  favicon: string | null;
  inboundLinks: number | null;
  clickDepth: number | null;
  urlLength: number | null;
  relativeUrlLength: number | null;
  duplicates: { title: boolean | null; description: boolean | null; content: boolean | null; metaTags: string[] | null };
  brokenResources: boolean | null;
  resourceErrors: number | null;
  resourceWarnings: number | null;
  social: Record<string, string> | null; // og:* / twitter:*
  deprecatedTags: string[] | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function parseOnPageExtras(item: Record<string, unknown>): OnPageExtras {
  const meta = rec(item.meta);
  const content = rec(meta.content);
  const t = item.page_timing ? rec(item.page_timing) : null;
  const cache = rec(item.cache_control);
  const lm = item.last_modified ? rec(item.last_modified) : null;
  const errs = rec(item.resource_errors);
  const social = rec(meta.social_media_tags);
  const socialClean: Record<string, string> = {};
  for (const [k, v] of Object.entries(social)) if (typeof v === "string") socialClean[k] = v;
  return {
    statusCode: num(item.status_code),
    timing: t
      ? {
          timeToInteractive: num(t.time_to_interactive),
          domComplete: num(t.dom_complete),
          largestContentfulPaint: num(t.largest_contentful_paint),
          firstInputDelay: num(t.first_input_delay),
          connection: num(t.connection_time),
          secureConnection: num(t.time_to_secure_connection),
          waiting: num(t.waiting_time),
          download: num(t.download_time),
          duration: num(t.duration_time),
        }
      : null,
    cumulativeLayoutShift: num(meta.cumulative_layout_shift),
    scripts: { count: num(meta.scripts_count), size: num(meta.scripts_size) },
    stylesheets: { count: num(meta.stylesheets_count), size: num(meta.stylesheets_size) },
    imagesSize: num(meta.images_size),
    renderBlockingScripts: num(meta.render_blocking_scripts_count),
    renderBlockingStylesheets: num(meta.render_blocking_stylesheets_count),
    domSize: num(item.total_dom_size),
    size: num(item.size),
    encodedSize: num(item.encoded_size),
    transferSize: num(item.total_transfer_size),
    contentEncoding: str(item.content_encoding),
    server: str(item.server),
    cacheable: bool(cache.cachable),
    cacheTtl: num(cache.ttl),
    lastModified: lm ? { header: str(lm.header), sitemap: str(lm.sitemap), metaTag: str(lm.meta_tag) } : null,
    consistency: {
      description: num(content.description_to_content_consistency),
      title: num(content.title_to_content_consistency),
      keywords: num(content.meta_keywords_to_content_consistency),
    },
    canonical: str(meta.canonical),
    generator: str(meta.generator),
    charset: num(meta.charset),
    favicon: str(meta.favicon),
    inboundLinks: num(meta.inbound_links_count),
    clickDepth: num(item.click_depth),
    urlLength: num(item.url_length),
    relativeUrlLength: num(item.relative_url_length),
    duplicates: {
      title: bool(item.duplicate_title),
      description: bool(item.duplicate_description),
      content: bool(item.duplicate_content),
      metaTags: Array.isArray(meta.duplicate_meta_tags) ? (meta.duplicate_meta_tags as string[]) : null,
    },
    brokenResources: bool(item.broken_resources),
    resourceErrors: Array.isArray(errs.errors) ? errs.errors.length : null,
    resourceWarnings: Array.isArray(errs.warnings) ? errs.warnings.length : null,
    social: Object.keys(socialClean).length > 0 ? socialClean : null,
    deprecatedTags: Array.isArray(meta.deprecated_tags) ? (meta.deprecated_tags as string[]) : null,
  };
}
