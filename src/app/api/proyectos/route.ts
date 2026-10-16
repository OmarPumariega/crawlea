import { requireSession, isAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/lib/utils";
import { getPlan } from "@/lib/plans";
import { normalizeRequiredText, normalizeText, MAX_LONG } from "@/lib/validation";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Aislamiento multi-tenant: cada usuario ve solo sus proyectos. El admin
  // de la plataforma ve todos (soporte desde el panel de administración).
  const projects = await prisma.project.findMany({
    where: isAdmin(session) ? undefined : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Límite de proyectos del plan (el admin de la plataforma no está limitado).
  if (!isAdmin(session)) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, _count: { select: { projects: true } } },
    });
    const maxProyectos = getPlan(user?.plan).maxProyectos;
    if (maxProyectos !== null && (user?._count.projects ?? 0) >= maxProyectos) {
      return NextResponse.json(
        {
          error: `Tu plan ${getPlan(user?.plan).nombre} permite hasta ${maxProyectos} ${
            maxProyectos === 1 ? "proyecto" : "proyectos"
          }. Sube de plan para crear más.`,
        },
        { status: 402 }
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }

  const name = normalizeRequiredText(body.name);
  const slug = slugify(typeof body.slug === "string" && body.slug ? body.slug : name);

  if (!name || !slug)
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing)
    return NextResponse.json(
      { error: "Ya existe un proyecto con ese identificador" },
      { status: 409 }
    );

  const hoursText = normalizeText(body.hours, MAX_LONG);

  function parseCoord(key: "lat" | "lng", min: number, max: number): number | undefined {
    const n = Number(body[key]);
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  }
  const lat = parseCoord("lat", -90, 90);
  const lng = parseCoord("lng", -180, 180);

  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      name,
      slug,
      domain: normalizeText(body.domain)?.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      isLocalBusiness: Boolean(body.isLocalBusiness),
      businessName: normalizeText(body.businessName),
      address: normalizeText(body.address, MAX_LONG),
      phone: normalizeText(body.phone),
      hours: hoursText ? { text: hoursText } : undefined,
      lat,
      lng,
      gbpName: normalizeText(body.gbpName),
      gbpPlaceId: normalizeText(body.gbpPlaceId),
    },
  });

  return NextResponse.json(project, { status: 201 });
}
