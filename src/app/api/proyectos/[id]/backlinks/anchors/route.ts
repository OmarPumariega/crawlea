import { requireSession, projectForSession, moduleGate } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { postTask, DataForSeoError } from "@/lib/dataforseo/client";
import { DataForSeoSpendLimitError, assertWithinSpendLimit } from "@/lib/dataforseo/spend";
import { BACKLINK_ANCHORS_COST_USD } from "@/lib/dataforseo/pricing";
import { parseAnchors, parseNewLost } from "@/lib/backlinks/parse";
import { normalizeDomain } from "@/lib/backlinks/dataforseo";

// Anchors más usados + enlaces nuevos/perdidos de un dominio ya analizado.
// Se guardan en su último BacklinkSnapshot. Pago aparte (~0,05 $ las dos
// llamadas), por eso es un botón y no parte del análisis básico.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const gate = await moduleGate(session, "backlinks");
  if (gate) return gate;
  const { id } = await params;
  if (!(await projectForSession(session, id, { id: true }))) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }
  const domain = normalizeDomain(typeof body.domain === "string" ? body.domain : "");
  if (!domain) return NextResponse.json({ error: "Dominio inválido" }, { status: 400 });

  const snap = await prisma.backlinkSnapshot.findFirst({ where: { projectId: id, domain }, orderBy: { fetchedAt: "desc" } });
  if (!snap) return NextResponse.json({ error: "Analiza primero los backlinks de este dominio." }, { status: 409 });
  if (snap.anchors) return NextResponse.json({ anchors: snap.anchors, newLost: snap.newLost, fromCache: true });

  try {
    await assertWithinSpendLimit(id, BACKLINK_ANCHORS_COST_USD);
    const [a, n] = await Promise.all([
      postTask("/v3/backlinks/anchors/live", { target: domain, limit: 30, order_by: ["backlinks,desc"] }, "backlinks.anchors"),
      postTask("/v3/backlinks/bulk_new_lost_backlinks/live", { targets: [domain] }, "backlinks.newlost"),
    ]);
    for (const [endpoint, t] of [["backlinks.anchors", a], ["backlinks.newlost", n]] as const) {
      if (typeof t.cost === "number") await prisma.apiUsageLog.create({ data: { projectId: id, api: "dataforseo", endpoint, model: null, costUsd: t.cost } });
    }
    const anchors = parseAnchors((Array.isArray(a.result) ? a.result[0] : null) as Record<string, unknown> | null);
    const newLost = parseNewLost((Array.isArray(n.result) ? n.result[0] : null) as Record<string, unknown> | null, domain);
    await prisma.backlinkSnapshot.update({
      where: { id: snap.id },
      data: { anchors: anchors as unknown as Prisma.InputJsonValue, newLost: newLost as unknown as Prisma.InputJsonValue },
    });
    return NextResponse.json({ anchors, newLost, fromCache: false });
  } catch (error) {
    if (error instanceof DataForSeoSpendLimitError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof DataForSeoError) return NextResponse.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
