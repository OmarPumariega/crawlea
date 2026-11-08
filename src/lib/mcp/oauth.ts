import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/mcp/tokens";

// OAuth 2.1 para el MCP: lo que hace falta para que un cliente (conector
// personalizado de Claude, ChatGPT, Cursor...) se conecte sin tokens a mano.
// Clientes públicos (sin secreto) con PKCE S256 obligatorio, registro dinámico
// (RFC 7591), códigos de un solo uso y tokens que se guardan solo como hash.

export const ACCESS_PREFIX = "crwo_";
export const REFRESH_PREFIX = "crwr_";
export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hora
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 días, rota en cada uso
export const CODE_TTL_SECONDS = 5 * 60;
export const MAX_REDIRECT_URIS = 10;

// Origen público de la app (lo que ve el cliente OAuth). Detrás de Traefik viene
// en X-Forwarded-*; en local, de la propia petición.
export function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return req.nextUrl.origin;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host.split(",")[0].trim()}`;
}

export function mcpUrl(origin: string): string {
  return `${origin}/api/mcp`;
}

export function randomSecret(prefix = ""): string {
  return prefix + randomBytes(32).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const FORBIDDEN_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:"]);

// Redirecciones aceptables al registrar un cliente: https, http solo en
// loopback (apps de escritorio/CLI) y esquemas propios de apps (cursor://,
// vscode://...). Nunca esquemas que ejecuten código.
export function isValidRedirectUri(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 500) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (FORBIDDEN_SCHEMES.has(u.protocol)) return false;
  if (u.protocol === "http:") return LOOPBACK.has(u.hostname);
  return true;
}

// Coincidencia exacta; solo en loopback se ignora el puerto (RFC 8252: la app
// nativa abre un puerto libre cualquiera).
export function redirectUriMatches(registered: string[], candidate: string): boolean {
  if (registered.includes(candidate)) return true;
  let c: URL;
  try {
    c = new URL(candidate);
  } catch {
    return false;
  }
  if (c.protocol !== "http:" || !LOOPBACK.has(c.hostname)) return false;
  return registered.some((r) => {
    try {
      const u = new URL(r);
      return u.protocol === "http:" && u.hostname === c.hostname && u.pathname === c.pathname && u.search === c.search;
    } catch {
      return false;
    }
  });
}

export async function findClient(clientId: unknown) {
  if (typeof clientId !== "string" || !clientId || clientId.length > 64) return null;
  return prisma.oAuthClient.findUnique({ where: { id: clientId } });
}

export type IssuedTokens = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export function newTokenPair() {
  const access = randomSecret(ACCESS_PREFIX);
  const refresh = randomSecret(REFRESH_PREFIX);
  const now = Date.now();
  return {
    access,
    refresh,
    accessHash: hashToken(access),
    refreshHash: hashToken(refresh),
    accessExpiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    refreshExpiresAt: new Date(now + REFRESH_TTL_SECONDS * 1000),
  };
}

export function tokenResponse(pair: ReturnType<typeof newTokenPair>): IssuedTokens {
  return {
    access_token: pair.access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: pair.refresh,
    scope: "mcp",
  };
}

// Cabeceras CORS para los endpoints que llaman clientes desde el navegador.
export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};
