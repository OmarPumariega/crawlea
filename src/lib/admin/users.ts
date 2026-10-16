import { prisma } from "@/lib/db/prisma";
import { effectiveUserLimitUsd, getPlan } from "@/lib/plans";

// Consultas del panel de administración de cuentas (Fase 2). Solo se llaman
// desde rutas/páginas ya protegidas con isAdmin().

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  plan: string;
  planOverride: boolean;
  projectCount: number;
  spentUsd: number; // DataForSEO del mes natural en curso
  limitUsd: number | null; // tope efectivo (override → plan); null = sin tope
  lastUsageAt: Date | null;
  createdAt: Date;
};

export function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Gasto DataForSEO del mes por cuenta en UNA query agrupada (no N+1). Se
// agrupa por proyecto y se suma por dueño en memoria: Prisma no agrupa por una
// relación. Los registros sin proyecto no cuentan para ninguna cuenta (mismo
// criterio que getUserMonthSpendUsd).
export async function spendByUser(): Promise<Map<string, number>> {
  const rows = await prisma.apiUsageLog.groupBy({
    by: ["projectId"],
    where: { api: "dataforseo", projectId: { not: null }, createdAt: { gte: startOfMonth() } },
    _sum: { costUsd: true },
  });
  const projectIds = rows.map((r) => r.projectId).filter((id): id is string => id !== null);
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, userId: true },
  });
  const owner = new Map(projects.map((p) => [p.id, p.userId]));
  const byUser = new Map<string, number>();
  for (const r of rows) {
    const uid = r.projectId ? owner.get(r.projectId) : undefined;
    if (!uid) continue;
    byUser.set(uid, (byUser.get(uid) ?? 0) + (r._sum.costUsd ? Number(r._sum.costUsd) : 0));
  }
  return byUser;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const [users, spend, lastUsage] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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
        _count: { select: { projects: true } },
      },
    }),
    spendByUser(),
    prisma.apiUsageLog.groupBy({
      by: ["projectId"],
      where: { projectId: { not: null } },
      _max: { createdAt: true },
    }),
  ]);

  const projects = await prisma.project.findMany({ select: { id: true, userId: true } });
  const owner = new Map(projects.map((p) => [p.id, p.userId]));
  const lastByUser = new Map<string, Date>();
  for (const r of lastUsage) {
    const uid = r.projectId ? owner.get(r.projectId) : undefined;
    const at = r._max.createdAt;
    if (!uid || !at) continue;
    const prev = lastByUser.get(uid);
    if (!prev || at > prev) lastByUser.set(uid, at);
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    plan: u.plan,
    planOverride: u.planOverride,
    projectCount: u._count.projects,
    spentUsd: spend.get(u.id) ?? 0,
    limitUsd: u.role === "admin" ? null : effectiveUserLimitUsd(u.plan, u.spendLimitOverrideUsd),
    lastUsageAt: lastByUser.get(u.id) ?? null,
    createdAt: u.createdAt,
  }));
}

export function planName(planId: string): string {
  return getPlan(planId).nombre;
}
