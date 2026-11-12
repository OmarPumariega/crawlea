// Checks de PÁGINA (puros: HTML + cabeceras + robots.txt ya descargados, sin
// red). Los que necesitan red (TLS, llms.txt, WAF, hreflang recíproco, soft
// 404, redirecciones http/www) viven en site-checks.ts. Solo imports de
// librería: se prueban contra sitios reales con `tsx`.
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import type { CheckCategory, CheckSource, CheckStatus, DeepCheck } from "./types";

export type PsiLike = {
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  fieldData: {
    source: "page" | "origin";
    lcp: { percentile: number | null; category: string | null } | null;
    cls: { percentile: number | null; category: string | null } | null;
    inp: { percentile: number | null; category: string | null } | null;
    ttfb: { percentile: number | null; category: string | null } | null;
  } | null;
};

export type PageContext = {
  finalUrl: string;
  status: number;
  redirected: boolean;
  headers: Record<string, string>; // claves en minúsculas
  html: string;
  htmlBytes: number;
  robotsTxt: string | null;
  sitemap: { found: boolean; declaredInRobots: boolean; urls: string[] | null };
  psi: PsiLike | null;
  isHome: boolean;
};

const G = "https://developers.google.com/search/docs";
const src = (label: string, url: string): CheckSource => ({ label, url });

type Mk = {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  summary: string;
  fix?: string | null;
  evidence?: { label: string; value: string }[];
  weight?: number;
  advisory?: boolean;
  sources?: CheckSource[];
};
function mk(m: Mk): DeepCheck {
  return {
    id: m.id,
    category: m.category,
    title: m.title,
    status: m.status,
    summary: m.summary,
    fix: m.status === "ok" || m.status === "na" ? null : (m.fix ?? null),
    evidence: m.evidence,
    weight: m.weight ?? 1,
    advisory: m.advisory,
    sources: m.sources ?? [],
  };
}

function trunc(s: string, n = 140): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function list(items: string[], n = 6): string {
  return items.slice(0, n).join(", ") + (items.length > n ? ` y ${items.length - n} más` : "");
}

// ---------- utilidades de texto ----------

const STRONG = /[aeoáéóíúàèòäëöï]/i;
const WEAK = /[iuü]/i;
function syllablesEs(word: string): number {
  const w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, "");
  if (!w) return 0;
  let syl = 0;
  let prev: "none" | "strong" | "weak" = "none";
  let weakOpen = false;
  for (const ch of w) {
    const isVowel = STRONG.test(ch) || WEAK.test(ch);
    if (!isVowel) {
      prev = "none";
      weakOpen = false;
      continue;
    }
    if (STRONG.test(ch)) {
      // débil + fuerte = diptongo (una sílaba); fuerte + fuerte = hiato (dos).
      if (prev === "weak" && weakOpen) weakOpen = false;
      else syl++;
      prev = "strong";
    } else {
      // débil tras vocal se funde con ella (diptongo)
      if (prev === "none") {
        syl++;
        weakOpen = true;
      }
      prev = "weak";
    }
  }
  return Math.max(1, syl);
}
function syllablesEn(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const m = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 1);
}

export function readability(text: string, lang: string): { score: number; formula: string; wordsPerSentence: number; syllablesPer100: number } | null {
  const words = text.split(/\s+/).filter((w) => /[\p{L}]/u.test(w));
  if (words.length < 100) return null;
  const sentences = text.split(/[.!?…]+(?:\s|$)/).filter((s) => s.trim().split(/\s+/).length >= 3).length || 1;
  const l = lang.toLowerCase().slice(0, 2);
  const wps = words.length / sentences;
  if (l === "es") {
    const syl = words.reduce((s, w) => s + syllablesEs(w), 0);
    const p = (syl / words.length) * 100;
    return { score: Math.max(0, Math.min(100, 206.84 - 0.6 * p - 1.02 * wps)), formula: "Fernández Huerta (adaptación al español de Flesch)", wordsPerSentence: wps, syllablesPer100: p };
  }
  if (l === "en") {
    const syl = words.reduce((s, w) => s + syllablesEn(w), 0);
    const p = (syl / words.length) * 100;
    return { score: Math.max(0, Math.min(100, 206.835 - 1.015 * wps - 0.846 * p)), formula: "Flesch Reading Ease", wordsPerSentence: wps, syllablesPer100: p };
  }
  return null;
}

// ---------- JSON-LD ----------

