import { NextRequest, NextResponse } from "next/server";
import { requireSession, isAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { generateToken, MAX_ACTIVE_TOKENS } from "@/lib/mcp/tokens";
import { MCP_ADMIN_ONLY } from "@/lib/mcp/access";
import { normalizeRequiredText } from "@/lib/validation";

// Tokens personales del MCP. Solo con sesión de navegador (el propio MCP no
// puede crear ni listar tokens: estas rutas no son herramientas suyas).

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const tokens = await prisma.apiToken.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json(tokens);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (MCP_ADMIN_ONLY && !isAdmin(session)) {
    return NextResponse.json({ error: "El MCP de Crawlea aún no está disponible para tu cuenta." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }
  const name = normalizeRequiredText(body.name)?.slice(0, 60);
  if (!name) return NextResponse.json({ error: "Ponle un nombre al token" }, { status: 400 });

  const active = await prisma.apiToken.count({ where: { userId: session.user.id, revokedAt: null } });
  if (active >= MAX_ACTIVE_TOKENS) {
    return NextResponse.json({ error: `Máximo ${MAX_ACTIVE_TOKENS} tokens activos. Revoca alguno.` }, { status: 409 });
  }

  const { raw, hash, prefix } = generateToken();
  const token = await prisma.apiToken.create({
    data: { userId: session.user.id, name, prefix, tokenHash: hash },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });
  // El valor real solo viaja aquí, una vez.
  return NextResponse.json({ ...token, token: raw }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const result = await prisma.apiToken.updateMany({
    where: { id, userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "Token no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
