import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, threadId } = await params;

  if (!(await projectForSession(session, id, { id: true })))
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const thread = await prisma.copilotThread.findUnique({ where: { id: threadId } });

  if (!thread || thread.projectId !== id) {
    return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(thread);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, threadId } = await params;

  if (!(await projectForSession(session, id, { id: true })))
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const thread = await prisma.copilotThread.findUnique({ where: { id: threadId } });

  if (!thread || thread.projectId !== id) {
    return NextResponse.json({ error: "Hilo no encontrado" }, { status: 404 });
  }

  await prisma.copilotThread.delete({ where: { id: threadId } });

  return NextResponse.json({ ok: true });
}
