import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getMonthSpendUsd, getMonthlyLimitUsd } from "@/lib/dataforseo/spend";
import { listAdminUsers } from "@/lib/admin/users";
import { PLANS } from "@/lib/plans";
import PageHeader from "@/components/app/PageHeader";
import StatHero from "@/components/app/StatHero";
import Pill from "@/components/app/Pill";
import { Users, Wallet, UserPlus, AlertTriangle } from "lucide-react";

export default async function AdminResumenPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [users, monthSpend, globalLimit, newUsers] = await Promise.all([
    listAdminUsers(),
    getMonthSpendUsd(),
    getMonthlyLimitUsd(),
    prisma.user.count({ where: { createdAt: { gte: since }, role: "user" } }),
  ]);

  const clients = users.filter((u) => u.role === "user");
  const suspended = clients.filter((u) => u.status === "suspended").length;
  const overLimit = clients.filter((u) => u.limitUsd !== null && u.spentUsd >= u.limitUsd * 0.8);
  const top = [...clients].sort((a, b) => b.spentUsd - a.spentUsd).filter((u) => u.spentUsd > 0).slice(0, 5);
  const byPlan = Object.values(PLANS).map((p) => ({
    nombre: p.nombre,
    count: clients.filter((u) => u.plan === p.id).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Resumen"
        description="Cuentas, altas y consumo real de DataForSEO del mes en curso. Los ingresos y el margen llegarán con Stripe."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatHero label="Cuentas" value={String(clients.length)} sub={suspended ? `${suspended} suspendidas` : "todas activas"} icon={<Users className="h-4 w-4" />} />
        <StatHero label="Altas (30 días)" value={String(newUsers)} icon={<UserPlus className="h-4 w-4" />} />
        <StatHero
          label="Gasto DataForSEO del mes"
          value={`${monthSpend.toFixed(2)}$`}
          sub={globalLimit !== null ? `de ${globalLimit.toFixed(2)}$ de tope global` : "sin tope global"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatHero
          label="Cuentas cerca del tope"
          value={String(overLimit.length)}
          sub="≥ 80% de su tope mensual"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink">Cuentas por plan</h2>
          <ul className="space-y-2 text-sm">
            {byPlan.map((p) => (
              <li key={p.nombre} className="flex justify-between border-b border-line last:border-0 pb-2 last:pb-0">
                <span className="text-ink-soft">{p.nombre}</span>
                <span className="text-ink tabular-nums">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink">Top cuentas por gasto este mes</h2>
          {top.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin consumo de cuentas este mes.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {top.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 border-b border-line last:border-0 pb-2 last:pb-0">
                  <Link href={`/admin/usuarios/${u.id}`} className="text-ink-soft hover:text-brand truncate">
                    {u.email}
                  </Link>
                  <span className="flex items-center gap-2 shrink-0">
                    {u.limitUsd !== null && u.spentUsd >= u.limitUsd && <Pill tone="danger">Tope</Pill>}
                    <span className="text-ink tabular-nums">
                      {u.spentUsd.toFixed(2)}$
                      {u.limitUsd !== null && <span className="text-xs text-ink-faint"> / {u.limitUsd.toFixed(2)}$</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
