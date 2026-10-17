import { requireSession, unauthorized } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

// Marca blanca del informe: nombre, color y logo de la cuenta. El logo viaja
// como data URL (≤150 KB, solo imágenes rasterizadas o SVG) y se guarda en la
// propia fila — sin almacenamiento aparte.
const MAX_LOGO_CHARS = 205_000; // ~150 KB en base64
const LOGO_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    brandName?: unknown; brandColor?: unknown; brandLogo?: unknown;
  };

  const data: { brandName?: string | null; brandColor?: string | null; brandLogo?: string | null } = {};
  if (body.brandName !== undefined) {
    const n = typeof body.brandName === "string" ? body.brandName.trim().slice(0, 80) : "";
    data.brandName = n || null;
  }
  if (body.brandColor !== undefined) {
    if (body.brandColor === null || body.brandColor === "") data.brandColor = null;
    else if (typeof body.brandColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.brandColor)) data.brandColor = body.brandColor;
    else return NextResponse.json({ error: "Color no válido (usa #RRGGBB)" }, { status: 400 });
  }
  if (body.brandLogo !== undefined) {
    if (body.brandLogo === null || body.brandLogo === "") data.brandLogo = null;
    else if (typeof body.brandLogo === "string" && body.brandLogo.length <= MAX_LOGO_CHARS && LOGO_RE.test(body.brandLogo)) data.brandLogo = body.brandLogo;
    else return NextResponse.json({ error: "Logo no válido: PNG, JPG, WebP o SVG de hasta 150 KB" }, { status: 400 });
  }

  const u = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { brandName: true, brandColor: true, brandLogo: true },
  });
  return NextResponse.json(u);
}
