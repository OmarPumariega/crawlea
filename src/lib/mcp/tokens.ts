import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

// Tokens personales del MCP. Formato `crw_<43 caracteres base64url>` (256 bits).
// En BD solo vive el hash SHA-256: un volcado de la base de datos no permite
// usar los tokens, y el valor real solo se enseña una vez, al crearlo.
export const TOKEN_PREFIX = "crw_";
export const MAX_ACTIVE_TOKENS = 10;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): { raw: string; hash: string; prefix: string } {
  const raw = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, 10) };
}

// Evita una escritura en BD por cada llamada: lastUsedAt se refresca como
// mucho una vez por minuto y token.
const TOUCH_EVERY_MS = 60_000;

export type VerifiedToken = { tokenId: string; userId: string };

export async function verifyToken(raw: string): Promise<VerifiedToken | null> {
  if (raw.length > 128) return null;

  // Token de acceso del conector OAuth (corto, 1 hora; lo emite /api/oauth/token).
  if (raw.startsWith("crwo_")) {
    const grant = await prisma.oAuthGrant.findUnique({
      where: { accessHash: hashToken(raw) },
      select: { id: true, userId: true, revokedAt: true, accessExpiresAt: true, lastUsedAt: true },
    });
    if (!grant || grant.revokedAt || grant.accessExpiresAt < new Date()) return null;
    if (!grant.lastUsedAt || Date.now() - grant.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
      await prisma.oAuthGrant.update({ where: { id: grant.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }
    return { tokenId: grant.id, userId: grant.userId };
  }

  // Token personal creado a mano en Mi perfil.
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { id: true, userId: true, revokedAt: true, lastUsedAt: true },
  });
  if (!token || token.revokedAt) return null;

  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await prisma.apiToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return { tokenId: token.id, userId: token.userId };
}
