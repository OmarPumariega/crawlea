import { requireSession, projectForSession, moduleGate } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

// Tendencia de visibilidad de un dominio (tráfico/keywords a lo largo del
// tiempo, según se van acumulando snapshots al analizar). Sin coste (lee
// históórico local). ?domain=X — si no viene, usa el dominio del proyecto.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const gate = await moduleGate(session, "competidores");
  if (gate) return gate;

  const { id } = await params;

  if (!(await projectForSession(session, id, { id: true })))
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const domain = req.nextUrl.searchParams.get("domain");

  const snapshots = await prisma.visibilitySnapshot.findMany({
    where: domain ? { projectId: id, domain } : { projectId: id },
    orderBy: { fetchedAt: "asc" },
    select: { domain: true, organicTraffic: true, organicKeywords: true, fetchedAt: true },
    take: 100,
  });

  return NextResponse.json(snapshots);
}
