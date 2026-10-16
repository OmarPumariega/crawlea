import { cancelStripeSubscriptionForUser } from "@/lib/stripe/sync";
import { NextRequest, NextResponse } from "next/server";
import { requireSession, isAdmin, unauthorized } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import { PLANS } from "@/lib/plans";
import { getUserMonthSpendUsd } from "@/lib/dataforseo/spend";

type Ctx = { params: Promise<{ id: string }> };

const forbidden = () => NextResponse.json({ error: "Prohibido" }, { status: 403 });

// Detalle de una cuenta — solo admin.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      plan: true,
      planOverride: true,
      spendLimitOverrideUsd: true,
      createdAt: true,
      projects: { select: { id: true, name: true, domain: true }, orderBy: { name: "asc" } },
      googleConnection: { select: { googleEmail: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  return NextResponse.json({ ...user, spentUsd: await getUserMonthSpendUsd(id) });
}

// Cambios de estado/plan/tope de una cuenta — solo admin. Las cuentas admin
// (incluida la propia) no se tocan desde aquí: evita quedarse sin operador.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (target.role === "admin" || target.id === session.user.id) {
    return NextResponse.json(
      { error: "Las cuentas de administración de la plataforma no se modifican desde aquí." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 });
  }

  const data: {
    status?: string;
    plan?: string;
    planOverride?: boolean;
    spendLimitOverrideUsd?: number | null;
  } = {};

  if ("status" in body) {
    if (body.status !== "active" && body.status !== "suspended") {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    data.status = body.status;
  }
  if ("plan" in body) {
    if (typeof body.plan !== "string" || !PLANS[body.plan]) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }
    data.plan = body.plan;
    data.planOverride = true; // asignado a mano: el webhook de Stripe no lo pisará
  }
  if ("spendLimitOverrideUsd" in body) {
    const v = body.spendLimitOverrideUsd;
    if (v === null) {
      data.spendLimitOverrideUsd = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100000) {
      data.spendLimitOverrideUsd = v;
    } else {
      return NextResponse.json({ error: "Tope inválido (número mayor que 0, o null para quitarlo)" }, { status: 400 });
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, status: true, plan: true, planOverride: true, spendLimitOverrideUsd: true },
  });
  return NextResponse.json(updated);
}

// Borrado de cuenta en cascada (proyectos y datos). ApiUsageLog sobrevive
// (projectId SetNull) como dato contable.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  if (!isAdmin(session)) return forbidden();

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (target.role === "admin" || target.id === session.user.id) {
    return NextResponse.json(
      { error: "Las cuentas de administración de la plataforma no se pueden borrar." },
      { status: 403 }
    );
  }

  try {
    await cancelStripeSubscriptionForUser(id);
  } catch {
    return NextResponse.json({ error: "No se pudo cancelar la suscripción en Stripe; la cuenta no se ha borrado." }, { status: 502 });
  }
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
