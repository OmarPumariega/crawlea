import { lookup } from "dns/promises";
import { isIP } from "net";

// Descarga de una URL pedida por un usuario con protección contra SSRF: solo
// http/https, solo puertos web, y el host se resuelve ANTES de conectar y se
// rechaza si apunta a una dirección privada, de loopback, link-local (incluye
// el endpoint de metadatos de la nube 169.254.169.254) o reservada. Las
// redirecciones se siguen a mano y cada salto se vuelve a validar. Tope de
// tamaño y de tiempo. Nunca se envían credenciales ni cookies.

export class SafeFetchError extends Error {
  code: "invalid_url" | "blocked" | "timeout" | "fetch_failed" | "too_large" | "too_many_redirects";
  constructor(code: SafeFetchError["code"], message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast y reservadas
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4 mapeada
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("invalid_url", "Solo se pueden analizar direcciones http o https");
  }
  if (url.username || url.password) throw new SafeFetchError("invalid_url", "La URL no puede incluir usuario ni contraseña");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new SafeFetchError("blocked", "Solo se pueden analizar páginas web en los puertos habituales");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new SafeFetchError("blocked", "Esa dirección no es pública");
  }
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SafeFetchError("blocked", "Esa dirección no es pública");
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SafeFetchError("fetch_failed", "No se ha podido encontrar esa web");
  }
  if (addrs.length === 0 || addrs.some((a) => isBlockedIp(a.address))) {
    throw new SafeFetchError("blocked", "Esa dirección no es pública");
  }
}

export type SafeFetchResult = {
  finalUrl: string;
  status: number;
  headers: Headers;
  body: string;
  // Cadena de redirecciones recorridas (URL → URL), sin incluir la final.
  redirects: { from: string; to: string; status: number }[];
  loadMs: number;
};

export async function safeFetchHtml(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; userAgent?: string } = {}
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const maxBytes = opts.maxBytes ?? 3_000_000;
  const maxRedirects = opts.maxRedirects ?? 5;

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("invalid_url", "La URL no es válida");
  }

  const redirects: SafeFetchResult["redirects"] = [];
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      await assertPublicHost(current);
      let res: Response;
      try {
        res = await fetch(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": opts.userAgent ?? "Mozilla/5.0 (compatible; CrawleaBot/1.0; +https://crawlea.com)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "es-ES,es;q=0.9",
          },
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw new SafeFetchError("timeout", "La página tardó demasiado en responder");
        throw new SafeFetchError("fetch_failed", "No se ha podido acceder a la página");
      }

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = new URL(res.headers.get("location")!, current);
        redirects.push({ from: current.toString(), to: next.toString(), status: res.status });
        current = next;
        continue;
      }

      // Lectura con tope de tamaño.
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            throw new SafeFetchError("too_large", "La página pesa demasiado para analizarla");
          }
          chunks.push(value);
        }
      }
      const body = Buffer.concat(chunks).toString("utf-8");
      return { finalUrl: current.toString(), status: res.status, headers: res.headers, body, redirects, loadMs: Date.now() - started };
    }
    throw new SafeFetchError("too_many_redirects", "La URL redirige demasiadas veces");
  } finally {
    clearTimeout(timer);
  }
}
