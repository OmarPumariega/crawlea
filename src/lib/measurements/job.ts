import { prisma } from "@/lib/db/prisma";
import { planAllowsModule } from "@/lib/plans";
import { MEASUREMENT_MODULES, isFrequency, nextRunFrom, isMeasurementModule } from "@/lib/measurements/modules";
import { RUNNERS } from "@/lib/measurements/runners";

const MAX_PER_TICK = 3;

// Ejecuta una medición de un proyecto y anota el resultado en su programación. Compartido por el cron y por
// el botón «Medir ahora». Nunca lanza: un fallo queda como `lastStatus = "error"` con su motivo.
export async function executeMeasurement(scheduleId: string): Promise<void> {
  const sch = await prisma.measurementSchedule.findUnique({
    where: { id: scheduleId },
    include: { project: { select: { id: true, domain: true, isLocalBusiness: true, user: { select: { plan: true, role: true, status: true } } } } },
  });
  if (!sch || !isMeasurementModule(sch.module)) return;
  const def = MEASUREMENT_MODULES.find((m) => m.id === sch.module)!;
  const owner = sch.project.user;

  let status: "ok" | "error" | "skipped" = "ok";
  let message = "";
  try {
    if (owner.status !== "active") {
      status = "skipped";
      message = "La cuenta no está activa.";
    } else if (def.planModule && owner.role !== "admin" && !planAllowsModule(owner.plan, def.planModule)) {
      status = "skipped";
      message = "Tu plan ya no incluye este módulo.";
    } else {
      message = (await RUNNERS[sch.module](sch.project)).message;
    }
  } catch (e) {
    status = "error";
    message = e instanceof Error ? e.message : "Error inesperado";
  }
  await prisma.measurementSchedule.update({
    where: { id: sch.id },
    data: { lastRunAt: new Date(), lastStatus: status, lastMessage: message.slice(0, 300) },
  });
}

// Cron: ejecuta las mediciones vencidas. Antes de ejecutar adelanta `nextRunAt` al siguiente ciclo, así una
// medición lenta o fallida no se repite en el tick siguiente.
export async function runMeasurementsJob(): Promise<{ processed: number }> {
  const now = new Date();
  const due = await prisma.measurementSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: MAX_PER_TICK,
    select: { id: true, frequency: true },
  });
  for (const d of due) {
    await prisma.measurementSchedule.update({
      where: { id: d.id },
      data: { nextRunAt: nextRunFrom(now, isFrequency(d.frequency) ? d.frequency : "monthly") },
    });
    await executeMeasurement(d.id);
  }
  return { processed: due.length };
}
