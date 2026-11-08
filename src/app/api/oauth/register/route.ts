import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { MAX_REDIRECT_URIS, OAUTH_CORS, isValidRedirectUri } from "@/lib/mcp/oauth";

// Registro dinámico de clientes (RFC 7591): la herramienta de IA se da de alta
// sola la primera vez que se conecta. Solo clientes públicos (sin secreto): la
// seguridad la da PKCE más la pantalla de consentimiento del usuario.
export const dynamic = "force-dynamic";

// Es público (no hay sesión): se limita por IP para que nadie llene la tabla.
const registerLimiter = new RateLimiterMemory({ points: 20, duration: 3600 });

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: OAUTH_CORS });
}

export async function POST(req: NextRequest) {
  try {
    await registerLimiter.consume(getClientIp(req.headers) || "unknown", 1);
  } catch {
    return oauthError("temporarily_unavailable", "Demasiados registros, inténtalo más tarde.", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return oauthError("invalid_client_metadata", "Cuerpo JSON inválido.");
  }

  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS || !uris.every(isValidRedirectUri)) {
    return oauthError("invalid_redirect_uri", "redirect_uris debe ser una lista de URLs https, http de localhost o esquemas de app.");
  }
  // Solo admitimos cliente público: PKCE en vez de secreto.
  if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== "none") {
    return oauthError("invalid_client_metadata", "Solo se admite token_endpoint_auth_method = none (cliente público con PKCE).");
  }

  const rawName = typeof body.client_name === "string" ? body.client_name.replace(/[\u0000-\u001f<>]/g, "").trim() : "";
  const name = (rawName || "Aplicación sin nombre").slice(0, 80);

  // Limpieza barata: clientes registrados hace más de 7 días que nunca llegaron a conectarse.
  await prisma.oAuthClient
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) }, grants: { none: {} } } })
    .catch(() => {});

  const client = await prisma.oAuthClient.create({ data: { name, redirectUris: uris as string[] } });

  return NextResponse.json(
    {
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp",
    },
    { status: 201, headers: OAUTH_CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS });
}