type Node = Record<string, unknown>;
export function parseJsonLd($: cheerio.CheerioAPI): { nodes: Node[]; errors: string[]; blocks: number } {
  const nodes: Node[] = [];
  const errors: string[] = [];
  let blocks = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    blocks++;
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      const push = (n: unknown) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(push);
        const o = n as Node;
        if (Array.isArray(o["@graph"])) (o["@graph"] as unknown[]).forEach(push);
        else nodes.push(o);
      };
      push(parsed);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "JSON no válido");
    }
  });
  return { nodes, errors, blocks };
}
function typesOf(n: Node): string[] {
  const t = n["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}
const has = (n: Node, k: string) => {
  const v = n[k];
  return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
};
function hasOffersPrice(n: Node): boolean {
  const offers = n["offers"];
  const arr = Array.isArray(offers) ? offers : offers ? [offers] : [];
  return arr.some((o) => o && typeof o === "object" && ("price" in (o as Node) || "priceSpecification" in (o as Node) || "lowPrice" in (o as Node)));
}

// Requisitos de Google por tipo (páginas oficiales de "Search Gallery").
// Solo tipos con resultado enriquecido; cada función devuelve lo que FALTA.
const RICH: Record<string, { doc: CheckSource; missing: (n: Node) => string[] }> = {
  SoftwareApplication: {
    doc: src("Google: SoftwareApplication", `${G}/appearance/structured-data/software-app`),
    missing: (n) => [
      ...(has(n, "name") ? [] : ["name"]),
      ...(hasOffersPrice(n) ? [] : ["offers.price"]),
      ...(has(n, "aggregateRating") || has(n, "review") ? [] : ["aggregateRating o review"]),
    ],
  },
  Product: {
    doc: src("Google: Product", `${G}/appearance/structured-data/product-snippet`),
    missing: (n) => [
      ...(has(n, "name") ? [] : ["name"]),
      ...(has(n, "review") || has(n, "aggregateRating") || has(n, "offers") ? [] : ["review, aggregateRating u offers"]),
    ],
  },
  FAQPage: {
    doc: src("Google: FAQPage", `${G}/appearance/structured-data/faqpage`),
    missing: (n) => (has(n, "mainEntity") ? [] : ["mainEntity (Question + acceptedAnswer)"]),
  },
  LocalBusiness: {
    doc: src("Google: LocalBusiness", `${G}/appearance/structured-data/local-business`),
    missing: (n) => [...(has(n, "name") ? [] : ["name"]), ...(has(n, "address") ? [] : ["address"])],
  },
  VideoObject: {
    doc: src("Google: VideoObject", `${G}/appearance/structured-data/video`),
    missing: (n) => ["name", "thumbnailUrl", "uploadDate"].filter((k) => !has(n, k)),
  },
  Event: {
    doc: src("Google: Event", `${G}/appearance/structured-data/event`),
    missing: (n) => ["name", "startDate", "location"].filter((k) => !has(n, k)),
  },
  Recipe: {
    doc: src("Google: Recipe", `${G}/appearance/structured-data/recipe`),
    missing: (n) => ["name", "image"].filter((k) => !has(n, k)),
  },
  JobPosting: {
    doc: src("Google: JobPosting", `${G}/appearance/structured-data/job-posting`),
    missing: (n) => ["title", "description", "datePosted", "hiringOrganization", "jobLocation"].filter((k) => !has(n, k)),
  },
  Course: {
    doc: src("Google: Course", `${G}/appearance/structured-data/course`),
    missing: (n) => ["name", "description", "provider"].filter((k) => !has(n, k)),
  },
  Article: {
    doc: src("Google: Article", `${G}/appearance/structured-data/article`),
    missing: (n) => ["headline", "image", "datePublished", "author"].filter((k) => !has(n, k)), // recomendadas
  },
};
const ALIAS: Record<string, string> = {
  WebApplication: "SoftwareApplication",
  MobileApplication: "SoftwareApplication",
  NewsArticle: "Article",
  BlogPosting: "Article",
  Restaurant: "LocalBusiness",
  Store: "LocalBusiness",
  ProfessionalService: "LocalBusiness",
  Dentist: "LocalBusiness",
  LegalService: "LocalBusiness",
  AutoRepair: "LocalBusiness",
  HealthAndBeautyBusiness: "LocalBusiness",
  HomeAndConstructionBusiness: "LocalBusiness",
  MedicalBusiness: "LocalBusiness",
};
const STRUCTURAL = new Set(["Organization", "WebSite", "WebPage", "BreadcrumbList", "ListItem", "Person", "ImageObject", "SearchAction", "PostalAddress", "ItemList", "CollectionPage", "AboutPage", "ContactPage", "SiteNavigationElement", "WPHeader", "WPFooter", "Offer", "AggregateOffer", "Brand", "Thing"]);

// ---------- el motor ----------

export function runPageChecks(ctx: PageContext): DeepCheck[] {
  const $ = cheerio.load(ctx.html);
  const out: DeepCheck[] = [];
  const h = ctx.headers;
  const final = new URL(ctx.finalUrl);
  const origin = final.origin;
  const lang = ($("html").attr("lang") ?? "").trim();
  const jsonld = parseJsonLd($);
  const types = new Set(jsonld.nodes.flatMap(typesOf));
  const ogType = $('meta[property="og:type"]').attr("content")?.trim().toLowerCase() ?? "";
  const isArticle =
    ogType === "article" ||
    !!$('meta[property="article:published_time"]').attr("content") ||
    [...types].some((t) => ["Article", "NewsArticle", "BlogPosting"].includes(t));

  // Texto principal (para legibilidad, palabras, etc.)
  const $text = cheerio.load(ctx.html);
  $text("script, style, noscript, template, svg").remove();
  const mainNode = $text("main").length ? $text("main").first() : $text("body");
  const noChrome = cheerio.load(mainNode.html() ?? "");
  noChrome("nav, footer, header, aside").remove();
  const bodyText = noChrome.root().text().replace(/\s+/g, " ").trim();
  // Para legibilidad: cada bloque de texto (párrafo, ítem, encabezado...) es una
  // frase aunque no acabe en punto (en landings casi ninguno lo hace).
  noChrome("p, li, h1, h2, h3, h4, h5, h6, dd, dt, figcaption, td, th, blockquote").each((_, el) => {
    const t = noChrome(el).text().trim();
    if (t && !/[.!?…:]$/.test(t)) noChrome(el).append(". ");
  });
  const readText = noChrome.root().text().replace(/\s+/g, " ").trim();
  const wholeText = $text("body").text().replace(/\s+/g, " ").trim();
  const wordCount = wholeText ? wholeText.split(" ").filter(Boolean).length : 0;

  const robots = ctx.robotsTxt != null ? robotsParser(`${origin}/robots.txt`, ctx.robotsTxt) : null;
  const allowed = (u: string, ua: string) => (robots ? robots.isAllowed(u, ua) !== false : true);

  // ===== 1. RASTREO E INDEXACIÓN =====
  out.push(
    mk({
      id: "http-status",
      category: "crawl",
      title: "La URL responde 200 directamente",
      status: ctx.status === 200 && !ctx.redirected ? "ok" : ctx.status >= 400 ? "fail" : "improve",
      summary:
        ctx.status >= 400
          ? `La URL devuelve ${ctx.status}.`
          : ctx.redirected
            ? `La URL pedida redirige hasta ${ctx.finalUrl} (código final ${ctx.status}). Cada salto añade latencia y diluye señales.`
            : "La URL responde 200 sin redirecciones intermedias.",
      fix: ctx.status >= 400 ? "Haz que la página responda 200 o redirige con un 301 a su equivalente." : "Enlaza y declara siempre la URL final (la del canonical) para evitar saltos.",
      sources: [src("Google Search Central: códigos HTTP", `${G}/crawling-indexing/http-network-errors`)],
      weight: 2,
    })
  );

  const gb = allowed(ctx.finalUrl, "Googlebot");
  const star = allowed(ctx.finalUrl, "*");
  out.push(
    mk({
      id: "robots-allow",
      category: "crawl",
      title: "No bloqueada en robots.txt",
      status: ctx.robotsTxt == null ? "ok" : gb && star ? "ok" : "fail",
      summary:
        ctx.robotsTxt == null
          ? "No hay robots.txt accesible: el protocolo estándar lo interpreta como «todo permitido»."
          : gb && star
            ? "robots.txt permite el rastreo de esta ruta a Googlebot y al user-agent genérico."
            : `robots.txt bloquea esta ruta${!gb ? " a Googlebot" : ""}${!star ? " al user-agent genérico (*)" : ""}.`,
      fix: "Quita la regla Disallow que afecta a esta ruta (o ajústala) en /robots.txt.",
      sources: [src("Google: introducción a robots.txt", `${G}/crawling-indexing/robots/intro`)],
      weight: 3,
    })
  );

  const metaRobots = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  const googlebotMeta = ($('meta[name="googlebot"]').attr("content") ?? "").toLowerCase();
  const xrt = (h["x-robots-tag"] ?? "").toLowerCase();
  const directives = `${metaRobots},${googlebotMeta},${xrt}`;
  const noindex = /noindex|none/.test(directives);
  const nofollow = /nofollow|none/.test(directives);
  out.push(
    mk({
      id: "robots-meta",
      category: "crawl",
      title: "Meta robots / X-Robots-Tag (noindex, nofollow)",
      status: noindex ? "fail" : nofollow ? "improve" : "ok",
      summary: noindex
        ? "La página está marcada como noindex: Google no la mostrará en resultados."
        : nofollow
          ? "La página lleva nofollow: Google no seguirá sus enlaces para descubrir ni transmitir autoridad."
          : "No hay directivas noindex ni nofollow en meta robots ni en X-Robots-Tag.",
      fix: noindex ? "Elimina noindex del meta robots (y de la cabecera X-Robots-Tag) si quieres que la página se indexe." : "Quita nofollow salvo que sea intencionado.",
      evidence: [
        { label: "meta robots", value: metaRobots || "(ninguno)" },
        { label: "X-Robots-Tag", value: xrt || "(ninguna)" },
      ],
      sources: [src("Google: meta robots y X-Robots-Tag", `${G}/crawling-indexing/robots-meta-tag`)],
      weight: 3,
    })
  );

  // Recursos CSS/JS bloqueados
  const resUrls = new Set<string>();
  $('script[src], link[rel="stylesheet"][href]').each((_, el) => {
    const u = $(el).attr("src") ?? $(el).attr("href");
    if (!u) return;
    try {
      const abs = new URL(u, ctx.finalUrl);
      if (abs.origin === origin) resUrls.add(abs.toString());
    } catch {
      /* ignora */
    }
  });
  const blockedRes = [...resUrls].filter((u) => !allowed(u, "Googlebot"));
  out.push(
    mk({
      id: "robots-resources",
      category: "crawl",
      title: "robots.txt no bloquea el CSS/JS de la página",
      status: resUrls.size === 0 ? "na" : blockedRes.length === 0 ? "ok" : "fail",
      summary:
        resUrls.size === 0
          ? "La página no enlaza CSS/JS propios que comprobar."
          : blockedRes.length === 0
            ? `Los ${resUrls.size} recursos CSS/JS propios son accesibles para Googlebot según robots.txt.`
            : `${blockedRes.length} recurso(s) CSS/JS propios bloqueados para Googlebot: Google no puede renderizar la página como un usuario. ${list(blockedRes, 3)}`,
      fix: "Permite el rastreo de las carpetas de CSS/JS en robots.txt (quita el Disallow que las cubre).",
      sources: [src("Google: SEO para JavaScript", `${G}/crawling-indexing/javascript/javascript-seo-basics`)],
    })
  );

  // Canonical
  const canonHref = $('link[rel="canonical"]').attr("href")?.trim() ?? "";
  const headerCanon = (h["link"] ?? "").match(/<([^>]+)>\s*;\s*rel="?canonical"?/i)?.[1];
  const norm = (u: string) => u.replace(/#.*$/, "").replace(/\/+$/, "");
  let canonStatus: CheckStatus = "ok";
  let canonSummary = "";
  let canonFix = "";
  if (!canonHref && !headerCanon) {
    canonStatus = "fail";
    canonSummary = "No hay etiqueta canonical: Google elegirá por su cuenta qué URL indexar si hay variantes.";
    canonFix = `Añade <link rel="canonical" href="${ctx.finalUrl}"> en el <head>.`;
  } else {
    const c = canonHref || headerCanon!;
    let abs: string | null = null;
    try {
      abs = new URL(c, ctx.finalUrl).toString();
    } catch {
      abs = null;
    }
    const isAbsolute = /^https?:\/\//i.test(c);
    if (!abs) {
      canonStatus = "fail";
      canonSummary = `El canonical («${trunc(c, 80)}») no es una URL válida.`;
      canonFix = "Usa una URL absoluta y válida.";
    } else if (norm(abs) !== norm(ctx.finalUrl)) {
      canonStatus = "improve";
      canonSummary = `El canonical apunta a otra URL (${abs}), no a la propia: esta página no se indexará.`;
      canonFix = "Si la página debe indexarse, haz que el canonical sea autorreferencial; si es una variante, déjalo así a propósito.";
    } else if (!isAbsolute) {
      canonStatus = "improve";
      canonSummary = `El canonical es relativo («${c}»); Google recomienda URLs absolutas.`;
      canonFix = `Usa la URL absoluta: ${abs}`;
    } else {
      canonSummary = `La canonical (${abs}) es absoluta y apunta a la propia URL${canonHref ? "" : " (en la cabecera HTTP Link)"}.`;
    }
  }
  out.push(
    mk({
      id: "canonical",
      category: "crawl",
      title: "Canonical autorreferencial y absoluta",
      status: canonStatus,
      summary: canonSummary,
      fix: canonFix,
      sources: [src("Google: consolidar URLs duplicadas (canonical)", `${G}/crawling-indexing/consolidate-duplicate-urls`)],
      weight: 2,
    })
  );

  // Sitemap
  const sm = ctx.sitemap;
  const inSitemap = sm.urls ? sm.urls.some((u) => norm(u) === norm(ctx.finalUrl)) : null;
  out.push(
    mk({
      id: "sitemap",
      category: "crawl",
      title: "Sitemap declarado e incluye la URL",
      status: !sm.found ? "fail" : inSitemap === false ? "improve" : !sm.declaredInRobots ? "improve" : "ok",
      summary: !sm.found
        ? "No se encuentra sitemap.xml: Google descubre las páginas solo por enlaces."
        : `Sitemap encontrado${sm.declaredInRobots ? " y declarado en robots.txt" : " pero NO declarado en robots.txt"}. ${
            inSitemap === null ? "" : inSitemap ? "La URL aparece en el sitemap." : "La URL NO aparece en el sitemap."
          }${sm.urls ? ` (${sm.urls.length} URLs)` : ""}`,
      fix: !sm.found
        ? "Genera un sitemap.xml con las URLs indexables y declara su ruta en robots.txt (Sitemap: https://…/sitemap.xml)."
        : inSitemap === false
          ? "Incluye esta URL en el sitemap (solo URLs indexables, canónicas y con 200)."
          : "Añade la línea «Sitemap: URL_DEL_SITEMAP» a robots.txt.",
      sources: [src("Google: cómo crear un sitemap", `${G}/crawling-indexing/sitemaps/overview`)],
      weight: 2,
    })
  );

  const refresh = $('meta[http-equiv="refresh" i]').attr("content");
  out.push(
    mk({
      id: "meta-refresh",
      category: "crawl",
      title: "Sin meta refresh (redirección obsoleta)",
      status: refresh ? "improve" : "ok",
      summary: refresh ? `La página usa <meta http-equiv="refresh" content="${trunc(refresh, 60)}">: es una redirección lenta y poco fiable.` : "No se usa <meta http-equiv=\"refresh\">.",
      fix: "Sustitúyela por una redirección HTTP 301 en el servidor.",
      sources: [src("MDN: http-equiv de <meta>", "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/http-equiv")],
    })
  );

  // Soft 404 (heurística sobre la propia página; la prueba real a una URL inexistente está en site-checks)
  const looksError = /\b(404|not found|no encontrad[ao]|p[aá]gina no existe)\b/i.test($("title").text() + " " + $("h1").first().text());
  out.push(
    mk({
      id: "soft404-page",
      category: "crawl",
      title: "Sin indicios de soft 404 en la página",
      status: ctx.status === 200 && (wordCount < 40 || looksError) ? "fail" : "ok",
      summary:
        ctx.status === 200 && (wordCount < 40 || looksError)
          ? `Responde 200 pero ${looksError ? "su título/H1 parece un mensaje de error" : `tiene solo ${wordCount} palabras`}: Google puede tratarla como soft 404.`
          : "No se detectan señales típicas de soft 404 (200 con contenido vacío o de error).",
      fix: "Si la página no existe devuelve un 404/410 real; si existe, dale contenido útil.",
      sources: [src("Google: errores soft 404", `${G}/crawling-indexing/http-network-errors#soft-404-errors`)],
    })
  );

  // ===== 2. URL Y ARQUITECTURA =====
  const path = final.pathname;
  const segs = path.split("/").filter(Boolean);
  const urlLen = ctx.finalUrl.length;
  out.push(
    mk({
      id: "url-length",
      category: "url",
      title: "URL corta y legible",
      status: urlLen <= 115 ? "ok" : urlLen <= 200 ? "improve" : "fail",
      summary: `La URL tiene ${urlLen} caracteres${urlLen <= 115 ? ", dentro de un rango razonable" : ", demasiado larga"}.`,
      fix: "Acorta la URL: quita palabras vacías, parámetros y niveles innecesarios.",
      sources: [src("Google: estructura de URLs", `${G}/crawling-indexing/url-structure`)],
    })
  );
  const badFormat = /[A-Z]/.test(path) || /_/.test(path) || /%20|\s/.test(path);
  out.push(
    mk({
      id: "url-format",
      category: "url",
      title: "URL en minúsculas y con guiones",
      status: badFormat ? "improve" : "ok",
      summary: badFormat ? `La ruta (${path}) contiene mayúsculas, guiones bajos o espacios.` : "La URL sigue el formato recomendado (minúsculas, guiones medios).",
      fix: "Usa solo minúsculas y separa las palabras con guiones medios (-); redirige 301 la versión antigua.",
      sources: [src("Google: estructura de URLs", `${G}/crawling-indexing/url-structure`)],
    })
  );
  const urlHasDate = /\/(19|20)\d{2}\/(0?[1-9]|1[0-2])(\/|$)/.test(path);
  const hasId = /\/\d{5,}(\/|$|-)/.test(path);
  out.push(
    mk({
      id: "url-noise",
      category: "url",
      title: "Sin fechas/IDs innecesarios",
      status: urlHasDate || hasId ? "improve" : "ok",
      summary: urlHasDate || hasId ? `La ruta incluye ${urlHasDate ? "una fecha" : "un ID numérico largo"} (${path}).` : "No se detectan patrones de fecha ni IDs numéricos largos en la ruta.",
      fix: "Usa un slug descriptivo en lugar de fechas o IDs; así la URL no caduca y comunica el tema.",
      sources: [src("Google: estructura de URLs", `${G}/crawling-indexing/url-structure`)],
    })
  );
  out.push(
    mk({
      id: "url-depth",
      category: "url",
      title: "Profundidad de la URL",
      status: segs.length <= 3 ? "ok" : segs.length <= 5 ? "improve" : "fail",
      summary: `Profundidad de ${segs.length} nivel(es) respecto a la raíz${segs.length <= 3 ? ", razonable" : ", excesiva"}.`,
      fix: "Aplana la arquitectura: las páginas importantes deberían estar a pocos clics de la home.",
      sources: [src("Google: estructura de URLs", `${G}/crawling-indexing/url-structure`)],
    })
  );
  out.push(
    mk({
      id: "url-params",
      category: "url",
      title: "Sin parámetros de consulta",
      status: final.search ? "improve" : "ok",
      summary: final.search ? `La URL lleva parámetros (${final.search}) que pueden generar contenido duplicado.` : "La URL no lleva parámetros de consulta que puedan generar contenido duplicado.",
      fix: "Usa URLs limpias o fija un canonical a la versión sin parámetros.",
      sources: [src("Google: contenido duplicado", `${G}/crawling-indexing/consolidate-duplicate-urls`)],
    })
  );
  const hasBreadcrumbSchema = jsonld.nodes.some((n) => typesOf(n).includes("BreadcrumbList")) || $('[itemtype*="BreadcrumbList"]').length > 0;
  const hasBreadcrumbVisible = $('nav[aria-label*="bread" i], [class*="breadcrumb" i], ol[class*="crumb" i]').length > 0;
  out.push(
    mk({
      id: "breadcrumbs",
      category: "url",
      title: "Breadcrumbs visibles y marcados",
      status: segs.length < 2 ? "na" : hasBreadcrumbSchema && hasBreadcrumbVisible ? "ok" : hasBreadcrumbSchema || hasBreadcrumbVisible ? "improve" : "improve",
      summary:
        segs.length < 2
          ? "Esta página está en el primer nivel (o es la home): los breadcrumbs no suelen aportar aquí."
          : `Breadcrumbs ${hasBreadcrumbVisible ? "visibles" : "NO visibles"} · ${hasBreadcrumbSchema ? "marcados con schema" : "SIN marcado BreadcrumbList"}.`,
      fix: "Añade una ruta de migas visible y márcala con JSON-LD BreadcrumbList (así Google la muestra en el resultado).",
      sources: [src("Google: BreadcrumbList", `${G}/appearance/structured-data/breadcrumb`)],
    })
  );

  // ===== 3. ETIQUETAS ON-PAGE =====
  const title = $("title").first().text().trim();
  out.push(
    mk({
      id: "title",
      category: "onpage",
      title: "Title con longitud adecuada",
      status: !title ? "fail" : title.length < 20 || title.length > 70 ? "improve" : title.length > 60 ? "improve" : "ok",
      summary: !title ? "La página no tiene <title>." : `El title tiene ${title.length} caracteres: «${trunc(title, 90)}».`,
      fix: !title ? "Añade un <title> único y descriptivo (30-60 caracteres)." : title.length > 60 ? "Acórtalo a ~60 caracteres para que Google no lo trunque." : "Amplíalo con la keyword principal y un gancho (30-60 caracteres).",
      sources: [src("Google: título de página (title link)", `${G}/appearance/title-link`)],
      weight: 2,
    })
  );
  const meta = $('meta[name="description"]').attr("content")?.trim() ?? "";
  out.push(
    mk({
      id: "meta-description",
      category: "onpage",
      title: "Meta description con longitud adecuada",
      status: !meta ? "fail" : meta.length < 70 || meta.length > 160 ? "improve" : "ok",
      summary: !meta ? "No hay meta description." : `La meta description tiene ${meta.length} caracteres (rango habitual 70-160 antes de truncarse): «${trunc(meta, 120)}».`,
      fix: !meta ? "Añade una meta description de 70-160 caracteres que resuma la página e invite al clic." : meta.length > 160 ? "Acórtala a un máximo de 160 caracteres." : "Amplíala hasta ~120-155 caracteres.",
      sources: [src("Google: snippets y meta description", `${G}/appearance/snippet`)],
      weight: 2,
    })
  );
  // Open Graph
  const og = (p: string) => $(`meta[property="og:${p}"]`).attr("content")?.trim() || "";
  const ogAttrs = ["title", "description", "image", "url", "type"].map((p) => ({ p, v: og(p) }));
  const ogMissing = ogAttrs.filter((a) => !a.v).map((a) => `og:${a.p}`);
  out.push(
    mk({
      id: "open-graph",
      category: "onpage",
      title: "Open Graph",
      status: ogMissing.length === 0 ? "ok" : ogMissing.some((m) => m === "og:title" || m === "og:image") ? "fail" : "improve",
      summary: `${5 - ogMissing.length} de 5 atributos presentes${ogMissing.length ? ` (faltan ${ogMissing.join(", ")})` : ""}.`,
      fix: `Añade en el <head>: ${ogMissing.map((m) => `<meta property="${m}" content="…">`).join(" ")}`,
      evidence: ogAttrs.map((a) => ({ label: `og:${a.p}`, value: a.v ? trunc(a.v, 100) : "(falta)" })),
      sources: [src("The Open Graph protocol", "https://ogp.me/")],
    })
  );
  const tw = (p: string) => $(`meta[name="twitter:${p}"]`).attr("content")?.trim() || "";
  const twCard = tw("card");
  out.push(
    mk({
      id: "twitter-cards",
      category: "onpage",
      title: "Twitter/X Cards",
      status: twCard ? "ok" : "improve",
      summary: twCard ? `twitter:card = «${twCard}»${tw("image") || og("image") ? "" : " (sin imagen: ni twitter:image ni og:image)"}.` : "No hay twitter:card. X usará un formato básico al compartir.",
      fix: 'Añade <meta name="twitter:card" content="summary_large_image"> (el resto lo hereda de Open Graph).',
      sources: [src("X: Cards markup", "https://developer.x.com/en/docs/x-for-websites/cards/overview/markup")],
      weight: 0.5,
    })
  );
  // Encabezados
  const heads: { level: number; text: string }[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    heads.push({ level: Number((el as unknown as { tagName: string }).tagName[1]), text: $(el).text().replace(/\s+/g, " ").trim() });
  });
  const h1s = heads.filter((x) => x.level === 1);
  const skips: string[] = [];
  for (let i = 1; i < heads.length; i++) if (heads[i].level > heads[i - 1].level + 1) skips.push(`H${heads[i - 1].level}→H${heads[i].level}`);
  const firstIsH1 = heads[0]?.level === 1;
  const hProblems: string[] = [];
  if (h1s.length === 0) hProblems.push("no hay H1");
  if (h1s.length > 1) hProblems.push(`hay ${h1s.length} H1`);
  if (h1s.length >= 1 && !firstIsH1) hProblems.push("el primer encabezado no es el H1");
  if (skips.length) hProblems.push(`saltos de nivel (${list(skips, 3)})`);
  out.push(
    mk({
      id: "headings-structure",
      category: "onpage",
      title: "Estructura de encabezados (H1 único, primero y sin saltos)",
      status: h1s.length === 0 ? "fail" : hProblems.length ? "improve" : "ok",
      summary: hProblems.length ? `Problemas: ${hProblems.join("; ")}.` : `Un único H1 («${trunc(h1s[0].text, 80)}»), es el primer encabezado y los niveles son consecutivos.`,
      fix: "Deja un solo H1 al principio con el tema principal y usa H2→H3→H4 sin saltarte niveles.",
      evidence: [{ label: "Secuencia", value: heads.slice(0, 24).map((x) => `H${x.level}`).join(" → ") + (heads.length > 24 ? " …" : "") }],
      sources: [src("Google: SEO Starter Guide (encabezados)", `${G}/fundamentals/seo-starter-guide#use-heading-elements-to-emphasize-important-text`)],
      weight: 2,
    })
  );
  const GENERIC_H = /^(introducci[oó]n|m[aá]s informaci[oó]n|leer m[aá]s|ver m[aá]s|detalles|informaci[oó]n|contenido|t[ií]tulo|heading|untitled|sin t[ií]tulo|inicio)$/i;
  const genericHeads = heads.filter((x) => x.text && GENERIC_H.test(x.text));
  out.push(
    mk({
      id: "headings-descriptive",
      category: "onpage",
      title: "Encabezados descriptivos",
      status: genericHeads.length ? "improve" : "ok",
      summary: genericHeads.length ? `${genericHeads.length} encabezado(s) genéricos: ${list(genericHeads.map((x) => `«${x.text}»`), 4)}.` : "Los encabezados parecen suficientemente descriptivos.",
      fix: "Reescríbelos para que describan el contenido de su sección (idealmente con la keyword relacionada).",
      sources: [src("Google: SEO Starter Guide", `${G}/fundamentals/seo-starter-guide`)],
      weight: 0.5,
    })
  );
  const emptyHeads = heads.filter((x) => !x.text).length;
  out.push(
    mk({
      id: "headings-empty",
      category: "onpage",
      title: "Encabezados sin texto",
      status: emptyHeads ? "improve" : "ok",
      summary: emptyHeads ? `${emptyHeads} encabezado(s) vacíos.` : `Los ${heads.length} encabezados tienen contenido.`,
      fix: "Elimina los encabezados vacíos o dales texto; los lectores de pantalla los anuncian igualmente.",
      sources: [src("Google: SEO Starter Guide", `${G}/fundamentals/seo-starter-guide`)],
      weight: 0.5,
    })
  );
  out.push(
    mk({
      id: "html-lang",
      category: "onpage",
      title: "Atributo lang en <html>",
      status: lang ? "ok" : "fail",
      summary: lang ? `El atributo lang está definido como «${lang}».` : "El elemento <html> no tiene atributo lang.",
      fix: 'Añade <html lang="es"> (o el idioma real de la página).',
      sources: [src("W3C: el atributo lang", "https://www.w3.org/International/questions/qa-html-language-declarations")],
    })
  );
  const charset = $("meta[charset]").length > 0 || /charset=/i.test($('meta[http-equiv="Content-Type" i]').attr("content") ?? "") || /charset=/i.test(h["content-type"] ?? "");
  out.push(
    mk({
      id: "charset",
      category: "onpage",
      title: "Meta charset declarado",
      status: charset ? "ok" : "improve",
      summary: charset ? "Se declara la codificación de caracteres (<meta charset> o Content-Type con charset)." : "No se declara la codificación de caracteres.",
      fix: 'Añade <meta charset="utf-8"> como primer elemento del <head>.',
      sources: [src("MDN: elemento <meta>", "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta")],
      weight: 0.5,
    })
  );
  const icon = $('link[rel~="icon"], link[rel="apple-touch-icon"]').first().attr("href");
  out.push(
    mk({
      id: "favicon",
      category: "onpage",
      title: "Favicon declarado",
      status: icon ? "ok" : "improve",
      summary: icon ? `Se ha encontrado <link rel="icon">: ${trunc(icon, 100)}` : "No se declara favicon: Google no podrá mostrar tu icono junto al resultado.",
      fix: 'Añade <link rel="icon" href="/favicon.ico"> (múltiplo de 48 px, formato estable).',
      sources: [src("Google: favicon en los resultados", `${G}/appearance/favicon-in-search`)],
      weight: 0.5,
    })
  );
  const internalNofollow: string[] = [];
  $("a[href][rel]").each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    if (!rel.includes("nofollow")) return;
    try {
      if (new URL($(el).attr("href")!, ctx.finalUrl).origin === origin) internalNofollow.push($(el).attr("href")!);
    } catch {
      /* ignora */
    }
  });
  out.push(
    mk({
      id: "internal-nofollow",
      category: "onpage",
      title: "Enlaces internos sin nofollow innecesario",
      status: internalNofollow.length ? "improve" : "ok",
      summary: internalNofollow.length ? `${internalNofollow.length} enlace(s) internos con rel="nofollow": ${list(internalNofollow, 3)}.` : 'No se encuentran enlaces internos con rel="nofollow" innecesario.',
      fix: "Quita rel=nofollow de los enlaces internos: así fluye la autoridad entre tus páginas.",
      sources: [src("Google: cualifica tus enlaces salientes", `${G}/crawling-indexing/qualify-outbound-links`)],
      weight: 0.5,
    })
  );

  // ===== 4. CONTENIDO =====
  const tabs = $("details, [role='tab'], [role='tabpanel'], [aria-expanded], [class*='accordion' i]").length;
  const wordsMain = bodyText ? bodyText.split(" ").filter(Boolean).length : 0;
  out.push(
    mk({
      id: "content-tabs",
      category: "content",
      title: "Contenido en pestañas/acordeones",
      status: tabs > 10 && wordsMain < 600 ? "improve" : "ok",
      summary: tabs === 0 ? "No hay contenido en pestañas ni acordeones." : tabs > 10 && wordsMain < 600 ? `Se han detectado ${tabs} elemento(s) de tipo acordeón/pestaña/details con poco texto visible fuera de ellos (${wordsMain} palabras). Google puede indexarlo, pero suele darle menos peso.` : `Se han detectado ${tabs} elemento(s) de tipo acordeón/pestaña/details y hay ${wordsMain} palabras visibles fuera de ellos: el contenido esencial no depende de ellos.`,
      fix: "Mantén el contenido esencial visible por defecto y deja en acordeones solo el detalle secundario.",
      sources: [src("Google: contenido útil, fiable y centrado en las personas", `${G}/fundamentals/creating-helpful-content`)],
      weight: 0.5,
    })
  );
  const imgs = $("img").toArray();
  const noAlt = imgs.filter((el) => $(el).attr("alt") === undefined);
  out.push(
    mk({
      id: "img-alt",
      category: "content",
      title: "Texto alternativo en imágenes",
      status: imgs.length === 0 ? "na" : noAlt.length === 0 ? "ok" : noAlt.length / imgs.length > 0.3 ? "fail" : "improve",
      summary: imgs.length === 0 ? "La página no tiene imágenes <img>." : `${imgs.length - noAlt.length} de ${imgs.length} imágenes tienen atributo alt (vacío o con texto). Faltan ${noAlt.length}.`,
      fix: 'Añade alt descriptivo a cada imagen informativa (y alt="" a las decorativas).',
      evidence: noAlt.slice(0, 5).map((el) => ({ label: "Sin alt", value: trunc($(el).attr("src") ?? "", 100) })),
      sources: [src("Google: uso del atributo alt", `${G}/appearance/google-images#use-the-alt-attribute`)],
      weight: 2,
    })
  );
  out.push(
    mk({
      id: "word-count",
      category: "content",
      title: "Extensión del contenido",
      status: wordCount >= 300 ? "ok" : wordCount >= 150 ? "improve" : "fail",
      summary: `El texto visible tiene aproximadamente ${wordCount} palabras${wordCount >= 300 ? ". Extensión suficiente para desarrollar el tema, siempre que no sea relleno." : ": poco contenido para posicionar."}`,
      fix: "Amplía la página con información útil y única (no relleno) que responda a lo que busca el usuario.",
      sources: [src("Google: contenido útil", `${G}/fundamentals/creating-helpful-content`)],
    })
  );
  const GENERIC_FILE = /^(img|image|imagen|dsc|dscn|photo|foto|screenshot|captura|untitled|sin-titulo|picture|pic|banner|header|hero|default|placeholder)[-_ ]?\d*\.(jpe?g|png|webp|gif|avif|svg)$/i;
  const files = imgs
    .map((el) => $(el).attr("src") ?? "")
    .filter((s) => s && !s.startsWith("data:"))
    .map((s) => {
      try {
        const u = new URL(s, ctx.finalUrl);
        // Next.js (/_next/image?url=...) y CDNs: el nombre real va en un parámetro
        const inner = u.searchParams.get("url");
        return decodeURIComponent((inner ?? u.pathname).split("/").pop() ?? "");
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const genericFiles = files.filter((f) => GENERIC_FILE.test(f) || /^\d+\.(jpe?g|png|webp)$/i.test(f) || /^[0-9a-f]{16,}\.(jpe?g|png|webp)$/i.test(f));
  out.push(
    mk({
      id: "img-filenames",
      category: "content",
      title: "Nombres de archivo de imagen semánticos",
      status: files.length === 0 ? "na" : genericFiles.length === 0 ? "ok" : "improve",
      summary: files.length === 0 ? "No hay imágenes con nombre de archivo evaluable." : `${genericFiles.length} de ${files.length} imágenes tienen nombres genéricos (ej. IMG_1234.jpg) en vez de describir el contenido.${genericFiles.length ? " " + list(genericFiles, 3) : ""}`,
      fix: "Renombra los archivos con palabras descriptivas separadas por guiones (zapatillas-trail-azul.webp).",
      sources: [src("Google: buenas prácticas de imágenes", `${G}/appearance/google-images`)],
      weight: 0.5,
    })
  );
  out.push(
    mk({
      id: "text-vs-images",
      category: "content",
      title: "El texto no depende únicamente de imágenes",
      status: imgs.length > 0 && wordCount < imgs.length * 15 && wordCount < 200 ? "improve" : "ok",
      summary: imgs.length > 0 && wordCount < imgs.length * 15 && wordCount < 200 ? `Solo ${wordCount} palabras para ${imgs.length} imágenes: puede que el contenido esté dentro de las imágenes.` : "Hay suficiente texto extraíble en el HTML respecto al número de imágenes.",
      fix: "Pasa a texto HTML real lo que ahora es imagen: Google y las IA no leen texto dentro de imágenes de forma fiable.",
      sources: [src("Google: uso del atributo alt", `${G}/appearance/google-images`)],
      weight: 0.5,
    })
  );
  const rd = readability(readText, lang);
  out.push(
    mk({
      id: "readability",
      category: "content",
      title: "Legibilidad del texto",
      status: !rd ? "na" : rd.score >= 50 ? "ok" : rd.score >= 30 ? "improve" : "fail",
      summary: !rd
        ? `No se puede evaluar: ${wordsMain < 100 ? "menos de 100 palabras de texto" : `idioma «${lang || "sin lang"}» sin fórmula de legibilidad soportada (es/en)`}.`
        : `Puntuación de legibilidad estimada: ${rd.score.toFixed(1)}/100 (${rd.formula}). ${rd.score >= 60 ? "Fácil de leer para el público general." : rd.score >= 50 ? "Dificultad normal." : "Texto difícil de leer."}`,
      fix: "Acorta las frases (≤20 palabras), usa palabras más cortas y párrafos de 2-4 líneas.",
      evidence: rd ? [{ label: "palabras/frase", value: rd.wordsPerSentence.toFixed(1) }, { label: "sílabas/100 palabras", value: rd.syllablesPer100.toFixed(1) }] : undefined,
      sources: [src("Wikipedia: legibilidad (Flesch / Fernández Huerta)", "https://es.wikipedia.org/wiki/Test_de_legibilidad_de_Flesch")],
      weight: 0.5,
    })
  );
  // Autor y fechas: solo si la página se declara artículo
  const hasAuthor = $('meta[name="author"], [rel="author"], [itemprop="author"], .author, .byline, [class*="author" i]').length > 0 || jsonld.nodes.some((n) => has(n, "author"));
  const hasDate = $("time[datetime], meta[property='article:published_time'], meta[property='article:modified_time']").length > 0 || jsonld.nodes.some((n) => has(n, "datePublished") || has(n, "dateModified"));
  out.push(
    mk({
      id: "author",
      category: "content",
      title: "Autor identificado",
      status: !isArticle ? "na" : hasAuthor ? "ok" : "improve",
      summary: !isArticle ? "No se detecta autor, pero esta página no se declara como artículo/post (sin schema Article, og:type=article ni article:published_time): en landings y la home no suele aplicar." : hasAuthor ? "Se identifica un autor." : "Artículo sin autor identificado.",
      fix: "Muestra el autor (con enlace a su perfil) y márcalo con author en el JSON-LD.",
      sources: [src("Google: E-E-A-T y calidad de contenido", `${G}/fundamentals/creating-helpful-content#eeat`)],
    }),
    mk({
      id: "dates",
      category: "content",
      title: "Fechas de publicación/actualización",
      status: !isArticle ? "na" : hasDate ? "ok" : "improve",
      summary: !isArticle ? "No se detectan fechas, pero esta página no se declara como artículo/post: en landings y la home no suele ser necesario." : hasDate ? "Se detectan fechas de publicación/actualización." : "Artículo sin fecha de publicación ni de actualización.",
      fix: "Muestra la fecha visible (<time datetime>) y márcala con datePublished/dateModified.",
      sources: [src("Google: fechas en la Búsqueda", `${G}/appearance/publication-dates`)],
    })
  );

  // ===== 5. DATOS ESTRUCTURADOS =====
  const microdata = $("[itemscope]").length;
  if (jsonld.errors.length) {
    out.push(
      mk({
        id: "schema-valid",
        category: "schema",
        title: "JSON-LD válido",
        status: "fail",
        summary: `${jsonld.errors.length} bloque(s) JSON-LD con error de sintaxis (${trunc(jsonld.errors[0], 90)}): Google los ignora.`,
        fix: "Corrige el JSON (comas, comillas, llaves) y valídalo con la prueba de resultados enriquecidos.",
        sources: [src("Google: prueba de resultados enriquecidos", "https://search.google.com/test/rich-results")],
        weight: 2,
      })
    );
  }
  const contentNodes = jsonld.nodes.filter((n) => typesOf(n).some((t) => !STRUCTURAL.has(t)));
  const richProblems: { type: string; missing: string[]; doc: CheckSource; recommended: boolean }[] = [];
  const richOk: string[] = [];
  const seenRich = new Set<string>();
  for (const n of contentNodes) {
    for (const t of typesOf(n)) {
      const base = RICH[t] ? t : ALIAS[t];
      if (!base || !RICH[base]) continue;
      const key = t + JSON.stringify(Object.keys(n));
      if (seenRich.has(key)) continue;
      seenRich.add(key);
      const missing = RICH[base].missing(n);
      if (missing.length) richProblems.push({ type: t, missing, doc: RICH[base].doc, recommended: base === "Article" });
      else richOk.push(t);
    }
  }
  const contentTypes = [...new Set(contentNodes.flatMap(typesOf).filter((t) => !STRUCTURAL.has(t)))];
  out.push(
    mk({
      id: "schema-detected",
      category: "schema",
      title: "Datos estructurados Schema detectados",
      status: jsonld.blocks === 0 && microdata === 0 ? "improve" : contentTypes.length === 0 ? "improve" : richProblems.length ? "improve" : "ok",
      summary:
        jsonld.blocks === 0 && microdata === 0
          ? "No se detectan datos estructurados (JSON-LD ni microdatos)."
          : contentTypes.length === 0
            ? `Hay datos estructurados pero solo de identidad/estructura (${[...types].join(", ") || "microdatos"}); ninguno de contenido con resultado enriquecido.`
            : `${contentTypes.length} tipo(s) de contenido detectado(s): ${contentTypes.join(", ")}. ${
                richProblems.length ? `${richProblems.map((p) => `${p.type}: falta ${p.missing.join(", ")}`).join(" · ")} — sin esto no es elegible para resultado enriquecido.` : "Cumplen los requisitos de Google."
              }`,
      fix: richProblems.length
        ? `Completa los campos que faltan: ${richProblems.map((p) => `${p.type} → ${p.missing.join(", ")}`).join("; ")}.`
        : "Añade el JSON-LD del tipo que mejor describa la página (Product, Article, LocalBusiness, FAQPage…).",
      evidence: richProblems.flatMap((p) => [{ label: p.type, value: `falta ${p.missing.join(", ")}` }]),
      sources: [...richProblems.map((p) => p.doc), src("Google: introducción a los datos estructurados", `${G}/appearance/structured-data/intro-structured-data`)].slice(0, 3),
      weight: 2,
    })
  );
  out.push(
    mk({
      id: "schema-breadcrumb",
      category: "schema",
      title: "BreadcrumbList marcado",
      status: segs.length < 2 ? "na" : hasBreadcrumbSchema ? "ok" : "improve",
      summary: segs.length < 2 ? "En la home y en páginas de primer nivel no hace falta BreadcrumbList." : hasBreadcrumbSchema ? "Se detecta BreadcrumbList." : "No se detecta BreadcrumbList en JSON-LD.",
      fix: "Añade BreadcrumbList con itemListElement (position, name, item) que refleje la ruta de la página.",
      sources: [src("Google: BreadcrumbList", `${G}/appearance/structured-data/breadcrumb`)],
    })
  );
  const hasIdentity = [...types].some((t) => ["Organization", "WebSite", "LocalBusiness", "Corporation", "OnlineStore", "Person"].includes(t) || ALIAS[t] === "LocalBusiness");
  const sameAs = jsonld.nodes.some((n) => has(n, "sameAs"));
  out.push(
    mk({
      id: "schema-identity",
      category: "schema",
      title: "Identidad del sitio marcada (Organization / WebSite)",
      status: !ctx.isHome ? "na" : hasIdentity ? (sameAs ? "ok" : "improve") : "improve",
      summary: !ctx.isHome ? "Solo se evalúa en la home." : hasIdentity ? `Se detecta la identidad del sitio${sameAs ? " con sameAs" : " pero sin sameAs (perfiles de redes/Wikidata)"}.` : "No se detecta Organization ni WebSite. Son importantes en la home para vincular la entidad de marca.",
      fix: "Añade JSON-LD Organization (name, url, logo, sameAs con tus redes) y WebSite en la home.",
      sources: [src("Google: Organization", `${G}/appearance/structured-data/organization`)],
    })
  );
  out.push(
    mk({
      id: "schema-entities",
      category: "schema",
      title: "Marcado de entidades (about/mentions)",
      status: jsonld.nodes.some((n) => has(n, "about") || has(n, "mentions")) ? "ok" : "improve",
      summary: jsonld.nodes.some((n) => has(n, "about") || has(n, "mentions")) ? "Se usan about/mentions en el JSON-LD." : "No se usan las propiedades 'about'/'mentions' en el JSON-LD (opcional: refuerzan de qué trata la página para buscadores e IA).",
      fix: "En el WebPage/Article añade about y mentions apuntando a las entidades reales (con sameAs a Wikipedia/Wikidata).",
      advisory: true,
      weight: 0.25,
      sources: [src("Schema.org: about", "https://schema.org/about")],
    })
  );
  out.push(
    mk({
      id: "schema-article-author",
      category: "schema",
      title: "Autor y fechas en datos estructurados",
      status: !isArticle ? "na" : jsonld.nodes.some((n) => has(n, "author") && (has(n, "datePublished") || has(n, "dateModified"))) ? "ok" : "improve",
      summary: !isArticle ? "No aplica: author y fechas son propiedades de contenido redactado (artículos), no de esta página." : "Revisa author y datePublished/dateModified en el JSON-LD del artículo.",
      fix: "Añade author (Person con url), datePublished y dateModified al Article.",
      sources: [src("Google: Article", `${G}/appearance/structured-data/article`)],
    })
  );
  const hasProductNode = [...types].includes("Product");
  out.push(
    mk({
      id: "schema-product",
      category: "schema",
      title: "Producto con datos estructurados",
      status: !hasProductNode ? "na" : richProblems.some((p) => p.type === "Product") ? "improve" : "ok",
      summary: !hasProductNode ? "No aplica: no es una página de producto (sin schema Product)." : richProblems.some((p) => p.type === "Product") ? "Product incompleto." : "Product con los campos requeridos.",
      fix: "Añade offers (price, priceCurrency, availability), aggregateRating o review.",
      sources: [src("Google: Product", `${G}/appearance/structured-data/product-snippet`)],
    })
  );
  const hasVideo = $("video, iframe[src*='youtube'], iframe[src*='youtu.be'], iframe[src*='vimeo'], iframe[src*='dailymotion']").length > 0;
  out.push(
    mk({
      id: "schema-video",
      category: "schema",
      title: "Vídeo con datos estructurados",
      status: !hasVideo ? "na" : types.has("VideoObject") ? (richProblems.some((p) => p.type === "VideoObject") ? "improve" : "ok") : "improve",
      summary: !hasVideo ? "No se detecta ningún <video> ni iframe de YouTube/Vimeo/Dailymotion." : types.has("VideoObject") ? "VideoObject detectado." : "Hay vídeo embebido pero sin VideoObject.",
      fix: "Marca el vídeo con VideoObject (name, thumbnailUrl, uploadDate, description).",
      sources: [src("Google: VideoObject", `${G}/appearance/structured-data/video`)],
    })
  );
  if (isArticle) {
    const maxImg = /max-image-preview:\s*large/.test(directives);
    out.push(
      mk({
        id: "discover",
        category: "schema",
        title: "Preparado para Top Stories / Google Discover",
        status: maxImg && og("image") ? "ok" : "improve",
        summary: `${maxImg ? "Permite imágenes grandes (max-image-preview:large)" : "Falta max-image-preview:large en meta robots"} · ${og("image") ? "og:image presente" : "sin og:image"}.`,
        fix: 'Añade <meta name="robots" content="max-image-preview:large"> y una imagen de al menos 1200 px de ancho.',
        sources: [src("Google: Discover", `${G}/appearance/google-discover`)],
      })
    );
  }
  const hasReviewWidget = $("[class*='review' i], [class*='testimonial' i], [class*='opinion' i]").length > 0;
  const hasReviewSchema = jsonld.nodes.some((n) => has(n, "review") || has(n, "aggregateRating")) || types.has("Review");
  out.push(
    mk({
      id: "reviews",
      category: "eeat",
      title: "Reseñas/testimonios marcados",
      status: !hasReviewWidget && !hasReviewSchema ? "na" : hasReviewSchema ? "ok" : "improve",
      summary: !hasReviewWidget && !hasReviewSchema ? "No se detectan reseñas (ni JSON-LD ni widget visible); no aplica si no es una página de producto/servicio." : hasReviewSchema ? "Reseñas marcadas con review/aggregateRating." : "Hay reseñas/testimonios visibles pero sin marcado.",
      fix: "Marca las reseñas reales con AggregateRating/Review (nunca marques reseñas que no estén visibles en la página).",
      sources: [src("Google: Review snippet", `${G}/appearance/structured-data/review-snippet`)],
    })
  );

  // ===== 6. RENDIMIENTO =====
  const cc = h["cache-control"] ?? "";
  const noStore = /no-store|no-cache|max-age=0/i.test(cc);
  out.push(
    mk({
      id: "cache-headers",
      category: "perf",
      title: "Cabeceras de caché configuradas",
      status: !cc ? "improve" : noStore ? "improve" : "ok",
      summary: !cc ? "La respuesta HTML no envía Cache-Control." : `Cache-Control: «${cc}»${noStore ? " — la página no se cachea (normal en HTML dinámico; revisa que sí lo hagan los recursos estáticos)." : "."}`,
      fix: "Sirve los estáticos (JS, CSS, imágenes, fuentes) con Cache-Control: public, max-age=31536000, immutable; y el HTML con una caché corta o stale-while-revalidate.",
      sources: [src("web.dev: estrategias de caché HTTP", "https://web.dev/articles/http-cache")],
      weight: 0.5,
    })
  );
  const nodes = $("*").length;
  out.push(
    mk({
      id: "dom-size",
      category: "perf",
      title: "Tamaño del DOM",
      status: nodes <= 1500 ? "ok" : nodes <= 3000 ? "improve" : "fail",
      summary: `El HTML inicial tiene ${nodes} nodos${nodes > 1500 ? " (Lighthouse considera excesivo a partir de 1500)" : ""}; es solo el HTML crudo, el DOM final tras JavaScript puede ser mayor.`,
      fix: "Reduce el número de elementos: simplifica wrappers anidados y pagina/lazy-render las listas largas.",
      sources: [src("Lighthouse: tamaño del DOM", "https://developer.chrome.com/docs/lighthouse/performance/dom-size")],
      weight: 1,
    })
  );
  const mb = ctx.htmlBytes / 1_048_576;
  out.push(
    mk({
      id: "html-size",
      category: "perf",
      title: "Tamaño del documento HTML",
      status: ctx.htmlBytes < 1_048_576 ? "ok" : ctx.htmlBytes < 2_097_152 ? "improve" : "fail",
      summary: `El HTML inicial pesa ${mb.toFixed(2)} MB (${ctx.htmlBytes} bytes)${ctx.htmlBytes >= 2_097_152 ? ": Googlebot solo procesa los primeros 2 MB de cada archivo" : ""}.`,
      fix: "Saca CSS/JS en línea a archivos externos y elimina datos serializados innecesarios del HTML.",
      sources: [src("Google: Googlebot y límites de rastreo", `${G}/crawling-indexing/googlebot`)],
      weight: 1,
    })
  );
  const enc = (h["content-encoding"] ?? "").toLowerCase();
  out.push(
    mk({
      id: "compression",
      category: "perf",
      title: "Compresión Brotli/Gzip activa",
      status: /br|gzip|zstd|deflate/.test(enc) ? "ok" : "fail",
      summary: enc ? `Content-Encoding: «${enc}».` : "El HTML se sirve sin comprimir.",
      fix: "Activa compresión Brotli (o Gzip) en el servidor/CDN para HTML, CSS, JS y SVG.",
      sources: [src("Lighthouse: compresión de texto", "https://developer.chrome.com/docs/lighthouse/performance/uses-text-compression")],
      weight: 1,
    })
  );
  const noDims = imgs.filter((el) => !(($(el).attr("width") && $(el).attr("height")) || /aspect-ratio/.test($(el).attr("style") ?? "")));
  out.push(
    mk({
      id: "img-dimensions",
      category: "perf",
      title: "Imágenes con dimensiones reservadas",
      status: imgs.length === 0 ? "na" : noDims.length === 0 ? "ok" : "improve",
      summary: imgs.length === 0 ? "La página no tiene imágenes <img>." : noDims.length === 0 ? `Las ${imgs.length} imágenes declaran width/height (o aspect-ratio).` : `${noDims.length} de ${imgs.length} imágenes sin width/height: provocan saltos de diseño (CLS).`,
      fix: "Añade width y height (o aspect-ratio en CSS) a cada imagen para reservar el espacio antes de cargar.",
      sources: [src("web.dev: dimensiones de imágenes y CLS", "https://web.dev/articles/optimize-cls#images-without-dimensions")],
    })
  );
  const below = imgs.slice(3);
  const notLazy = below.filter((el) => $(el).attr("loading") !== "lazy");
  out.push(
    mk({
      id: "img-lazy",
      category: "perf",
      title: "Carga diferida de imágenes fuera del viewport",
      status: below.length === 0 ? "na" : notLazy.length === 0 ? "ok" : notLazy.length / below.length > 0.5 ? "improve" : "ok",
      summary: below.length === 0 ? "Hay 3 o menos imágenes: no hay nada que diferir." : notLazy.length === 0 ? `Las ${below.length} imágenes evaluadas (fuera de las 3 primeras) usan lazy-load.` : `${notLazy.length} de ${below.length} imágenes fuera de las 3 primeras no usan loading="lazy".`,
      fix: 'Añade loading="lazy" a las imágenes que no se ven al cargar (no a la imagen LCP).',
      sources: [src("web.dev: lazy-loading de imágenes", "https://web.dev/articles/browser-level-image-lazy-loading")],
      weight: 0.5,
    })
  );
  const blocking = $("head script[src]:not([async]):not([defer]):not([type='module'])").length;
  out.push(
    mk({
      id: "render-blocking",
      category: "perf",
      title: "Scripts que bloquean el renderizado",
      status: blocking === 0 ? "ok" : blocking <= 2 ? "improve" : "fail",
      summary: blocking === 0 ? "No hay <script src> síncronos en el <head>." : `${blocking} script(s) en el <head> sin async/defer bloquean el pintado de la página.`,
      fix: "Añade defer (o async) a los scripts del <head>, o muévelos al final del <body>.",
      sources: [src("web.dev: recursos que bloquean el renderizado", "https://web.dev/articles/render-blocking-resources")],
      weight: 0.5,
    })
  );
  const thirdOrigins = new Set<string>();
  $("script[src], img[src], iframe[src], link[rel='stylesheet'][href]").each((_, el) => {
    const u = $(el).attr("src") ?? $(el).attr("href");
    try {
      if (u) {
        const o = new URL(u, ctx.finalUrl).origin;
        if (o !== origin && o.startsWith("http")) thirdOrigins.add(o);
      }
    } catch {
      /* ignora */
    }
  });
  const preconnects = new Set<string>();
  $('link[rel="preconnect"], link[rel="dns-prefetch"]').each((_, el) => {
    try {
      preconnects.add(new URL($(el).attr("href") ?? "", ctx.finalUrl).origin);
    } catch {
      /* ignora */
    }
  });
  const missingPre = [...thirdOrigins].filter((o) => !preconnects.has(o));
  out.push(
    mk({
      id: "preconnect",
      category: "perf",
      title: "Preconnect/dns-prefetch a orígenes de terceros",
      status: thirdOrigins.size === 0 ? "na" : missingPre.length === 0 ? "ok" : "improve",
      summary: thirdOrigins.size === 0 ? "La página no carga recursos desde ningún origen de terceros; no aplica." : missingPre.length === 0 ? "Los orígenes de terceros tienen preconnect/dns-prefetch." : `${missingPre.length} origen(es) de terceros sin preconnect: ${list(missingPre, 3)}.`,
      fix: 'Añade <link rel="preconnect" href="ORIGEN"> para los 1-3 terceros críticos.',
      sources: [src("web.dev: preconnect y dns-prefetch", "https://web.dev/articles/preconnect-and-dns-prefetch")],
      weight: 0.5,
    })
  );
  const vids = $("video");
  out.push(
    mk({
      id: "video-lazy",
      category: "perf",
      title: "Carga diferida de vídeos",
      status: vids.length === 0 ? "na" : vids.toArray().every((v) => $(v).attr("preload") === "none" || $(v).attr("loading") === "lazy") ? "ok" : "improve",
      summary: vids.length === 0 ? "La página no contiene elementos <video>; no aplica." : "Hay <video> sin preload=\"none\".",
      fix: 'Usa preload="none" y un poster en los vídeos que no son el contenido principal.',
      sources: [src("web.dev: lazy-loading de vídeo", "https://web.dev/articles/lazy-loading-video")],
      weight: 0.5,
    })
  );
  // Core Web Vitals (PageSpeed / CrUX)
  const f = ctx.psi?.fieldData ?? null;
  const cwv = (id: string, name: string, doc: string, field: { percentile: number | null; category: string | null } | null | undefined, lab: number | null, unit: string, fmt: (n: number) => string, labGood: number, labPoor: number, fix: string): DeepCheck => {
    const cat = field?.category?.toUpperCase() ?? null;
    let status: CheckStatus = "na";
    let summary = "";
    if (cat) {
      status = cat === "FAST" ? "ok" : cat === "AVERAGE" ? "improve" : "fail";
      summary = `Dato real de usuarios (CrUX, ${f?.source === "origin" ? "todo el dominio" : "esta URL"}): ${field?.percentile != null ? fmt(field.percentile) : "—"} → ${cat === "FAST" ? "bueno" : cat === "AVERAGE" ? "mejorable" : "lento"}.`;
    } else if (lab != null) {
      status = lab <= labGood ? "ok" : lab <= labPoor ? "improve" : "fail";
      summary = `Sin datos de usuarios reales (CrUX); medición de laboratorio (Lighthouse, simulada): ${fmt(lab)}${unit}.`;
    } else {
      summary = ctx.psi ? "PageSpeed no devolvió este dato." : "No se ha podido medir: falta la clave de PageSpeed Insights (Configuración) o la API no respondió.";
    }
    return mk({ id, category: "perf", title: name, status, summary, fix, sources: [src(`web.dev: ${name}`, doc)], weight: 1.5 });
  };
  out.push(
    cwv("cwv-lcp", "LCP (Largest Contentful Paint)", "https://web.dev/articles/lcp", f?.lcp, ctx.psi?.lcpMs ?? null, "", (n) => `${(n / 1000).toFixed(2)} s`, 2500, 4000, "Optimiza la imagen/elemento LCP: precarga (fetchpriority=high), formato WebP/AVIF, servidor más rápido y sin lazy-load en ella."),
    cwv("cwv-inp", "INP (Interaction to Next Paint)", "https://web.dev/articles/inp", f?.inp, ctx.psi?.inpMs ?? null, "", (n) => `${Math.round(n)} ms`, 200, 500, "Reduce el JavaScript en el hilo principal: divide tareas largas, difiere scripts de terceros."),
    cwv("cwv-cls", "CLS (Cumulative Layout Shift)", "https://web.dev/articles/cls", f?.cls ? { ...f.cls, percentile: f.cls.percentile != null ? f.cls.percentile / 100 : null } : null, ctx.psi?.cls ?? null, "", (n) => n.toFixed(n < 1 ? 2 : 1).replace(/\.00$/, ""), 0.1, 0.25, "Reserva espacio para imágenes, anuncios y fuentes (width/height, aspect-ratio, font-display).")
  );
  const ttfbF = f?.ttfb;
  out.push(
    mk({
      id: "cwv-ttfb",
      category: "perf",
      title: "TTFB (tiempo hasta el primer byte)",
      status: ttfbF?.category ? (ttfbF.category.toUpperCase() === "FAST" ? "ok" : ttfbF.category.toUpperCase() === "AVERAGE" ? "improve" : "fail") : "na",
      summary: ttfbF?.category ? `Dato real de usuarios (CrUX): ${ttfbF.percentile != null ? Math.round(ttfbF.percentile) + " ms" : "—"} → ${ttfbF.category.toLowerCase()}.` : "Sin datos de usuarios reales (CrUX) para TTFB en esta URL/dominio.",
      fix: "Mejora el servidor: caché de página/CDN, consultas más rápidas y menos redirecciones.",
      sources: [src("web.dev: TTFB", "https://web.dev/articles/ttfb")],
    })
  );

  // ===== 7. MÓVIL Y ACCESIBILIDAD =====
  const GENERIC_LINK = /^(ver m[aá]s|leer m[aá]s|m[aá]s|m[aá]s info(rmaci[oó]n)?|saber m[aá]s|click aqu[ií]|clic aqu[ií]|haz clic aqu[ií]|aqu[ií]|pincha aqu[ií]|read more|learn more|more|click here|here|ver|ver todo|continuar)\.?$/i;
  const genericLinks: string[] = [];
  const emptyLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    const aria = ($(el).attr("aria-label") ?? "") + ($(el).attr("aria-labelledby") ? "x" : "") + ($(el).attr("title") ?? "");
    const hasImgAlt = $(el).find("img[alt]").filter((_, i) => !!$(i).attr("alt")?.trim()).length > 0 || $(el).find("svg title").length > 0;
    const href = $(el).attr("href") ?? "";
    if (!t && !aria.trim() && !hasImgAlt) emptyLinks.push(href);
    else if (GENERIC_LINK.test(t) && !($(el).attr("aria-label") ?? "").trim()) genericLinks.push(`«${t}» → ${href}`);
  });
  out.push(
    mk({
      id: "link-text",
      category: "a11y",
      title: "Enlaces sin texto descriptivo",
      status: genericLinks.length === 0 ? "ok" : "improve",
      summary: genericLinks.length === 0 ? "Los enlaces tienen texto descriptivo." : `Se encuentran ${genericLinks.length} enlace(s) con texto genérico («leer más», «click aquí»…): fuera de contexto no dicen a dónde llevan.`,
      fix: 'Cambia el texto por uno que describa el destino («Ver el plan Pro») o añade aria-label descriptivo al enlace.',
      evidence: genericLinks.slice(0, 6).map((l) => ({ label: "Enlace", value: trunc(l, 110) })),
      sources: [src("W3C WCAG 2.4.4: propósito del enlace", "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html")],
    }),
    mk({
      id: "link-empty",
      category: "a11y",
      title: "Enlaces sin nombre accesible",
      status: emptyLinks.length === 0 ? "ok" : "fail",
      summary: emptyLinks.length === 0 ? "Todos los enlaces tienen texto, aria-label o imagen con alt." : `${emptyLinks.length} enlace(s) sin texto ni aria-label (por ejemplo iconos): un lector de pantalla solo dice «enlace».`,
      fix: "Añade aria-label al enlace con el destino o alt a la imagen/icono que contiene.",
      evidence: emptyLinks.slice(0, 5).map((l) => ({ label: "href", value: trunc(l, 100) })),
      sources: [src("W3C WCAG 2.4.4", "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html")],
    })
  );
  const vp = $('meta[name="viewport"]').attr("content") ?? "";
  const blocksZoom = /user-scalable\s*=\s*(no|0)/i.test(vp) || /maximum-scale\s*=\s*1(\.0)?(\s|,|$)/i.test(vp);
  out.push(
    mk({
      id: "viewport",
      category: "a11y",
      title: "Meta viewport correcta y sin bloquear el zoom",
      status: !vp ? "fail" : !/width\s*=\s*device-width/i.test(vp) ? "fail" : blocksZoom ? "improve" : "ok",
      summary: !vp ? "Falta <meta name=\"viewport\">: la página no es responsive en móvil." : `viewport='${vp}': ${!/width\s*=\s*device-width/i.test(vp) ? "no incluye width=device-width" : blocksZoom ? "bloquea el zoom táctil" : "incluye width=device-width y no bloquea el zoom"}.`,
      fix: 'Usa <meta name="viewport" content="width=device-width, initial-scale=1"> sin user-scalable=no ni maximum-scale=1.',
      sources: [src("Lighthouse: viewport", "https://developer.chrome.com/docs/lighthouse/seo/viewport")],
      weight: 2,
    })
  );
  // Formularios
  const fields = $("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=reset]), select, textarea").toArray();
  const unlabeled = fields.filter((el) => {
    const id = $(el).attr("id");
    if ($(el).attr("aria-label")?.trim() || $(el).attr("aria-labelledby") || $(el).attr("title")?.trim()) return false;
    if (id && $(`label[for="${id}"]`).length) return false;
    if ($(el).closest("label").length) return false;
    return true;
  });
  out.push(
    mk({
      id: "form-labels",
      category: "a11y",
      title: "Campos de formulario con <label> asociado",
      status: fields.length === 0 ? "na" : unlabeled.length === 0 ? "ok" : "fail",
      summary: fields.length === 0 ? "La página no tiene campos de formulario." : unlabeled.length === 0 ? `Los ${fields.length} campos de formulario tienen etiqueta asociada.` : `${unlabeled.length} de ${fields.length} campos sin <label> ni aria-label (el placeholder no cuenta).`,
      fix: "Asocia un <label for> a cada campo (o aria-label si el diseño no admite etiqueta visible).",
      sources: [src("W3C WCAG: etiquetas o instrucciones", "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html")],
    })
  );
  const buttons = $("button, [role='button'], input[type=submit], input[type=button]").toArray();
  const unnamedBtn = buttons.filter((el) => {
    const t = $(el).text().trim();
    const v = $(el).attr("value");
    return !t && !v?.trim() && !$(el).attr("aria-label")?.trim() && !$(el).attr("aria-labelledby") && !$(el).attr("title")?.trim() && !$(el).find("img[alt]:not([alt=''])").length && !$(el).find("svg title").length;
  });
  out.push(
    mk({
      id: "button-names",
      category: "a11y",
      title: "Botones con nombre accesible",
      status: buttons.length === 0 ? "na" : unnamedBtn.length === 0 ? "ok" : "fail",
      summary: buttons.length === 0 ? "No hay botones." : unnamedBtn.length === 0 ? `Los ${buttons.length} botones/controles tienen nombre accesible.` : `${unnamedBtn.length} de ${buttons.length} botones sin nombre accesible (solo icono).`,
      fix: "Añade aria-label (o texto visualmente oculto) a los botones que solo llevan un icono.",
      sources: [src("W3C: fallo F84 (controles sin nombre)", "https://www.w3.org/WAI/WCAG22/Techniques/failures/F84")],
    })
  );
  const SEM = ["main", "article", "nav", "header", "footer"];
  const semPresent = SEM.filter((t) => $(t).length > 0);
  out.push(
    mk({
      id: "semantic-html",
      category: "a11y",
      title: "Uso de etiquetas HTML semánticas",
      status: !semPresent.includes("main") ? "improve" : semPresent.length >= 3 ? "ok" : "improve",
      summary: `${semPresent.length} de ${SEM.length} etiquetas semánticas presentes (${semPresent.join(", ") || "ninguna"}). <div>/<span>: ${$("div, span").length} de ${nodes} elementos.`,
      fix: "Envuelve el contenido principal en <main> y usa <header>, <nav>, <footer> (y <article>/<section> donde toque) en lugar de <div> genéricos.",
      sources: [src("MDN: HTML semántico", "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/HTML_layout")],
      weight: 0.5,
    })
  );
  const skip = $("a[href^='#']").toArray().some((el) => /saltar|skip|ir al contenido|main/i.test($(el).text() + ($(el).attr("href") ?? "")) );
  out.push(
    mk({
      id: "skip-link",
      category: "a11y",
      title: 'Enlace "saltar al contenido"',
      status: skip ? "ok" : "improve",
      summary: skip ? "Se ha encontrado un enlace de salto al contenido principal, útil para navegación por teclado." : "No hay enlace «saltar al contenido»: quien navega con teclado debe tabular por todo el menú en cada página.",
      fix: 'Añade como primer elemento del <body>: <a href="#main" class="sr-only focus:not-sr-only">Saltar al contenido</a> y un id="main" en el <main>.',
      sources: [src("W3C: técnica G1 (enlace de salto)", "https://www.w3.org/WAI/WCAG22/Techniques/general/G1")],
      weight: 0.5,
    })
  );
  const posTab = $("[tabindex]").toArray().filter((el) => Number($(el).attr("tabindex")) > 0).length;
  out.push(
    mk({
      id: "tabindex",
      category: "a11y",
      title: "Sin tabindex positivo (orden de tabulación)",
      status: posTab ? "improve" : "ok",
      summary: posTab ? `${posTab} elemento(s) con tabindex positivo rompen el orden natural de tabulación.` : "No se usa ningún tabindex positivo; el orden de tabulación sigue el del documento.",
      fix: "Quita los tabindex > 0 y reordena el HTML en el orden lógico de lectura.",
      sources: [src("web.dev: control del foco con tabindex", "https://web.dev/articles/control-focus-with-tabindex")],
      weight: 0.5,
    })
  );
  const iframes = $("iframe").toArray();
  const noTitleIframes = iframes.filter((el) => !$(el).attr("title")?.trim());
  out.push(
    mk({
      id: "iframe-title",
      category: "a11y",
      title: "Iframes con título accesible",
      status: iframes.length === 0 ? "na" : noTitleIframes.length === 0 ? "ok" : "improve",
      summary: iframes.length === 0 ? "La página no contiene ningún <iframe>." : noTitleIframes.length === 0 ? "Todos los iframes tienen title." : `${noTitleIframes.length} de ${iframes.length} iframes sin atributo title.`,
      fix: "Añade title descriptivo a cada <iframe>.",
      sources: [src("W3C: técnica H64", "https://www.w3.org/WAI/WCAG22/Techniques/html/H64")],
      weight: 0.5,
    })
  );
  const dataTables = $("table").toArray().filter((t) => $(t).find("tr").length >= 2 && $(t).find("tr").first().children("td, th").length >= 2);
  const noTh = dataTables.filter((t) => $(t).find("th").length === 0);
  out.push(
    mk({
      id: "table-headers",
      category: "a11y",
      title: "Tablas de datos con cabeceras (<th>)",
      status: dataTables.length === 0 ? "na" : noTh.length === 0 ? "ok" : "improve",
      summary: dataTables.length === 0 ? "La página no contiene tablas de datos (≥2 filas y ≥2 columnas)." : noTh.length === 0 ? "Las tablas de datos usan <th>." : `${noTh.length} de ${dataTables.length} tablas sin celdas <th>.`,
      fix: 'Marca las cabeceras con <th scope="col|row">.',
      sources: [src("WebAIM: tablas de datos accesibles", "https://webaim.org/techniques/tables/data")],
      weight: 0.5,
    })
  );

  // ===== 8. E-E-A-T =====
  const linkPool = $("a[href]").toArray().map((el) => ({ t: $(el).text().toLowerCase().replace(/\s+/g, " ").trim(), h: ($(el).attr("href") ?? "").toLowerCase() }));
  const find = (re: RegExp) => linkPool.some((l) => re.test(l.t) || re.test(l.h));
  const trustLinks = {
    Contacto: find(/contact|escr[ií]benos|hablemos/),
    "Sobre nosotros": find(/sobre[- ]nosotros|quienes[- ]somos|qui[eé]nes somos|about|equipo|nosotros/),
    "Aviso legal": find(/aviso[- ]legal|legal|t[eé]rminos|terms|condiciones/),
    Privacidad: find(/privacidad|privacy|protecci[oó]n[- ]de[- ]datos|cookies/),
  };
  const missingTrust = Object.entries(trustLinks).filter(([, v]) => !v).map(([k]) => k);
  out.push(
    mk({
      id: "trust-pages",
      category: "eeat",
      title: "Enlaces a contacto, sobre nosotros, aviso legal y privacidad",
      status: missingTrust.length === 0 ? "ok" : "improve",
      summary: `Comprobado solo en esta página — pueden existir enlazados desde otra sección. ${missingTrust.length ? "Sin encontrar: " + missingTrust.join(", ") + "." : "Se enlazan las cuatro."}`,
      fix: `Enlaza desde el pie de página: ${missingTrust.join(", ")}. Las señales de transparencia refuerzan la confianza (E-E-A-T).`,
      evidence: Object.entries(trustLinks).map(([k, v]) => ({ label: k, value: v ? "Enlazado" : "No encontrado" })),
      sources: [src("Google: E-E-A-T y calidad de contenido", `${G}/fundamentals/creating-helpful-content#eeat`)],
      weight: 1.5,
    })
  );
  const secH = [
    { name: "Strict-Transport-Security", ok: !!h["strict-transport-security"], v: h["strict-transport-security"] },
    { name: "X-Content-Type-Options", ok: /nosniff/i.test(h["x-content-type-options"] ?? ""), v: h["x-content-type-options"] },
    { name: "Content-Security-Policy", ok: !!h["content-security-policy"], v: h["content-security-policy"] },
    { name: "X-Frame-Options / frame-ancestors", ok: !!h["x-frame-options"] || /frame-ancestors/i.test(h["content-security-policy"] ?? ""), v: h["x-frame-options"] ?? (/frame-ancestors[^;]*/i.exec(h["content-security-policy"] ?? "")?.[0]) },
    { name: "Referrer-Policy", ok: !!h["referrer-policy"], v: h["referrer-policy"] },
  ];
  const missSec = secH.filter((x) => !x.ok).map((x) => x.name);
  out.push(
    mk({
      id: "security-headers",
      category: "eeat",
      title: "Cabeceras de seguridad HTTP",
      status: missSec.length === 0 ? "ok" : missSec.length <= 2 ? "improve" : "fail",
      summary: `${secH.length - missSec.length} de ${secH.length} cabeceras de seguridad presentes.${missSec.length ? " Faltan: " + missSec.join(", ") + "." : ""}`,
      fix: `Configura en el servidor/CDN: ${missSec.map((m) => (m.startsWith("Strict") ? "Strict-Transport-Security: max-age=31536000; includeSubDomains" : m.startsWith("X-Content") ? "X-Content-Type-Options: nosniff" : m.startsWith("Referrer") ? "Referrer-Policy: strict-origin-when-cross-origin" : m.startsWith("Content") ? "una Content-Security-Policy" : "X-Frame-Options: SAMEORIGIN (o frame-ancestors)")).join("; ")}.`,
      evidence: secH.map((x) => ({ label: x.name, value: x.v ? trunc(x.v, 90) : "(falta)" })),
      sources: [src("MDN: Strict-Transport-Security", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security"), src("web.dev: cabeceras de seguridad", "https://web.dev/articles/security-headers")],
    })
  );
  const mixed: string[] = [];
  if (final.protocol === "https:") {
    $("script[src], img[src], link[href][rel~='stylesheet'], iframe[src], video[src], audio[src], source[src]").each((_, el) => {
      const u = $(el).attr("src") ?? $(el).attr("href") ?? "";
      if (/^http:\/\//i.test(u)) mixed.push(u);
    });
  }
  out.push(
    mk({
      id: "mixed-content",
      category: "eeat",
      title: "Sin contenido mixto (recursos http:// en página https://)",
      status: final.protocol !== "https:" ? "fail" : mixed.length ? "fail" : "ok",
      summary: final.protocol !== "https:" ? "La página se sirve por HTTP, sin cifrado." : mixed.length ? `${mixed.length} recurso(s) cargados por http:// en una página https://: ${list(mixed, 3)}.` : "No se detectan recursos (script/img/link/iframe/video/audio) cargados por http://.",
      fix: "Cambia las URLs http:// a https:// (o relativas al protocolo).",
      sources: [src("web.dev: contenido mixto", "https://web.dev/articles/what-is-mixed-content")],
      weight: 1.5,
    })
  );
  const text = wholeText;
  const phone = /(?:\+34[\s.-]?)?(?:[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}|[6789]\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})/.test(text) || $("a[href^='tel:']").length > 0;
  const addr = $("address").length > 0 || jsonld.nodes.some((n) => has(n, "address")) || /\b(calle|c\/|avda\.?|avenida|plaza|paseo|carrer|camino|ronda)\s+[\wÁÉÍÓÚáéíóúñÑ .'-]{2,40}[, ]+\d{1,4}/i.test(text);
  const nif = /\b([ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-HJ-NP-TV-Z])\b/.test(text);
  out.push(
    mk({
      id: "business-data",
      category: "eeat",
      title: "Datos de empresa verificables en la página",
      status: phone && addr && nif ? "ok" : phone || addr || nif ? "improve" : "improve",
      summary: `Heurística textual (no una verificación contra el registro mercantil): teléfono ${phone ? "detectado" : "no detectado"} · dirección ${addr ? "detectada" : "no detectada"} · NIF/CIF/VAT ${nif ? "detectado" : "no detectado"}.`,
      fix: "Muestra teléfono, dirección y datos fiscales (NIF/CIF) en la página de contacto/aviso legal y en el pie; refuerzan la confianza.",
      evidence: [{ label: "Teléfono", value: phone ? "Detectado" : "No detectado" }, { label: "Dirección", value: addr ? "Detectada" : "No detectada" }, { label: "NIF / CIF / VAT", value: nif ? "Detectado" : "No detectado" }],
      sources: [src("Google: E-E-A-T", `${G}/fundamentals/creating-helpful-content#eeat`)],
      weight: 0.5,
    })
  );

  // ===== 9. INTERNACIONAL =====
  const ogLocale = $('meta[property="og:locale"]').attr("content")?.trim() ?? "";
  out.push(
    mk({
      id: "og-locale",
      category: "intl",
      title: "og:locale coherente con lang",
      status: !ogLocale || !lang ? "na" : ogLocale.slice(0, 2).toLowerCase() === lang.slice(0, 2).toLowerCase() ? "ok" : "improve",
      summary: !ogLocale ? "No hay og:locale." : !lang ? "No hay lang en <html> con el que compararlo." : `og:locale='${ogLocale}' ${ogLocale.slice(0, 2).toLowerCase() === lang.slice(0, 2).toLowerCase() ? "coincide en idioma con" : "NO coincide con"} lang='${lang}'.`,
      fix: "Haz que og:locale (es_ES) y <html lang> indiquen el mismo idioma.",
      sources: [src("The Open Graph protocol", "https://ogp.me/")],
      weight: 0.5,
    })
  );
  const alts = $('link[rel="alternate"][hreflang]').toArray().map((el) => ({ code: ($(el).attr("hreflang") ?? "").trim(), href: $(el).attr("href") ?? "" }));
  if (alts.length) {
    const BAD = alts.filter((a) => !(a.code.toLowerCase() === "x-default" || /^[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|\d{3}))?$/.test(a.code)));
    const self = alts.some((a) => { try { return norm(new URL(a.href, ctx.finalUrl).toString()) === norm(ctx.finalUrl); } catch { return false; } });
    const xdef = alts.some((a) => a.code.toLowerCase() === "x-default");
    const dups = alts.length - new Set(alts.map((a) => a.code.toLowerCase())).size;
    const probs: string[] = [];
    if (BAD.length) probs.push(`códigos no válidos (${BAD.map((b) => b.code).join(", ")})`);
    if (!self) probs.push("falta la referencia a sí misma");
    if (!xdef) probs.push("falta x-default");
    if (dups) probs.push("códigos duplicados");
    if (alts.some((a) => !/^https?:\/\//i.test(a.href))) probs.push("URLs no absolutas");
    out.push(
      mk({
        id: "hreflang",
        category: "intl",
        title: "hreflang correcto",
        status: BAD.length || !self || dups ? "fail" : probs.length ? "improve" : "ok",
        summary: `${alts.length} etiqueta(s) hreflang${probs.length ? ": " + probs.join("; ") : ": códigos válidos, autorreferencia y x-default presentes"}. (La reciprocidad se comprueba aparte.)`,
        fix: "Cada versión debe listar TODAS las versiones (incluida ella misma) con códigos ISO válidos (es, es-ES, en-GB) y un x-default, con URLs absolutas.",
        evidence: alts.slice(0, 8).map((a) => ({ label: a.code, value: trunc(a.href, 100) })),
        sources: [src("Google: hreflang para contenido localizado", `${G}/specialty/international/localized-versions`)],
        weight: 2,
      })
    );
  } else {
    out.push(
      mk({
        id: "hreflang",
        category: "intl",
        title: "hreflang no aplica o no está presente",
        status: "na",
        summary: "No se han encontrado etiquetas hreflang ni señales de versiones por idioma/país. Si el sitio SÍ las tiene por otra vía (subdominio, TLD, detección por IP), revísalo manualmente.",
        sources: [src("Google: hreflang para contenido localizado", `${G}/specialty/international/localized-versions`)],
      })
    );
  }

  // ===== 10. AI SEO (parte página) =====
  const aiToolAttr = $("form[toolname], [toolname]").length > 0;
  const aiToolJs = /modelContext\s*\.\s*registerTool|navigator\.modelContext/.test(ctx.html);
  out.push(
    mk({
      id: "webmcp",
      category: "ai",
      title: "Herramientas WebMCP para agentes de IA",
      status: aiToolAttr || aiToolJs ? "ok" : "improve",
      summary: aiToolAttr || aiToolJs ? "Se detectan herramientas WebMCP." : "No se detectan herramientas WebMCP (ni el atributo 'toolname' en formularios ni registerTool() en scripts en línea). Es una propuesta muy reciente; su ausencia no es (todavía) un fallo establecido. No detecta registros que vivan solo en un JS externo.",
      fix: "Si tu web tiene acciones clave (buscar, reservar, comprar), expónlas como herramientas WebMCP (atributos toolname/tooldescription en el formulario).",
      advisory: true,
      weight: 0.25,
      sources: [src("WebMCP: especificación (W3C Web ML CG)", "https://github.com/webmachinelearning/webmcp")],
    })
  );
  const rootEmpty = $("#root, #app, #__next, #__nuxt").toArray().some((el) => $(el).text().trim().length < 50) && wordCount < 100;
  out.push(
    mk({
      id: "ai-initial-html",
      category: "ai",
      title: "Contenido presente en el HTML inicial (sin ejecutar JS)",
      status: wordCount >= 200 ? "ok" : wordCount >= 80 && !rootEmpty ? "improve" : "fail",
      summary: `El HTML inicial contiene ~${wordCount} palabras de texto visible sin ejecutar JavaScript.${wordCount < 200 ? " Los rastreadores de IA y muchos buscadores no ejecutan JS: verán una página casi vacía." : ""}`,
      fix: "Renderiza el contenido en el servidor (SSR/SSG) para que el HTML ya lo incluya.",
      evidence: [{ label: "palabras", value: String(wordCount) }, { label: "<script>", value: String($("script").length) }],
      sources: [src("Google: SEO para JavaScript", `${G}/crawling-indexing/javascript/javascript-seo-basics`)],
      weight: 2,
    })
  );

  return out;
}
