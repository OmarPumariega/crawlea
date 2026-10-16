import { cancelStripeSubscriptionForUser } from "@/lib/stripe/sync";
import { requireSession, isAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

// Perfil de la cuenta autenticada. DELETE borra la cuenta: cascada de
// proyectos y datos (onDelete: Cascade en el schema). El admin de la
// plataforma no puede borrarse a sí mismo desde aquí — sería quedarse sin
// nadie operando la instalación (se gestiona desde el panel de admin).
export async function DELETE() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (isAdmin(session)) {
    return NextResponse.json(
      { error: "La cuenta de administración de la plataforma no se puede borrar desde el perfil." },
      { status: 403 }
    );
  }

  try {
    await cancelStripeSubscriptionForUser(session.user.id);
  } catch {
    return NextResponse.json(
      { error: "No hemos podido cancelar tu suscripción. Cancélala desde Gestionar suscripción y vuelve a intentarlo." },
      { status: 502 }
    );
  }
  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ ok: true });
}
