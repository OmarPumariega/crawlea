import { NextRequest, NextResponse } from "next/server";
import { requireSession, isAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { LEGAL_VERSION } from "@/lib/legal/company";
import { MCP_ADMIN_ONLY } from "@/lib/mcp/access";
import { redirectWith, validateAuthorize } from "@/lib/mcp/authorize";
import { CODE_TTL_SECONDS, publicOrigin, randomSecret } from "@/lib/mcp/oauth";
import { hashToken } from "@/lib/mcp/tokens";

// Aquí aterriza el formulario de la pantalla de consentimiento (/oauth/authorize).
// Si el usuario permite, se emite un código de un solo uso (5 min, solo su hash)
// y se devuelve al cliente por redirección.
export const dynamic = "force-dynamic";

function go(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  // CSRF: la cookie de sesión es SameSite=Lax (no viaja en un POST de otro sitio),
  // y además exigimos que el origen del POST sea el nuestro.
  const origin = publicOrigin(req);
  if (req.headers.get("origin") !== origin) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const fields: Record<string, string | undefined> = {};
  for (const key of ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state"]) {
    const v = form.get(key);
    fields[key] = typeof v === "string" ? v : undefined;
  }

  const check = await validateAuthorize(fields);
  if (!check.ok && check.fatal) return NextResponse.json({ error: check.message }, { status: 400 });
  if (!check.ok) {
    return go(redirectWith(check.redirectUri, { error: check.error, error_description: check.description, state: check.state, iss: origin }));
  }

  if (form.get("decision") !== "allow") {
    return go(redirectWith(check.redirectUri, { error: "access_denied", error_description: "El usuario no ha dado permiso.", state: check.state, iss: origin }));
  }

  // Mismas reglas que el resto de la app: cuenta con los términos aceptados y MCP disponible.
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { termsVersion: true } });
  if (user?.termsVersion !== LEGAL_VERSION) {
    return go(redirectWith(check.redirectUri, { error: "access_denied", error_description: "Acepta los términos en Crawlea antes de conectar.", state: check.state, iss: origin }));
  }
  if (MCP_ADMIN_ONLY && !isAdmin(session)) {
    return go(redirectWith(check.redirectUri, { error: "access_denied", error_description: "El MCP no está disponible para esta cuenta.", state: check.state, iss: origin }));
  }

  const code = randomSecret("crwc_");
  await prisma.oAuthCode.create({
    data: {
      codeHash: hashToken(code),
      clientId: check.client.id,
      userId: session.user.id,
      redirectUri: check.redirectUri,
      codeChallenge: check.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
    },
  });

  return go(redirectWith(check.redirectUri, { code, state: check.state, iss: origin }));
}
