import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, auditId } = await params;

  if (!(await projectForSession(session, id, { id: true })))
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const run = await prisma.auditRun.findUnique({
    where: { id: auditId },
    include: { pages: true },
  });

  if (!run || run.projectId !== id) {
    return NextResponse.json({ error: "Auditoría no encontrada" }, { status: 404 });
  }

  return NextResponse.json(run);
}
