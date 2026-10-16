import Link from "next/link";
import { getMonthSpendUsd, getMonthlyLimitUsd } from "@/lib/dataforseo/spend";
import { listAdminUsers, planName } from "@/lib/admin/users";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";

// Consumo del mes de DataForSEO desglosado por cuenta. El detalle por tipo de
// llamada y por proyecto sigue en /app/costes (vista global del admin).
export default async function AdminCostesPage() {
  const [users, total, limit] = await Promise.all([listAdminUsers(), getMonthSpendUsd(), getMonthlyLimitUsd()]);
  const rows = users.filter((u) => u.spentUsd > 0).sort((a, b) => b.spentUsd - a.spentUsd);
  const mes = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma · Costes"
        title="Costes por cuenta"
        description={`Gasto real de DataForSEO en ${mes}: ${total.toFixed(2)}$${limit !== null ? ` de ${limit.toFixed(2)}$ de tope global` : " (sin tope global)"}.`}
        actions={
          <Link href="/app/costes" className="px-3 py-1.5 border border-line text-ink-soft text-xs font-medium rounded-xl hover:bg-background">
            Detalle por tipo de llamada y proyecto →
          </Link>
        }
      />

      <section className="rounded-2xl border border-line bg-surface overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-ink-soft">Ninguna cuenta ha consumido este mes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint border-b border-line">
                <th className="font-medium p-3">Cuenta</th>
                <th className="font-medium p-3">Plan</th>
                <th className="font-medium p-3 text-right">Gasto</th>
                <th className="font-medium p-3 text-right">Tope</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/usuarios/${u.id}`} className="text-ink hover:text-brand">{u.email}</Link>
                  </td>
                  <td className="p-3 text-ink-soft">{planName(u.plan)}</td>
                  <td className="p-3 text-right tabular-nums text-ink">{u.spentUsd.toFixed(3)}$</td>
                  <td className="p-3 text-right tabular-nums">
                    {u.limitUsd === null ? (
                      <span className="text-ink-faint">—</span>
                    ) : u.spentUsd >= u.limitUsd ? (
                      <Pill tone="danger">{u.limitUsd.toFixed(2)}$ · alcanzado</Pill>
                    ) : (
                      <span className="text-ink-soft">{u.limitUsd.toFixed(2)}$</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
