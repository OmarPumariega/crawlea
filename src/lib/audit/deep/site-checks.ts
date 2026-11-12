// Checks de SITIO que necesitan red: TLS/HTTP2, redirecciones http/www, soft
// 404 real, llms.txt, bots de IA (robots.txt + prueba contra el servidor) y
// reciprocidad de hreflang. Cada prueba hace como mucho unas pocas peticiones
// ligeras y se degrada a "na" (con el motivo) si no se pudo medir.
import tls from "node:tls";
import { lookup } from "node:dns/promises";
import { isBlockedIp } from "@/lib/net/safe-fetch";
import robotsParser from "robots-parser";
import type { CheckCategory, CheckSource, CheckStatus, DeepCheck } from "./types";

const UA = "CrawleaBot/1.0 (+https://crawlea.com)";
const G = "https://developers.google.com/search/docs";
const src = (label: string, url: string): CheckSource => ({ label, url });

function mk(m: {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  summary: string;
  fix?: string;
  evidence?: { label: string; value: string }[];
  weight?: number;
  advisory?: boolean;
  sources?: CheckSource[];
}): DeepCheck {
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

async function isPublicHost(u: URL): Promise<boolean> {
  try {
    const a = await lookup(u.hostname.replace(/^\[|\]$/g, ""), { all: true });
    return a.length > 0 && !a.some((x) => isBlockedIp(x.address));
  } catch {
    return false;
  }
}

// GET con protección SSRF: las URLs pueden venir de páginas ajenas (Analizador
// de URL, alternativas hreflang), así que cada salto se valida (solo http/s,
// puertos web, host público) y las redirecciones se siguen a mano.
export async function safeGet(url: string, init: RequestInit & { ua?: string } = {}, ms = 8000): Promise<Response | null> {
  const follow = init.redirect !== "manual";
  let cur = url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      const u = new URL(cur);
      if ((u.protocol !== "http:" && u.protocol !== "https:") || (u.port && u.port !== "80" && u.port !== "443") || u.username || !(await isPublicHost(u))) return null;
      const res = await fetch(cur, {
        ...init,
        redirect: "manual",
        headers: { "User-Agent": init.ua ?? UA, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(ms),
      });
      const loc = res.headers.get("location");
      if (follow && res.status >= 300 && res.status < 400 && loc) {
        cur = new URL(loc, cur).toString();
        continue;
      }
      return res;
    }
  } catch {
    /* red caída o URL inválida */
  }
  return null;
}
const get = safeGet;

type TlsInfo = { authorized: boolean; authError: string | null; validTo: Date | null; issuer: string | null; alpn: string | null; protocol: string | null };
function tlsProbe(host: string): Promise<TlsInfo | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: TlsInfo | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    try {
      const sock = tls.connect({ host, port: 443, servername: host, ALPNProtocols: ["h2", "http/1.1"], rejectUnauthorized: false, timeout: 8000 }, () => {
        const cert = sock.getPeerCertificate();
        finish({
          authorized: sock.authorized,
          authError: sock.authorizationError ? String(sock.authorizationError) : null,
          validTo: cert?.valid_to ? new Date(cert.valid_to) : null,
          issuer: [cert?.issuer?.O, cert?.issuer?.CN].flat().find((x): x is string => typeof x === "string") ?? null,
          alpn: sock.alpnProtocol || null,
          protocol: sock.getProtocol(),
        });
        sock.end();
      });
      sock.on("error", () => finish(null));
      sock.on("timeout", () => {
        sock.destroy();
        finish(null);
      });
    } catch {
      finish(null);
    }
  });
}

