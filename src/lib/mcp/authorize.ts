import type { OAuthClient } from "@prisma/client";
import { findClient, redirectUriMatches } from "@/lib/mcp/oauth";

// Validación de una petición de autorización (RFC 6749 §4.1.1 + PKCE). La usan
// la pantalla de consentimiento (GET) y el endpoint que emite el código (POST):
// el POST vuelve a validar todo porque los campos ocultos del formulario no se
// pueden fiar.

export type AuthorizeParams = {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
};

export type AuthorizeCheck =
  // fatal: el cliente o la redirección no son fiables → NO se redirige, se muestra el error.
  | { ok: false; fatal: true; message: string }
  // no fatal: se puede redirigir de vuelta al cliente con el error.
  | { ok: false; fatal: false; redirectUri: string; state: string | null; error: string; description: string }
  | ({ ok: true } & AuthorizeParams);

export async function validateAuthorize(p: Record<string, string | undefined>): Promise<AuthorizeCheck> {
  const client = await findClient(p.client_id);
  if (!client) return { ok: false, fatal: true, message: "La aplicación que intenta conectarse no está registrada." };

  const redirectUri = p.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
  if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
    return { ok: false, fatal: true, message: "La dirección de retorno no coincide con la registrada por la aplicación." };
  }

  const state = p.state ?? null;
  const fail = (error: string, description: string): AuthorizeCheck => ({
    ok: false,
    fatal: false,
    redirectUri,
    state,
    error,
    description,
  });

  if (p.response_type !== "code") return fail("unsupported_response_type", "Solo se admite response_type=code.");
  // PKCE obligatorio (OAuth 2.1): sin él, un código robado se podría canjear.
  if (!p.code_challenge || p.code_challenge_method !== "S256") {
    return fail("invalid_request", "Falta PKCE: code_challenge y code_challenge_method=S256 son obligatorios.");
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge)) return fail("invalid_request", "code_challenge inválido.");

  return { ok: true, client, redirectUri, codeChallenge: p.code_challenge, state };
}

export function redirectWith(uri: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

// Primer valor de cada parámetro (los query strings repetidos se ignoran).
export function firstValues(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}
