import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { diffAudits } from "@/lib/audit/diff";

// Compara las dos últimas auditorías completadas del proyecto: qué se ha
// arreglado, qué ha aparecido nuevo y cómo se mueve la puntuación. Gratis
// (solo lee lo ya guardado).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const runs = await prisma.auditRun.findMany({
    where: { projectId: id, status: "completed" },
    orderBy: { completedAt: "desc" },
    take: 2,
    select: { id: true, completedAt: true, overallScore: true, pagesCrawled: true, truncated: true },
  });
  if (runs.length < 2) return NextResponse.json({ needsTwo: true, runs: runs.length });

  const [cur, prev] = runs;
  const [curPages, prevPages] = await Promise.all([
    prisma.auditPage.findMany({ where: { auditRunId: cur.id }, select: { url: true, issues: true } }),
    prisma.auditPage.findMany({ where: { auditRunId: prev.id }, select: { url: true, issues: true } }),
  ]);
  const norm = (rows: { url: string; issues: unknown }[]) =>
    rows.map((r) => ({ url: r.url, issues: Array.isArray(r.issues) ? (r.issues as string[]) : [] }));

  return NextResponse.json({
    cur: { completedAt: cur.completedAt, score: cur.overallScore, pages: cur.pagesCrawled, truncated: cur.truncated },
    prev: { completedAt: prev.completedAt, score: prev.overallScore, pages: prev.pagesCrawled, truncated: prev.truncated },
    diff: diffAudits(norm(prevPages), norm(curPages)),
  });
}
