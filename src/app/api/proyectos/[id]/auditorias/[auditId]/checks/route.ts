import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_META, type DeepResult } from "@/lib/audit/deep/types";

// Checks de la auditoría profunda de una auditoría (o de la última completada
// con auditId="ultima"). Pensado para que una IA (vía MCP) lea qué está mal,
// cómo arreglarlo y la documentación oficial. Filtros opcionales:
// ?estado=fail,improve  ?categoria=schema
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; auditId: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, auditId } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const run =
    auditId === "ultima"
      ? await prisma.auditRun.findFirst({
          where: { projectId: id, status: "completed", deepScore: { not: null } },
          orderBy: { triggeredAt: "desc" },
          select: { id: true, projectId: true, triggeredAt: true, deepChecks: true, deepScore: true },
        })
      : await prisma.auditRun.findUnique({ where: { id: auditId }, select: { id: true, projectId: true, triggeredAt: true, deepChecks: true, deepScore: true } });

  if (!run || run.projectId !== id) return NextResponse.json({ error: "Auditoría no encontrada" }, { status: 404 });
  const deep = run.deepChecks as unknown as DeepResult | null;
  if (!deep) return NextResponse.json({ error: "Esta auditoría no incluye la revisión profunda. Ejecuta una auditoría nueva." }, { status: 404 });

  const estados = req.nextUrl.searchParams.get("estado")?.split(",").filter(Boolean);
  const categoria = req.nextUrl.searchParams.get("categoria");
  const checks = deep.checks.filter((c) => (!estados?.length || estados.includes(c.status)) && (!categoria || c.category === categoria));

  return NextResponse.json({
    auditId: run.id,
    fecha: run.triggeredAt,
    url: deep.url,
    nota: deep.score,
    categorias: Object.fromEntries(Object.entries(deep.categoryScores).map(([k, v]) => [k, { nombre: CATEGORY_META[k as keyof typeof CATEGORY_META]?.label ?? k, nota: v.score, fallos: v.fail, mejorables: v.improve, correctos: v.ok, noEvaluables: v.na }])),
    total: checks.length,
    checks,
  });
}
