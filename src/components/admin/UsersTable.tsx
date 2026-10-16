"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import Pill from "@/components/app/Pill";
import { PLANS } from "@/lib/plans";

export type UserRowDTO = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  plan: string;
  planOverride: boolean;
  projectCount: number;
  spentUsd: number;
  limitUsd: number | null;
  lastUsageAt: string | null;
  createdAt: string;
};

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

export default function UsersTable({ users }: { users: UserRowDTO[] }) {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!needle || u.email.toLowerCase().includes(needle) || (u.name ?? "").toLowerCase().includes(needle)) &&
        (!plan || u.plan === plan) &&
        (!status || u.status === status)
    );
  }, [users, q, plan, status]);

  const field =
    "bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar email o nombre…" className={`${field} pl-9 w-64`} />
        </div>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={field}>
          <option value="">Todos los planes</option>
          {Object.values(PLANS).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
          <option value="">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="suspended">Suspendidas</option>
        </select>
      </div>

      <div className="rounded-2xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-faint border-b border-line">
              <th className="font-medium p-3">Cuenta</th>
              <th className="font-medium p-3">Plan</th>
              <th className="font-medium p-3">Estado</th>
              <th className="font-medium p-3 text-right">Proyectos</th>
              <th className="font-medium p-3 text-right">Gasto del mes</th>
              <th className="font-medium p-3">Último consumo</th>
              <th className="font-medium p-3">Alta</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-background">
                <td className="p-3">
                  <Link href={`/admin/usuarios/${u.id}`} className="block">
                    <span className="text-ink font-medium">{u.email}</span>
                    {u.name && <span className="block text-xs text-ink-faint">{u.name}</span>}
                  </Link>
                </td>
                <td className="p-3 text-ink-soft">
                  {PLANS[u.plan]?.nombre ?? u.plan}
                  {u.planOverride && <span className="text-xs text-ink-faint"> · manual</span>}
                </td>
                <td className="p-3">
                  {u.role === "admin" ? <Pill tone="brand">Admin</Pill> : u.status === "suspended" ? <Pill tone="danger">Suspendida</Pill> : <Pill tone="info">Activa</Pill>}
                </td>
                <td className="p-3 text-right tabular-nums text-ink-soft">{u.projectCount}</td>
                <td className="p-3 text-right tabular-nums text-ink">
                  {u.spentUsd.toFixed(2)}$
                  {u.limitUsd !== null && <span className="text-xs text-ink-faint"> / {u.limitUsd.toFixed(2)}$</span>}
                </td>
                <td className="p-3 text-ink-soft">{fecha(u.lastUsageAt)}</td>
                <td className="p-3 text-ink-soft">{fecha(u.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-5 text-ink-soft">Ninguna cuenta coincide con el filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
