import { NextResponse } from "next/server";
import { requireSession, isAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { getUserMonthSpendUsd } from "@/lib/dataforseo/spend";
import { effectiveUserLimitUsd } from "@/lib/plans";
import { usdToCredits } from "@/lib/credits";

// Saldo de créditos de la cuenta autenticada (para la barra del menú lateral).
// Solo créditos: el cliente nunca recibe dólares ni desglose de gasto.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // El admin de la plataforma no tiene bolsa de créditos.
  if (isAdmin(session)) return NextResponse.json({ admin: true });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, spendLimitOverrideUsd: true },
  });
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const limitUsd = effectiveUserLimitUsd(user.plan, user.spendLimitOverrideUsd);
  const spentUsd = await getUserMonthSpendUsd(session.user.id);
  return NextResponse.json({
    admin: false,
    used: usdToCredits(spentUsd),
    limit: limitUsd === null ? null : usdToCredits(limitUsd),
  });
}
