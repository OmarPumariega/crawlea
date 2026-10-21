import { requireSession, projectForSession, moduleGate, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET — historial de análisis de visibilidad (Labs) del proyecto y sus competidores, y de las curvas de
// evolución de tráfico pedidas. Cada fila lleva la variación frente al análisis anterior del mismo dominio.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const gate = await moduleGate(session, "competidores");
  if (gate) return gate;
  const { id } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return projectNotFound();

  const [snaps, histories] = await Promise.all([
    prisma.visibilitySnapshot.findMany({
      where: { projectId: id },
      orderBy: { fetchedAt: "desc" },
      take: 300,
      select: { id: true, domain: true, organicTraffic: true, organicKeywords: true, positionBuckets: true, fetchedAt: true },
    }),
    prisma.trafficHistory.findMany({
      where: { projectId: id },
      orderBy: { fetchedAt: "desc" },
      take: 100,
      select: { id: true, domain: true, fetchedAt: true },
    }),
  ]);

  const fmt = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("es-ES"));
  const delta = (cur: number | null, prev: number | null) => {
    if (cur == null || prev == null) return null;
    const d = Math.round(cur - prev);
    return d === 0 ? "sin cambios" : `${d > 0 ? "+" : ""}${d.toLocaleString("es-ES")}`;
  };

  const items = [
    ...snaps.map((s, i) => {
      // El análisis anterior del mismo dominio es el siguiente en la lista (orden desc).
      const prev = snaps.slice(i + 1).find((p) => p.domain === s.domain);
      const b = s.positionBuckets as { top3?: number; top10?: number; top100?: number } | null;
      const tDelta = delta(s.organicTraffic, prev?.organicTraffic ?? null);
      const kDelta = delta(s.organicKeywords, prev?.organicKeywords ?? null);
      return {
        id: `v-${s.id}`,
        title: s.domain,
        subtitle: "Análisis de visibilidad",
        date: s.fetchedAt.toISOString(),
        pills: [
          { text: `${fmt(s.organicTraffic)} visitas/mes`, tone: "brand" as const },
          { text: `${fmt(s.organicKeywords)} keywords` },
        ],
        lines: [
          ...(b ? [`Top 3: ${b.top3 ?? 0} · Top 10: ${b.top10 ?? 0} · Top 100: ${b.top100 ?? 0}`] : []),
          ...(tDelta ? [`Tráfico frente al análisis anterior: ${tDelta}`] : ["Primer análisis de este dominio"]),
          ...(kDelta ? [`Keywords frente al análisis anterior: ${kDelta}`] : []),
        ],
      };
    }),
    ...histories.map((h) => ({
      id: `h-${h.id}`,
      title: h.domain,
      subtitle: "Evolución de tráfico (curva mensual)",
      date: h.fetchedAt.toISOString(),
      pills: [] as { text: string }[],
      lines: [] as string[],
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ items });
}
