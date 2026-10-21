import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET — historial de análisis de backlinks del proyecto y sus competidores, con la variación frente al
// análisis anterior del mismo dominio.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "backlinks");
  if (gate) return gate;
  const { id } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return projectNotFound();

  const snaps = await prisma.backlinkSnapshot.findMany({
    where: { projectId: id },
    orderBy: { fetchedAt: "desc" },
    take: 300,
    select: {
      id: true, domain: true, rank: true, backlinksTotal: true, referringDomains: true, brokenBacklinks: true,
      anchors: true, fetchedAt: true,
    },
  });

  const n = (v: number | null) => (v == null ? "—" : v.toLocaleString("es-ES"));
  const delta = (cur: number | null, prev: number | null) => {
    if (cur == null || prev == null) return null;
    const d = cur - prev;
    return d === 0 ? "sin cambios" : `${d > 0 ? "+" : ""}${d.toLocaleString("es-ES")}`;
  };

  const items = snaps.map((s, i) => {
    const prev = snaps.slice(i + 1).find((p) => p.domain === s.domain);
    const lines = [
      prev ? `Backlinks frente al análisis anterior: ${delta(s.backlinksTotal, prev.backlinksTotal) ?? "—"}` : "Primer análisis de este dominio",
      ...(prev ? [`Dominios de referencia: ${delta(s.referringDomains, prev.referringDomains) ?? "—"}`] : []),
      ...(prev ? [`Autoridad: ${delta(s.rank, prev.rank) ?? "—"}`] : []),
      ...((s.brokenBacklinks ?? 0) > 0 ? [`${s.brokenBacklinks} enlaces rotos`] : []),
      ...(s.anchors ? ["Incluye análisis de anchors"] : []),
    ];
    return {
      id: s.id,
      title: s.domain,
      subtitle: "Análisis de backlinks",
      date: s.fetchedAt.toISOString(),
      pills: [
        { text: `Autoridad ${n(s.rank)}/1000`, tone: "brand" as const },
        { text: `${n(s.backlinksTotal)} backlinks` },
        { text: `${n(s.referringDomains)} dominios` },
      ],
      lines,
    };
  });

  return NextResponse.json({ items });
}
