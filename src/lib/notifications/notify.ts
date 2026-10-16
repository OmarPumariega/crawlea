import { prisma } from "@/lib/db/prisma";
import { usdToCredits } from "@/lib/credits";
import { isEmailConfigured, sendEmail } from "@/lib/notifications/email";
import { getMonthSpendUsd, getMonthlyLimitUsd, getUserMonthSpendUsd } from "@/lib/dataforseo/spend";
import { effectiveUserLimitUsd } from "@/lib/plans";

// Punto único de entrada para avisos por email. Dedupe: si ya existe un
// NotificationLog con (userId, type, key), no se reenvía. Así una auditoría
// se avisa una vez, una caída de posición se avisa una vez por keyword y día,
// etc. — sin espamear.
//
// En el SaaS el destinatario es el dueño del aviso: los avisos de proyecto
// (auditoría, rank) llegan al email del usuario dueño del proyecto; los
// avisos de plataforma (tope global de DataForSEO) llegan al primer admin
// (ALERT_TO como fallback si no se resuelve usuario).
export async function notify(params: {
  userId?: string;
  type: string;
  key: string;
  subject: string;
  body: string;
}): Promise<void> {
  if (!(await isEmailConfigured())) return; // sin SMTP → no-op silencioso

  // NotificationLog.userId es obligatorio: los avisos de plataforma (sin
  // userId explícito) se registran contra el primer admin.
  let ownerId = params.userId;
  let to: string | undefined;
  if (ownerId) {
    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true },
    });
    if (!user) return;
    to = user.email;
  } else {
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
    if (!admin) return;
    ownerId = admin.id;
    to = admin.email;
  }

  // Dedupe: si ya avisamos de esta (userId, type, key), no repetimos.
  const already = await prisma.notificationLog.findUnique({
    where: { userId_type_key: { userId: ownerId, type: params.type, key: params.key } },
    select: { id: true },
  });
  if (already) return;

  const ok = await sendEmail({ to, subject: params.subject, text: params.body });
  if (ok) {
    // Idempotente por si dos ticks del cron compiten.
    await prisma.notificationLog
      .upsert({
        where: { userId_type_key: { userId: ownerId, type: params.type, key: params.key } },
        create: { userId: ownerId, type: params.type, key: params.key },
        update: {},
      })
      .catch(() => {});
  }
}

// Avisos de gasto de DataForSEO cerca o superando los topes. Llamado desde el
// cron cada tick; el dedupe (key por tipo+fecha) lo limita a un aviso por día
// y por tipo. Dos niveles:
// - Tope global de plataforma → primer admin.
// - Tope del plan de cada cuenta → cada usuario con su consumo.
export async function checkSpendNotifications(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Tope global de la plataforma (vista de operador).
  const limit = await getMonthlyLimitUsd();
  if (limit !== null) {
    const spent = await getMonthSpendUsd();
    if (spent >= limit) {
      await notify({
        type: "spend_exceeded",
        key: today,
        subject: "⚠️ Tope de gasto de DataForSEO superado",
        body: `El gasto mensual GLOBAL de DataForSEO ha superado el tope configurado: ${spent.toFixed(2)}$ de ${limit.toFixed(2)}$. Las nuevas llamadas de toda la plataforma están bloqueadas hasta el próximo mes o hasta que subas el tope en Configuración.`,
      });
    } else if (spent >= limit * 0.8) {
      await notify({
        type: "spend_warning",
        key: today,
        subject: "Tope de gasto de DataForSEO cercano",
        body: `Gasto mensual GLOBAL de DataForSEO en el 80%: ${spent.toFixed(2)}$ de ${limit.toFixed(2)}$. Revisa el panel de costes por si quieres ajustar frecuencia/depth de los seguimientos.`,
      });
    }
  }

  // Tope del plan de cada cuenta (vista de cliente).
  const users = await prisma.user.findMany({
    where: { role: "user", status: "active" },
    select: { id: true, plan: true, spendLimitOverrideUsd: true },
  });
  for (const user of users) {
    const userLimit = effectiveUserLimitUsd(user.plan, user.spendLimitOverrideUsd);
    if (userLimit === null) continue;

    const spent = await getUserMonthSpendUsd(user.id);
    if (spent >= userLimit) {
      await notify({
        userId: user.id,
        type: "spend_exceeded",
        key: `plan:${today}`,
        subject: "⚠️ Has agotado tus créditos de este mes",
        body: `Has gastado los ${usdToCredits(userLimit).toLocaleString("es-ES")} créditos de este mes. Las consultas de pago quedan bloqueadas hasta que se renueven, el día 1 del mes que viene, o hasta que subas de plan.`,
      });
    } else if (spent >= userLimit * 0.8) {
      await notify({
        userId: user.id,
        type: "spend_warning",
        key: `plan:${today}`,
        subject: "Te quedan pocos créditos este mes",
        body: `Has usado ${usdToCredits(spent).toLocaleString("es-ES")} de ${usdToCredits(userLimit).toLocaleString("es-ES")} créditos (80%) de este mes. Revisa tus seguimientos de posiciones para ajustar la frecuencia o valora subir de plan.`,
      });
    }
  }
}
