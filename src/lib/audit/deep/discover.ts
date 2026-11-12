// Descubre robots.txt y sitemap de un origen cualquiera, para auditar URLs
// que no pasan por el rastreo del sitio (Analizador de URL). Mismas
// protecciones SSRF que el resto de pruebas de red (safeGet).
import { safeGet } from "./site-checks";

export async function fetchRobotsTxt(origin: string): Promise<string | null> {
  const res = await safeGet(`${origin}/robots.txt`);
  if (!res || !res.ok || /text\/html/i.test(res.headers.get("content-type") ?? "")) return null;
  return res.text().catch(() => null);
}

const LOC = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
const locs = (xml: string) => [...xml.matchAll(LOC)].map((m) => m[1]);

export async function loadSitemapInfo(origin: string, robotsTxt: string | null): Promise<{ found: boolean; urls: string[] | null }> {
  const declared = [...(robotsTxt ?? "").matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 3);
  const roots = declared.length ? declared : [`${origin}/sitemap.xml`];
  const urls: string[] = [];
  let found = false;
  for (const root of roots) {
    const res = await safeGet(root, {}, 10000);
    if (!res || !res.ok) continue;
    const xml = await res.text().catch(() => "");
    if (!/<urlset|<sitemapindex/i.test(xml)) continue;
    found = true;
    if (/<sitemapindex/i.test(xml)) {
      for (const child of locs(xml).slice(0, 5)) {
        const r = await safeGet(child, {}, 10000);
        if (r?.ok) urls.push(...locs(await r.text().catch(() => "")));
        if (urls.length > 50000) break;
      }
    } else urls.push(...locs(xml));
  }
  return { found, urls: found ? urls.slice(0, 50000) : null };
}
