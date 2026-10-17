import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string; analysisId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "analizador");
  if (gate) return gate;
  const { id, analysisId } = await params;
  const project = await projectForSession(session, id, { id: true });
  if (!project) return projectNotFound();
  const a = await prisma.urlAnalysis.findFirst({ where: { id: analysisId, projectId: id } });
  if (!a) return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  return NextResponse.json({ id: a.id, createdAt: a.createdAt, result: a.result });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "analizador");
  if (gate) return gate;
  const { id, analysisId } = await params;
  const project = await projectForSession(session, id, { id: true });
  if (!project) return projectNotFound();
  const res = await prisma.urlAnalysis.deleteMany({ where: { id: analysisId, projectId: id } });
  if (res.count === 0) return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
