import dns from "node:dns/promises";
import net from "node:net";
import * as cheerio from "cheerio";

// Revisión rápida de UNA página (la home) para el analizador de la web
// pública. Es una comprobación real y barata (una petición + robots.txt +
// sitemap.xml), sin APIs de pago. NO es la auditoría completa de la
// herramienta: no rastrea el sitio ni mide rendimiento, y la web lo dice así.
//
// Como la URL la escribe un visitante anónimo, toda petición pasa por una
// guarda SSRF: solo http/https, puertos 80/443, sin credenciales, y el host
// debe resolver solo a IPs públicas (también en cada redirección).

const UA = "CrawleaBot/1.0 (+https://crawlea.com)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;

export type Severity = "alto" | "medio" | "bajo";
export type Issue = { id: string; severity: Severity; label: string; hint: string };

export type QuickCheckResult = {
  domain: string;
  finalUrl: string;
  issues: Issue[];
  passed: string[];
  loadMs: number;
};

export class QuickCheckError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
    return l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb");
  }
  return true;
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new QuickCheckError("La dirección debe empezar por http o https.");
  if (url.username || url.password) throw new QuickCheckError("La dirección no puede llevar usuario ni contraseña.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new QuickCheckError("Solo analizamos webs en los puertos habituales.");
  const host = url.hostname;
  if (!host.includes(".") && !net.isIP(host)) throw new QuickCheckError("Escribe un dominio completo, por ejemplo ejemplo.es.");
  const addrs = net.isIP(host) ? [{ address: host }] : await Promise.race([dns.lookup(host, { all: true }), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("dns")), 5000))]).catch(() => []);
  if (addrs.length === 0) throw new QuickCheckError("No hemos encontrado esa web. Revisa la dirección.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new QuickCheckError("Solo podemos analizar webs públicas.");
}

export function normalizeUrl(input: string): URL {
  let raw = input.trim();
  if (!raw || raw.length > 300) throw new QuickCheckError("Escribe la dirección de tu web.");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    return new URL(raw);
  } catch {
    throw new QuickCheckError("Esa dirección no parece válida. Prueba con ejemplo.es.");
  }
}

async function guardedFetch(start: URL, wantBody: boolean): Promise<{ res: Response; url: URL; body: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => {
      throw new QuickCheckError("No hemos podido abrir esa web. Comprueba que está en línea y es pública.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    let body = "";
    if (wantBody && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
      }
      reader.cancel().catch(() => {});
      body = Buffer.concat(chunks).toString("utf8");
    } else {
      res.body?.cancel().catch(() => {});
    }
    return { res, url, body };
  }
  throw new QuickCheckError("Esa web redirige demasiadas veces.");
}

export async function quickCheck(input: string): Promise<QuickCheckResult> {
  const start = normalizeUrl(input);
  const t0 = Date.now();
  const { res, url, body } = await guardedFetch(start, true);
  const loadMs = Date.now() - t0;

  if (res.status >= 400) throw new QuickCheckError(`La web ha respondido con un error (${res.status}). Revisa la dirección.`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) throw new QuickCheckError("Esa dirección no devuelve una página web.");

  const $ = cheerio.load(body);
  const issues: Issue[] = [];
  const passed: string[] = [];
  const add = (id: string, severity: Severity, label: string, hint: string) => issues.push({ id, severity, label, hint });

  if (url.protocol !== "https:") add("https", "alto", "La web no usa HTTPS", "Activa un certificado: Google lo prefiere y los navegadores avisan de que no es segura.");
  else passed.push("HTTPS activo");

  const robotsMeta = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  if (robotsMeta.includes("noindex")) add("noindex", "alto", "La página pide no aparecer en Google", "Tiene una etiqueta noindex. Si no es intencionado, quítala.");
  else passed.push("Se puede indexar");

  const title = $("title").first().text().trim();
  if (!title) add("title", "alto", "Falta el título", "El título es lo primero que se ve en Google. Escribe uno de 30 a 60 caracteres.");
  else if (title.length < 30 || title.length > 65) add("title-len", "medio", `El título mide ${title.length} caracteres`, "Lo ideal son entre 30 y 60 para que Google lo muestre entero.");
  else passed.push("Título con buena longitud");

  const desc = ($('meta[name="description"]').attr("content") ?? "").trim();
  if (!desc) add("desc", "medio", "Falta la meta descripción", "Es el texto que aparece bajo el título en Google. Escribe una de 120 a 160 caracteres.");
  else if (desc.length < 100 || desc.length > 165) add("desc-len", "bajo", `La descripción mide ${desc.length} caracteres`, "Lo ideal son entre 120 y 160.");
  else passed.push("Meta descripción correcta");

  const h1 = $("h1").length;
  if (h1 === 0) add("h1", "alto", "No hay ningún H1", "Cada página necesita un título principal (H1) con su tema.");
  else if (h1 > 1) add("h1-multi", "medio", `Hay ${h1} H1 en la página`, "Lo recomendable es uno solo por página.");
  else passed.push("Un único H1");

  if (!$('link[rel="canonical"]').attr("href")) add("canonical", "bajo", "No hay URL canónica", "Ayuda a Google a saber cuál es la versión principal de la página.");
  else passed.push("URL canónica definida");

  if (!$('meta[name="viewport"]').attr("content")) add("viewport", "medio", "No está preparada para móvil", "Falta la etiqueta viewport: la web no se adaptará a pantallas pequeñas.");
  else passed.push("Adaptada a móvil");

  if (!($("html").attr("lang") ?? "").trim()) add("lang", "bajo", "No se indica el idioma", "Añade el atributo lang a la etiqueta html.");

  const imgs = $("img").toArray();
  const noAlt = imgs.filter((i) => !($(i).attr("alt") ?? "").trim()).length;
  if (noAlt > 0) add("alt", "bajo", `${noAlt} ${noAlt === 1 ? "imagen sin texto alternativo" : "imágenes sin texto alternativo"}`, "El texto alt ayuda a la accesibilidad y a que Google entienda la imagen.");
  else if (imgs.length > 0) passed.push("Imágenes con texto alternativo");

  if (loadMs > 2500) add("speed", "medio", `La página tarda ${(loadMs / 1000).toFixed(1).replace(".", ",")} s en responder`, "Una respuesta lenta empeora la experiencia y el posicionamiento.");
  else passed.push("Respuesta rápida");

  const origin = new URL(url.origin);
  const [robots, sitemap] = await Promise.all([
    guardedFetch(new URL("/robots.txt", origin), false).then((r) => r.res.ok).catch(() => false),
    guardedFetch(new URL("/sitemap.xml", origin), false).then((r) => r.res.ok).catch(() => false),
  ]);
  if (!robots) add("robots", "bajo", "No hay archivo robots.txt", "Indica a los buscadores qué pueden rastrear en tu web.");
  else passed.push("Archivo robots.txt presente");
  if (!sitemap) add("sitemap", "medio", "No encontramos sitemap.xml", "Un sitemap ayuda a Google a descubrir todas tus páginas.");
  else passed.push("Sitemap.xml presente");

  return { domain: url.hostname.replace(/^www\./, ""), finalUrl: url.toString(), issues, passed, loadMs };
}
