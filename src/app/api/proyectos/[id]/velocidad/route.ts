import { requireSession, projectForSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getPsiMetrics } from "@/lib/audit/psi";
import { getSetting } from "@/lib/settings";
import { normalizeDomain } from "@/lib/rank/serp";

// Velocidad por página (PageSpeed Insights, gratis: sin créditos). GET devuelve
// la última medición de cada URL + sugerencias (home y páginas con más clics en
// Search Console); POST mide una URL del propio dominio del proyecto.
const MAX_PER_HOUR = 30;

function sameSite(url: string, domain: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const d = normalizeDomain(domain);
    return host === d || host.endsWith("." + d);
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const rows = await prisma.pageSpeedCheck.findMany({
    where: { projectId: id },
    orderBy: { fetchedAt: "desc" },
    take: 400,
  });
  // Última medición por URL+estrategia y la anterior (para ver la tendencia).
  const latest = new Map<string, (typeof rows)[number] & { prevPerformance: number | null }>();
  for (const r of rows) {
    const key = `${r.url}|${r.strategy}`;
    const cur = latest.get(key);
    if (!cur) latest.set(key, { ...r, prevPerformance: null });
    else if (cur.prevPerformance === null) cur.prevPerformance = r.performance;
  }

  const snap = await prisma.gscSnapshot.findFirst({ where: { projectId: id }, orderBy: { createdAt: "desc" }, select: { topPages: true } });
  const topPages = ((snap?.topPages as Array<{ page: string; clicks: number }> | null) ?? []).slice(0, 8).map((p) => p.page);
  const home = project.domain ? `https://${normalizeDomain(project.domain)}/` : null;

  return NextResponse.json({
    configured: !!(await getSetting("PAGESPEED_API_KEY")),
    domain: project.domain,
    suggestions: [...new Set([...(home ? [home] : []), ...topPages])].slice(0, 9),
    checks: [...latest.values()],
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const project = await projectForSession(session, id);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (!project.domain) return NextResponse.json({ error: "Define el dominio del proyecto en su ficha." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const strategy = body.strategy === "desktop" ? "desktop" : "mobile";
  if (!sameSite(url, project.domain)) return NextResponse.json({ error: "La URL tiene que ser de la web del proyecto." }, { status: 400 });
  if (!(await getSetting("PAGESPEED_API_KEY"))) return NextResponse.json({ error: "La clave de PageSpeed no está configurada." }, { status: 409 });

  const recent = await prisma.pageSpeedCheck.count({ where: { projectId: id, fetchedAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= MAX_PER_HOUR) return NextResponse.json({ error: "Demasiadas mediciones en la última hora. Prueba más tarde." }, { status: 429 });

  const psi = await getPsiMetrics(url, strategy);
  if (!psi) return NextResponse.json({ error: "Google no ha podido medir esa página ahora mismo. Prueba de nuevo en un momento." }, { status: 502 });

  const pct = (v: number | null) => (v === null ? null : Math.round(v * 100));
  const row = await prisma.pageSpeedCheck.create({
    data: {
      projectId: id,
      url,
      strategy,
      performance: pct(psi.scores.performance),
      accessibility: pct(psi.scores.accessibility),
      bestPractices: pct(psi.scores.bestPractices),
      seo: pct(psi.scores.seo),
      lcpMs: psi.lcpMs,
      cls: psi.cls,
      inpMs: psi.inpMs,
      fieldData: (psi.fieldData ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      opportunities: psi.opportunities as unknown as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
