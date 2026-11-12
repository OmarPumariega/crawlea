// Orquesta la auditoría profunda de UNA página (la de inicio): descarga el
// HTML una vez, corre los checks puros y los de red, y puntúa. Sin
// persistencia: la guarda el job de auditoría (AuditRun.deepChecks).
import { lookup } from "node:dns/promises";
import * as cheerio from "cheerio";
import { isBlockedIp } from "@/lib/net/safe-fetch";
import { CRAWLER_USER_AGENT } from "@/lib/audit/robots";
import { runPageChecks, type PsiLike } from "./page-checks";
import { runSiteChecks } from "./site-checks";
import { fetchRobotsTxt, loadSitemapInfo } from "./discover";
import { scoreChecks, type DeepResult } from "./types";

export type PrefetchedPage = {
  finalUrl: string;
  status: number;
  redirected: boolean;
  headers: Record<string, string>; // claves en minúsculas
  html: string;
  htmlBytes: number;
};

export type DeepAuditInput = {
  url: string;
  // Si no se pasan, se descubren desde el origen de la URL (auditar una URL cualquiera).
  robotsTxt?: string | null;
  sitemapFound?: boolean;
  sitemapUrls?: string[] | null;
  // PageSpeed (puede venir como promesa para no esperar en serie).
  psi: PsiLike | null | Promise<PsiLike | null>;
  // Página ya descargada (el Analizador de URL ya la tiene): evita una segunda petición.
  prefetched?: PrefetchedPage;
};

export async function runDeepAudit(input: DeepAuditInput): Promise<DeepResult | null> {
  const start = new URL(input.url);
  // Misma protección que el Analizador de URL: nunca contra redes internas.
  try {
    const addrs = await lookup(start.hostname, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isBlockedIp(a.address))) return null;
  } catch {
    return null;
  }

  let page = input.prefetched;
  if (!page) {
    let res: Response;
    try {
      res = await fetch(start.toString(), {
        headers: { "User-Agent": CRAWLER_USER_AGENT, "Accept-Language": "es,en;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return null;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    const buf = Buffer.from(await res.arrayBuffer());
    page = { finalUrl: res.url || start.toString(), status: res.status, redirected: res.redirected, headers, html: buf.toString("utf8"), htmlBytes: buf.length };
  }
  if (!(page.headers["content-type"] ?? "").includes("html")) return null;

  const finalUrl = page.finalUrl;
  const final = new URL(finalUrl);
  const robotsTxt = input.robotsTxt !== undefined ? input.robotsTxt : await fetchRobotsTxt(final.origin);
  const sm =
    input.sitemapFound !== undefined
      ? { found: input.sitemapFound, urls: input.sitemapUrls ?? null }
      : await loadSitemapInfo(final.origin, robotsTxt);
  const declaredInRobots = /^\s*sitemap\s*:/im.test(robotsTxt ?? "");
  const $ = cheerio.load(page.html);
  const alternates = $('link[rel="alternate"][hreflang]')
    .toArray()
    .map((el) => $(el).attr("href") ?? "")
    .map((h) => { try { return new URL(h, finalUrl).toString(); } catch { return ""; } })
    .filter(Boolean);

  // Las pruebas de red no dependen de PageSpeed: arrancan a la vez.
  const sitePromise = runSiteChecks({ finalUrl, robotsTxt, hreflangAlternates: alternates, headers: page.headers }).catch(() => []);
  const psi = await Promise.resolve(input.psi).catch(() => null);

  const pageChecks = runPageChecks({
    finalUrl,
    status: page.status,
    redirected: page.redirected,
    headers: page.headers,
    html: page.html,
    htmlBytes: page.htmlBytes,
    robotsTxt,
    sitemap: { found: sm.found, declaredInRobots, urls: sm.urls },
    psi,
    isHome: final.pathname === "/" || final.pathname === "",
  });
  const checks = [...pageChecks, ...(await sitePromise)];
  const { categoryScores, score } = scoreChecks(checks);
  return { url: finalUrl, checkedAt: new Date().toISOString(), checks, categoryScores, score };
}
