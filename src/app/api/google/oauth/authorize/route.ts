import { requireSession } from "@/lib/auth-guards";
import { SITE_URL } from "@/lib/site"; // detrás del proxy req.url apunta a localhost:3000
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, GoogleOAuthConfigError } from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";
const RETURN_COOKIE = "google_oauth_return";

// Solo se vuelve a rutas internas de proyecto (evita redirecciones abiertas).
const RETURN_RE = /^\/app\/proyectos\/[A-Za-z0-9_-]+(\/[a-z0-9-]+)?$/;

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.redirect(new URL("/acceso", SITE_URL));

  const state = randomBytes(16).toString("hex");
  let authUrl: string;
  try {
    authUrl = await buildAuthUrl(state);
  } catch (error) {
    // Config incompleta (falta Client ID/Secret/Redirect URI): en vez de un
    // 500 mudo, manda al perfil con un mensaje claro.
    if (error instanceof GoogleOAuthConfigError) {
      const url = new URL("/app/perfil", SITE_URL);
      url.searchParams.set("error", "configuracion_incompleta");
      return NextResponse.redirect(url);
    }
    throw error;
  }

  const response = NextResponse.redirect(authUrl);
  const volver = req.nextUrl.searchParams.get("volver");
  if (volver && RETURN_RE.test(volver)) {
    response.cookies.set(RETURN_COOKIE, volver, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  }
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
