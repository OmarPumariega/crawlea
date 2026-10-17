import { requireSession, projectForSession } from "@/lib/auth-guards";
import { NextRequest, NextResponse } from "next/server";
import { computeShareOfVoice } from "@/lib/rank/share-of-voice";
import { normalizeDomain } from "@/lib/rank/serp";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const project = await projectForSession(session, id, { id: true, domain: true });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const group = req.nextUrl.searchParams.get("group") ?? undefined;
  return NextResponse.json(await computeShareOfVoice(id, project.domain ? normalizeDomain(project.domain) : null, group || undefined));
}
