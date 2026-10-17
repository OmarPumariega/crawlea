import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { SITE_URL } from "@/lib/site";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";

// Informe compartible con el cliente: enlace público de solo lectura
// (/informe/[token]) y envío mensual automático de ese enlace por email.
// No se genera ningún PDF en servidor — el cliente abre el informe vivo y, si
// quiere, lo guarda como PDF desde el diálogo de impresión del navegador.

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function shareUrl(token: string, year?: number, month?: number): string {
  const base = `${SITE_URL}/informe/${token}`;
  return year && month ? `${base}?year=${year}&month=${month}` : base;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Mes natural anterior al de `now` (el informe que se envía el día 1).
export function previousMonth(now = new Date()): { year: number; month: number } {
  const m = now.getMonth(); // 0-11 → el anterior en base 1 es m (o 12)
  return m === 0 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month: m };
}

function monthLabel(year: number, month: number): string {
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Envía el informe de un mes por email. Devuelve true si salió. No marca el
// dedupe: lo hace quien llama (el cron lo marca; "Enviar ahora" no).
export async function sendProjectReportEmail(
  project: { id: string; name: string; reportShareToken: string | null; reportEmailTo: string | null },
  owner: { email: string; brandName: string | null },
  year: number,
  month: number
): Promise<boolean> {
  if (!project.reportShareToken || !project.reportEmailTo) return false;
  const label = monthLabel(year, month);
  const sender = owner.brandName?.trim() || "Crawlea";
  return sendEmail({
    to: project.reportEmailTo,
    replyTo: owner.email,
    subject: `Informe SEO de ${label} · ${project.name}`,
    text: [
      "Hola,",
      "",
      `Ya está disponible el informe SEO de ${project.name} correspondiente a ${label}:`,
      shareUrl(project.reportShareToken, year, month),
      "",
      "Puedes verlo en cualquier momento y guardarlo como PDF desde el botón «Imprimir / Guardar PDF».",
      "",
      `— ${sender}`,
    ].join("\n"),
  });
}

// Cron: el informe del mes anterior se envía una sola vez, a partir del día 1
// (ya hay datos cerrados del mes). Dedupe por proyecto en reportEmailLastMonth.
export async function runReportEmailJob(): Promise<{ sent: number }> {
  if (!(await isEmailConfigured())) return { sent: 0 };
  const { year, month } = previousMonth();
  const key = monthKey(year, month);

  const due = await prisma.project.findMany({
    where: {
      reportShareToken: { not: null },
      reportEmailTo: { not: null },
      OR: [{ reportEmailLastMonth: null }, { reportEmailLastMonth: { not: key } }],
      user: { status: "active" },
    },
    select: {
      id: true, name: true, reportShareToken: true, reportEmailTo: true,
      user: { select: { email: true, brandName: true } },
    },
    take: 20,
  });

  let sent = 0;
  for (const p of due) {
    const ok = await sendProjectReportEmail(p, p.user, year, month);
    if (ok) {
      sent++;
      await prisma.project.update({ where: { id: p.id }, data: { reportEmailLastMonth: key } });
    }
  }
  return { sent };
}
