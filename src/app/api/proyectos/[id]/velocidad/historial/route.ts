import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET — todas las mediciones de PageSpeed del proyecto, con la variación de la nota frente a la medición
// anterior de la misma URL y estrategia.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  if (!(await projectForSession(session, id, { id: true }))) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const checks = await prisma.pageSpeedCheck.findMany({
    where: { projectId: id },
    orderBy: { fetchedAt: "desc" },
    take: 300,
    select: { id: true, url: true, strategy: true, performance: true, accessibility: true, seo: true, lcpMs: true, cls: true, inpMs: true, fetchedAt: true },
  });

  const items = checks.map((c, i) => {
    const prev = checks.slice(i + 1).find((p) => p.url === c.url && p.strategy === c.strategy);
    const d = c.performance != null && prev?.performance != null ? c.performance - prev.performance : null;
    return {
      id: c.id,
      title: c.url.replace(/^https?:\/\//, ""),
      subtitle: c.strategy === "mobile" ? "Móvil" : "Escritorio",
      date: c.fetchedAt.toISOString(),
      pills: [
        { text: `Rendimiento ${c.performance ?? "—"}/100`, tone: (c.performance ?? 0) >= 90 ? ("brand" as const) : ("neutral" as const) },
        ...(d != null && d !== 0 ? [{ text: `${d > 0 ? "+" : ""}${d} vs anterior`, tone: d < 0 ? ("danger" as const) : ("brand" as const) }] : []),
      ],
      lines: [
        ...(c.lcpMs != null ? [`LCP ${(c.lcpMs / 1000).toFixed(1)} s`] : []),
        ...(c.cls != null ? [`CLS ${c.cls.toFixed(3)}`] : []),
        ...(c.inpMs != null ? [`INP ${Math.round(c.inpMs)} ms`] : []),
        `Accesibilidad ${c.accessibility ?? "—"} · SEO ${c.seo ?? "—"}`,
      ],
    };
  });

  return NextResponse.json({ items });
}