// Bots de IA: token del user-agent en robots.txt + UA que se usa al probar el WAF.
export const AI_BOTS: { token: string; ua: string; doc: CheckSource; probe: boolean }[] = [
  { token: "GPTBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot", doc: src("OpenAI: GPTBot", "https://platform.openai.com/docs/bots"), probe: true },
  { token: "OAI-SearchBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot", doc: src("OpenAI: OAI-SearchBot", "https://platform.openai.com/docs/bots"), probe: true },
  { token: "ChatGPT-User", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", doc: src("OpenAI: ChatGPT-User", "https://platform.openai.com/docs/bots"), probe: true },
  { token: "ClaudeBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", doc: src("Anthropic: rastreadores", "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"), probe: true },
  { token: "Claude-User", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)", doc: src("Anthropic: rastreadores", "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"), probe: true },
  { token: "Claude-SearchBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)", doc: src("Anthropic: rastreadores", "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"), probe: true },
  { token: "PerplexityBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", doc: src("Perplexity: PerplexityBot", "https://docs.perplexity.ai/guides/bots"), probe: true },
  { token: "Google-Extended", ua: "", doc: src("Google: Google-Extended", `${G}/crawling-indexing/overview-google-crawlers`), probe: false },
  { token: "Applebot-Extended", ua: "", doc: src("Apple: Applebot", "https://support.apple.com/en-us/119829"), probe: false },
  { token: "Meta-ExternalAgent", ua: "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)", doc: src("Meta: rastreadores", "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers"), probe: true },
  { token: "Bytespider", ua: "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)", doc: src("ByteDance: Bytespider", "https://bytedance.com"), probe: true },
  { token: "CCBot", ua: "CCBot/2.0 (https://commoncrawl.org/faq/)", doc: src("Common Crawl: CCBot", "https://commoncrawl.org/ccbot"), probe: true },
];

export type SiteContext = {
  finalUrl: string;
  robotsTxt: string | null;
  hreflangAlternates: string[]; // URLs absolutas
  headers: Record<string, string>;
};

export async function runSiteChecks(ctx: SiteContext): Promise<DeepCheck[]> {
  const out: DeepCheck[] = [];
  const final = new URL(ctx.finalUrl);
  const origin = final.origin;
  const host = final.hostname;
  const isHttps = final.protocol === "https:";

  const [tlsInfo, httpRes, wwwRes, soft, llms, llmsFull] = await Promise.all([
    isHttps ? tlsProbe(host) : Promise.resolve(null),
    get(`http://${host}/`, { redirect: "manual" }),
    get(`${final.protocol}//${host.startsWith("www.") ? host.slice(4) : "www." + host}/`, { redirect: "manual" }),
    get(`${origin}/crawlea-comprobacion-404-${Math.random().toString(36).slice(2, 10)}`, { redirect: "manual" }),
    get(`${origin}/llms.txt`),
    get(`${origin}/llms-full.txt`),
  ]);

  // --- TLS ---
  if (isHttps) {
    if (!tlsInfo) {
      out.push(mk({ id: "ssl-valid", category: "eeat", title: "HTTPS con certificado válido", status: "na", summary: "No se pudo abrir una conexión TLS directa al puerto 443 para comprobar el certificado." }));
    } else {
      out.push(
        mk({
          id: "ssl-valid",
          category: "eeat",
          title: "HTTPS con certificado válido",
          status: tlsInfo.authorized ? "ok" : "fail",
          summary: tlsInfo.authorized ? `La página se sirve sobre HTTPS con un certificado de confianza (${tlsInfo.protocol ?? "TLS"}).` : `El certificado no es de confianza: ${tlsInfo.authError ?? "error de validación"}. Los navegadores mostrarán un aviso de seguridad.`,
          fix: "Instala un certificado válido (Let's Encrypt es gratis), con la cadena completa y que cubra el dominio exacto.",
          sources: [src("Google: HTTPS como señal de posicionamiento", `${G}/appearance/https`)],
          weight: 3,
        })
      );
      const days = tlsInfo.validTo ? Math.floor((tlsInfo.validTo.getTime() - Date.now()) / 86_400_000) : null;
      out.push(
        mk({
          id: "ssl-expiry",
          category: "eeat",
          title: "Caducidad del certificado SSL",
          status: days == null ? "na" : days < 0 ? "fail" : days < 15 ? "fail" : days < 30 ? "improve" : "ok",
          summary: days == null ? "No se pudo leer la fecha de caducidad." : days < 0 ? `El certificado caducó hace ${-days} día(s).` : `El certificado es válido ${days} día(s) más${tlsInfo.issuer ? ` (emisor: ${tlsInfo.issuer})` : ""}.`,
          fix: "Renueva el certificado y activa la renovación automática (certbot/Traefik/CDN).",
          sources: [src("Google: HTTPS como señal de posicionamiento", `${G}/appearance/https`)],
          weight: 2,
        })
      );
      const h2 = tlsInfo.alpn === "h2";
      out.push(
        mk({
          id: "http2",
          category: "perf",
          title: "Protocolo HTTP moderno (HTTP/2 o HTTP/3)",
          status: h2 || /h3/.test(ctx.headers["alt-svc"] ?? "") ? "ok" : "improve",
          summary: h2 ? "El servidor negocia HTTP/2, que multiplexa las peticiones sobre una sola conexión." : `El servidor negocia ${tlsInfo.alpn ?? "HTTP/1.1"}: sin multiplexación, más lento con muchos recursos.`,
          fix: "Activa HTTP/2 (y HTTP/3 si puedes) en el servidor web o CDN.",
          sources: [src("web.dev: HTTP/2", "https://web.dev/articles/performance-http2")],
        })
      );
    }
    const hsts = ctx.headers["strict-transport-security"];
    const maxAge = Number(/max-age=(\d+)/i.exec(hsts ?? "")?.[1] ?? 0);
    out.push(
      mk({
        id: "hsts",
        category: "eeat",
        title: "HSTS (Strict-Transport-Security)",
        status: !hsts ? "improve" : maxAge >= 15_552_000 ? "ok" : "improve",
        summary: !hsts ? "Falta la cabecera Strict-Transport-Security: el navegador no fuerza HTTPS en visitas futuras." : `Strict-Transport-Security: «${hsts}»${maxAge < 15_552_000 ? " — max-age inferior a 6 meses." : "."}`,
        fix: "Envía Strict-Transport-Security: max-age=31536000; includeSubDomains (cuando todo el dominio ya sirva HTTPS).",
        sources: [src("MDN: Strict-Transport-Security", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security")],
      })
    );
  }

  // --- http → https ---
  if (isHttps) {
    const loc = httpRes?.headers.get("location") ?? "";
    const ok301 = !!httpRes && [301, 308].includes(httpRes.status) && loc.startsWith("https://");
    out.push(
      mk({
        id: "http-to-https",
        category: "url",
        title: "La versión http:// redirige a https://",
        status: !httpRes ? "na" : ok301 ? "ok" : [302, 303, 307].includes(httpRes.status) && loc.startsWith("https://") ? "improve" : httpRes.status === 200 ? "fail" : "improve",
        summary: !httpRes ? "No se pudo conectar a la versión http:// (puerto 80 cerrado): no hay versión insegura duplicada." : ok301 ? `http://${host}/ redirige con ${httpRes.status} a ${loc}.` : httpRes.status === 200 ? `http://${host}/ responde 200 sin redirigir: existe una versión insegura duplicada de todo el sitio.` : `http://${host}/ responde ${httpRes.status}${loc ? " → " + loc : ""}: la redirección debería ser un 301 permanente a https.`,
        fix: "Configura una redirección 301 permanente de todo http:// a https:// en el servidor.",
        sources: [src("Google: HTTPS como señal de posicionamiento", `${G}/appearance/https`)],
        weight: 2,
      })
    );
  }

  // --- www / sin www ---
  {
    const other = host.startsWith("www.") ? host.slice(4) : "www." + host;
    const loc = wwwRes?.headers.get("location") ?? "";
    const redirectsBack = !!wwwRes && [301, 308].includes(wwwRes.status) && (() => { try { return new URL(loc, origin).hostname === host; } catch { return false; } })();
    out.push(
      mk({
        id: "www-canonical",
        category: "url",
        title: "Una sola versión del dominio (con/sin www)",
        status: !wwwRes ? "ok" : redirectsBack ? "ok" : wwwRes.status === 200 ? "fail" : "improve",
        summary: !wwwRes ? `${other} no responde: solo existe ${host}, sin versión duplicada.` : redirectsBack ? `${other} redirige con ${wwwRes.status} a ${host}.` : wwwRes.status === 200 ? `${other} responde 200 con el mismo sitio: dos versiones del dominio compiten entre sí.` : `${other} responde ${wwwRes.status}${loc ? " → " + loc : ""}; debería ser un 301 a ${host}.`,
        fix: `Redirige con 301 ${other} → ${host} (o al revés) y usa siempre la misma en canonical, sitemap y enlaces.`,
        sources: [src("Google: consolidar URLs duplicadas", `${G}/crawling-indexing/consolidate-duplicate-urls`)],
        weight: 2,
      })
    );
  }

  // --- soft 404 real ---
  out.push(
    mk({
      id: "soft404-site",
      category: "crawl",
      title: "Las URLs inexistentes devuelven 404",
      status: !soft ? "na" : [404, 410].includes(soft.status) ? "ok" : soft.status === 200 ? "fail" : [301, 302, 303, 307, 308].includes(soft.status) ? "improve" : "improve",
      summary: !soft ? "No se pudo probar una URL inexistente." : [404, 410].includes(soft.status) ? `Una URL inventada devuelve ${soft.status}: el servidor distingue bien lo que no existe.` : soft.status === 200 ? "Una URL inventada devuelve 200: el sitio tiene soft 404 (páginas de error que Google puede indexar como contenido)." : `Una URL inventada devuelve ${soft.status}${soft.headers.get("location") ? " → " + soft.headers.get("location") : ""} en lugar de 404.`,
      fix: "Haz que las rutas que no existen devuelvan un estado HTTP 404 (o 410) real, con una página de error útil.",
      sources: [src("Google: errores soft 404", `${G}/crawling-indexing/http-network-errors#soft-404-errors`)],
      weight: 2,
    })
  );

  // --- llms.txt ---
  {
    const body = llms && llms.ok ? await llms.text().catch(() => "") : "";
    const isText = !!llms && llms.ok && !/text\/html/i.test(llms.headers.get("content-type") ?? "") && body.trim().length > 0;
    const hasFull = !!llmsFull && llmsFull.ok && !/text\/html/i.test(llmsFull.headers.get("content-type") ?? "");
    out.push(
      mk({
        id: "llms-txt",
        category: "ai",
        title: "Archivo llms.txt",
        status: isText ? (/^#\s+\S/m.test(body) ? "ok" : "improve") : "improve",
        summary: isText ? `${origin}/llms.txt existe (${body.length} caracteres)${/^#\s+\S/m.test(body) ? " y empieza con un título Markdown" : " pero no sigue el formato (un # Título inicial)"}${hasFull ? "; también hay llms-full.txt" : ""}.` : `No se ha encontrado ${origin}/llms.txt. Es una convención emergente (no un estándar como robots.txt) para dar a los LLM un resumen curado del sitio en texto plano; su ausencia no es un fallo de SEO establecido.`,
        fix: "Crea /llms.txt en Markdown: un # Título, un resumen en > cita y listas de enlaces a tus páginas clave con una frase descriptiva.",
        advisory: true,
        weight: 0.5,
        sources: [src("llms.txt: propuesta de estándar", "https://llmstxt.org/")],
      })
    );
  }

  // --- Bots de IA ---
  {
    const robots = ctx.robotsTxt != null ? robotsParser(`${origin}/robots.txt`, ctx.robotsTxt) : null;
    const blockedByRobots = AI_BOTS.filter((b) => robots && robots.isAllowed(`${origin}/`, b.token) === false).map((b) => b.token);
    out.push(
      mk({
        id: "ai-bots-robots",
        category: "ai",
        title: "Acceso de crawlers de IA en robots.txt",
        status: ctx.robotsTxt == null ? "ok" : blockedByRobots.length === 0 ? "ok" : "improve",
        summary: ctx.robotsTxt == null ? "Sin robots.txt: todos los crawlers de IA pueden acceder." : `${AI_BOTS.length - blockedByRobots.length} de ${AI_BOTS.length} bots permitidos${blockedByRobots.length ? `; bloqueados: ${blockedByRobots.join(", ")}` : ""}. Revisa que cada bloqueo sea una decisión consciente: bloquear Google-Extended te excluye de Gemini/AI Overviews sin mejorar tu SEO clásico; bloquear GPTBot/ClaudeBot/PerplexityBot te excluye de entrenamiento y/o de las citas en esos asistentes.`,
        fix: "Quita el Disallow de los bots que SÍ quieras que citen tu web, o déjalos si el bloqueo es intencionado.",
        evidence: AI_BOTS.map((b) => ({ label: b.token, value: blockedByRobots.includes(b.token) ? "bloqueado" : "permitido" })),
        advisory: true,
        sources: AI_BOTS.slice(0, 4).map((b) => b.doc).filter((d, i, a) => a.findIndex((x) => x.url === d.url) === i),
      })
    );
    const probes = AI_BOTS.filter((b) => b.probe);
    const results = await Promise.all(probes.map(async (b) => ({ b, res: await get(`${origin}/`, { ua: b.ua, redirect: "follow" }, 8000) })));
    const reached = results.filter((r) => r.res);
    const blocked = reached.filter((r) => r.res!.status === 403 || r.res!.status === 429 || r.res!.status === 503);
    out.push(
      mk({
        id: "ai-bots-waf",
        category: "ai",
        title: "Sin bloqueo por firewall/WAF a bots de IA",
        status: reached.length === 0 ? "na" : blocked.length === 0 ? "ok" : "fail",
        summary: reached.length === 0 ? "No se pudo probar el acceso con user-agents de IA." : blocked.length === 0 ? "Ninguno de los bots de IA comprobados recibe 403/429 al pedir la home del sitio. Límite de la prueba: muchos WAF (como el «verified bots» de Cloudflare) también verifican la IP de origen; esta petición sale de nuestro servidor, así que un «permitido» no garantiza al 100% que el bot real pase (un 403 sí es una señal fiable de bloqueo)." : `${blocked.length} bot(s) reciben ${[...new Set(blocked.map((r) => r.res!.status))].join("/")}: ${blocked.map((r) => r.b.token).join(", ")}. Algo (WAF, plugin de seguridad, Cloudflare) los está bloqueando.`,
        fix: "Revisa las reglas del WAF/CDN (Cloudflare «AI Crawl Control», Wordfence, etc.) y permite los bots de IA cuyo tráfico quieras recibir.",
        evidence: reached.map((r) => ({ label: r.b.token, value: String(r.res!.status) })),
        sources: [src("OpenAI: bots", "https://platform.openai.com/docs/bots"), src("Anthropic: rastreadores", "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler")],
        weight: 1.5,
      })
    );
  }

  // --- hreflang recíproco ---
  if (ctx.hreflangAlternates.length > 0) {
    const self = (u: string) => u.replace(/#.*$/, "").replace(/\/+$/, "");
    const others = ctx.hreflangAlternates.filter((u) => self(u) !== self(ctx.finalUrl)).slice(0, 6);
    const notBack: string[] = [];
    const unreachable: string[] = [];
    await Promise.all(
      others.map(async (u) => {
        const r = await get(u, { redirect: "follow" });
        if (!r || !r.ok) return void unreachable.push(`${u} (${r ? r.status : "sin respuesta"})`);
        const html = await r.text().catch(() => "");
        const m = [...html.matchAll(/<link[^>]+hreflang[^>]*>/gi)].map((x) => x[0]);
        const back = m.some((tag) => {
          const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
          try { return !!href && self(new URL(href, u).toString()) === self(ctx.finalUrl); } catch { return false; }
        });
        if (!back) notBack.push(u);
      })
    );
    out.push(
      mk({
        id: "hreflang-reciprocal",
        category: "intl",
        title: "hreflang recíproco (las versiones se enlazan entre sí)",
        status: unreachable.length || notBack.length ? "fail" : "ok",
        summary: unreachable.length ? `${unreachable.length} versión(es) alternativas no responden 200: ${list(unreachable)}.` : notBack.length ? `${notBack.length} versión(es) no enlazan de vuelta a esta página: ${list(notBack)}. Google ignora los hreflang sin confirmación recíproca.` : `Las ${others.length} versión(es) alternativas comprobadas enlazan de vuelta a esta página.`,
        fix: "Cada URL del conjunto hreflang debe listar a todas las demás (y a sí misma). Corrige las que no enlacen de vuelta.",
        sources: [src("Google: hreflang para contenido localizado", `${G}/specialty/international/localized-versions`)],
        weight: 2,
      })
    );
  }

  return out;
}

function list(items: string[], n = 4): string {
  return items.slice(0, n).join(", ") + (items.length > n ? ` y ${items.length - n} más` : "");
}
