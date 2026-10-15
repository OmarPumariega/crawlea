import { requireSession, projectForSession } from "@/lib/auth-guards";
import { NextRequest, NextResponse } from "next/server";
import { computeVisibilitySeries } from "@/lib/rank/visibility";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  if (!(await projectForSession(session, id, { id: true })))
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const group = req.nextUrl.searchParams.get("group") ?? undefined;
  const series = await computeVisibilitySeries(id, group || undefined);
  return NextResponse.json(series);
}
