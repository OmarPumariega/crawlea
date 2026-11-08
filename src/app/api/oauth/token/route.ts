import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { hashToken } from "@/lib/mcp/tokens";
import { OAUTH_CORS, newTokenPair, pkceChallenge, safeEqual, tokenResponse } from "@/lib/mcp/oauth";

// Endpoint de token (RFC 6749 §3.2): canjea el código de autorización (con
// PKCE) por un access token de 1 hora y un refresh token que rota en cada uso.
export const dynamic = "force-dynamic";

const tokenLimiter = new RateLimiterMemory({ points: 60, duration: 60 });
const NO_STORE = { ...OAUTH_CORS, "Cache-Control": "no-store", Pragma: "no-cache" };

function fail(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: NO_STORE });
}

async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    for (const [k, v] of Object.entries(body ?? {})) if (typeof v === "string") out[k] = v;
  } else {
    const form = await req.formData().catch(() => null);
    form?.forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    await tokenLimiter.consume(getClientIp(req.headers) || "unknown", 1);
  } catch {
    return fail("temporarily_unavailable", "Demasiadas peticiones.", 429);
  }

  const p = await readParams(req);

  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.code_verifier || !p.client_id) return fail("invalid_request", "Faltan code, code_verifier o client_id.");
    if (p.code_verifier.length < 43 || p.code_verifier.length > 128) return fail("invalid_grant", "code_verifier inválido.");

    const code = await prisma.oAuthCode.findUnique({ where: { codeHash: hashToken(p.code) } });
    // Un código se canjea UNA vez: se borra antes de comprobar nada más (si algo
    // falla, ese código ya no sirve; evita probar verificadores contra él).
    if (!code) return fail("invalid_grant", "Código inválido o ya usado.");
    const deleted = await prisma.oAuthCode.deleteMany({ where: { id: code.id } });
    if (deleted.count === 0) return fail("invalid_grant", "Código inválido o ya usado.");

    if (code.expiresAt < new Date()) return fail("invalid_grant", "El código ha caducado.");
    if (code.clientId !== p.client_id) return fail("invalid_grant", "El código no pertenece a esta aplicación.");
    if (p.redirect_uri !== undefined && p.redirect_uri !== code.redirectUri) return fail("invalid_grant", "redirect_uri no coincide.");
    if (!safeEqual(pkceChallenge(p.code_verifier), code.codeChallenge)) return fail("invalid_grant", "Verificación PKCE fallida.");

    const user = await prisma.user.findUnique({ where: { id: code.userId }, select: { status: true } });
    if (!user || user.status !== "active") return fail("invalid_grant", "La cuenta no está disponible.");

    const pair = newTokenPair();
    await prisma.oAuthGrant.create({
      data: {
        userId: code.userId,
        clientId: code.clientId,
        accessHash: pair.accessHash,
        accessExpiresAt: pair.accessExpiresAt,
        refreshHash: pair.refreshHash,
        refreshExpiresAt: pair.refreshExpiresAt,
      },
    });
    // Limpieza de códigos caducados que nadie canjeó.
    await prisma.oAuthCode.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
    return NextResponse.json(tokenResponse(pair), { headers: NO_STORE });
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return fail("invalid_request", "Falta refresh_token.");
    const grant = await prisma.oAuthGrant.findUnique({ where: { refreshHash: hashToken(p.refresh_token) } });
    if (!grant || grant.revokedAt || grant.refreshExpiresAt < new Date()) return fail("invalid_grant", "Refresh token inválido o caducado.");
    if (p.client_id && p.client_id !== grant.clientId) return fail("invalid_grant", "El token no pertenece a esta aplicación.");

    const user = await prisma.user.findUnique({ where: { id: grant.userId }, select: { status: true } });
    if (!user || user.status !== "active") return fail("invalid_grant", "La cuenta no está disponible.");

    // Rotación: el refresh token usado deja de valer. updateMany con el hash
    // viejo como condición hace que dos refresh simultáneos no ganen los dos.
    const pair = newTokenPair();
    const rotated = await prisma.oAuthGrant.updateMany({
      where: { id: grant.id, refreshHash: grant.refreshHash, revokedAt: null },
      data: {
        accessHash: pair.accessHash,
        accessExpiresAt: pair.accessExpiresAt,
        refreshHash: pair.refreshHash,
        refreshExpiresAt: pair.refreshExpiresAt,
      },
    });
    if (rotated.count === 0) return fail("invalid_grant", "Refresh token ya usado.");
    return NextResponse.json(tokenResponse(pair), { headers: NO_STORE });
  }

  return fail("unsupported_grant_type", "Solo se admiten authorization_code y refresh_token.");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS });
}
