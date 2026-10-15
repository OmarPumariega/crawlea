import { requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { encrypt } from "@/lib/crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getConnectedEmail, GoogleOAuthConfigError } from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";

function redirectWithError(req: NextRequest, error: string) {
  const url = new URL("/app/perfil", req.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

// Callback del flujo OAuth2 del Módulo 6 (GSC/GA4). La conexión es POR
// USUARIO (una fila por usuario en GoogleConnection): el upsert va contra
// userId, nunca contra un id fijo — cada cliente conecta su propia cuenta.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.redirect(new URL("/acceso", req.url));

  const { searchParams } = req.nextUrl;

  if (searchParams.get("error")) {
    return redirectWithError(req, "cancelado");
  }

  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  const receivedState = searchParams.get("state");
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    return redirectWithError(req, "estado_invalido");
  }

  const code = searchParams.get("code");
  if (!code) return redirectWithError(req, "sin_codigo");

  let client;
  let tokens;
  try {
    ({ client, tokens } = await exchangeCodeForTokens(code));
  } catch (error) {
    if (error instanceof GoogleOAuthConfigError) return redirectWithError(req, "configuracion_incompleta");
    throw error;
  }

  if (!tokens.refresh_token) {
    return redirectWithError(req, "sin_refresh_token");
  }

  const email = await getConnectedEmail(client);
  if (!email) return redirectWithError(req, "sin_email");

  await prisma.googleConnection.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      googleEmail: email,
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      scope: tokens.scope ?? "",
    },
    update: {
      googleEmail: email,
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      scope: tokens.scope ?? "",
    },
  });

  const url = new URL("/app/perfil", req.url);
  url.searchParams.set("connected", "1");
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}
