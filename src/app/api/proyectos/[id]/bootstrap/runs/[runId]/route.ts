import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

// Estado de un BootstrapRun concreto, para el polling del frontend mientras
// está pending/running.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, runId } = await params;

  if (!(await projectForSession(session, id, { id: true })))
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const run = await prisma.bootstrapRun.findUnique({ where: { id: runId } });

  if (!run || run.projectId !== id) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  return NextResponse.json(run);
}
