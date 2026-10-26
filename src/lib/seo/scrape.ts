import * as cheerio from "cheerio";
import { safeFetchHtml, SafeFetchError } from "@/lib/net/safe-fetch";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
const BODY_TEXT_MAX_CHARS = 3000;

export type ScrapeErrorCode = "timeout" | "fetch_failed" | "http_error" | "empty_content";

export class ScrapeError extends Error {
  code: ScrapeErrorCode;

  constructor(code: ScrapeErrorCode, message: string) {
    super(message);
    this.name = "ScrapeError";
    this.code = code;
  }
}

export type ScrapedPage = {
  title: string;
  metaDescription: string;
  h1: string;
  headings: { tag: "h2" | "h3"; text: string }[];
  bodyText: string;
  canonicalUrl: string | null;
  articleMeta: { publishedTime: string | null; author: string | null };
};

export async function scrapePage(url: string, timeoutMs = 10000): Promise<ScrapedPage> {
  // Descarga con protección SSRF (src/lib/net/safe-fetch.ts): las URLs las
  // escribe el usuario, así que no se admiten hosts internos ni redirecciones a ellos.
  let html: string;
  try {
    const page = await safeFetchHtml(url, { timeoutMs, userAgent: USER_AGENT });
    if (page.status < 200 || page.status >= 300) {
      throw new ScrapeError("http_error", `La URL respondió con estado ${page.status}`);
    }
    html = page.body;
  } catch (error) {
    if (error instanceof ScrapeError) throw error;
    if (error instanceof SafeFetchError) {
      if (error.code === "timeout") throw new ScrapeError("timeout", "Esa web no responde desde los servidores de Crawlea (tarda más de 10 segundos). Si se abre bien en tu navegador, puede que su cortafuegos esté bloqueando las conexiones de Crawlea: pide a quien la aloja que las permita.");
      if (error.code === "blocked" || error.code === "invalid_url") throw new ScrapeError("fetch_failed", error.message);
    }
    throw new ScrapeError("fetch_failed", "No se ha podido acceder a esa URL desde los servidores de Crawlea. Comprueba que está bien escrita y que la web no bloquea las conexiones de Crawlea.");
  }

  const $ = cheerio.load(html);
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const publishedTime =
    $('meta[property="article:published_time"]').attr("content")?.trim() || null;
  const author =
    $('meta[property="article:author"]').attr("content")?.trim() ||
    $('[rel="author"]').first().text().trim() ||
    null;

  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || "";
  const h1 = $("h1").first().text().trim();

  $("script, style, noscript, iframe, svg, nav, footer, header").remove();

  const headings: { tag: "h2" | "h3"; text: string }[] = [];
  $("h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    const tag = el.tagName?.toLowerCase() === "h3" ? "h3" : "h2";
    if (text) headings.push({ tag, text });
  });

  let bodyText = "";
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) bodyText += text + " ";
    if (bodyText.length > BODY_TEXT_MAX_CHARS) return false;
  });
  bodyText = bodyText.slice(0, BODY_TEXT_MAX_CHARS).trim();

  if (!title && !h1 && !bodyText) {
    throw new ScrapeError(
      "empty_content",
      "No se ha encontrado contenido en la página (puede requerir JavaScript para renderizarse)"
    );
  }

  return {
    title,
    metaDescription,
    h1,
    headings,
    bodyText,
    canonicalUrl,
    articleMeta: { publishedTime, author },
  };
}
