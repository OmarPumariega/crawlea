import { requireSession, projectForSession, unauthorized, projectNotFound } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { newShareToken, shareUrl, monthKey, previousMonth, sendProjectReportEmail } from "@/lib/informe/share";
import { isEmailConfigured } from "@/lib/notifications/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Enlace público del informe + envío mensual al cliente.
// PATCH { enabled?: boolean, emailTo?: string | null }
//   enabled=false revoca el enlace (y apaga el envío mensual).
//   emailTo con valor activa el envío mensual (crea el enlace si no existía).
// POST  → "Enviar ahora": manda por email el informe del mes anterior.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const project = await projectForSession(session, id, {
    id: true, reportShareToken: true, reportEmailTo: true,
  });
  if (!project) return projectNotFound();

  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown; emailTo?: unknown };
  const data: { reportShareToken?: string | null; reportEmailTo?: string | null; reportEmailLastMonth?: string | null } = {};

  if (body.enabled === false) {
    data.reportShareToken = null;
    data.reportEmailTo = null;
    data.reportEmailLastMonth = null;
  } else if (body.enabled === true && !project.reportShareToken) {
    data.reportShareToken = newShareToken();
  }

  if (body.emailTo !== undefined && body.enabled !== false) {
    if (body.emailTo === null || body.emailTo === "") {
      data.reportEmailTo = null;
      data.reportEmailLastMonth = null;
    } else if (typeof body.emailTo === "string" && EMAIL_RE.test(body.emailTo.trim())) {
      data.reportEmailTo = body.emailTo.trim().toLowerCase();
      if (!project.reportShareToken && !data.reportShareToken) data.reportShareToken = newShareToken();
      // Al activarlo, el primer envío es el del mes que viene: así no sale de
      // golpe un informe que nadie ha pedido. "Enviar ahora" lo adelanta.
      const prev = previousMonth();
      data.reportEmailLastMonth = monthKey(prev.year, prev.month);
    } else {
      return NextResponse.json({ error: "Email no válido" }, { status: 400 });
    }
  }

  const updated = await prisma.project.update({
    where: { id },
    data,
    select: { reportShareToken: true, reportEmailTo: true },
  });
  return NextResponse.json({
    token: updated.reportShareToken,
    emailTo: updated.reportEmailTo,
    url: updated.reportShareToken ? shareUrl(updated.reportShareToken) : null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const project = await projectForSession(session, id, {
    id: true, name: true, reportShareToken: true, reportEmailTo: true,
  });
  if (!project) return projectNotFound();
  if (!project.reportShareToken || !project.reportEmailTo) {
    return NextResponse.json({ error: "Indica primero el email del cliente" }, { status: 400 });
  }
  if (!(await isEmailConfigured())) {
    return NextResponse.json({ error: "El envío de emails no está configurado en la plataforma" }, { status: 503 });
  }
  const owner = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, brandName: true },
  });
  const { year, month } = previousMonth();
  const ok = await sendProjectReportEmail(project, owner ?? { email: session.user.email ?? "", brandName: null }, year, month);
  if (!ok) return NextResponse.json({ error: "No se pudo enviar el email" }, { status: 502 });
  return NextResponse.json({ sent: true, to: project.reportEmailTo });
}
