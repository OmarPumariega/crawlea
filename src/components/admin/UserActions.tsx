"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import ConfirmDialog from "@/components/app/ConfirmDialog";

// Acciones de administración sobre una cuenta: suspender/reactivar, plan,
// tope manual de gasto y borrado. Toda la validación real vive en la API.
export default function UserActions({
  userId,
  status,
  plan,
  spendLimitOverrideUsd,
}: {
  userId: string;
  status: string;
  plan: string;
  spendLimitOverrideUsd: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(spendLimitOverrideUsd?.toString() ?? "");
  const [confirm, setConfirm] = useState<"suspend" | "delete" | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "No se pudo guardar.");
      else router.refresh();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/usuarios/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "No se pudo borrar.");
      setBusy(false);
      setConfirm(null);
      return;
    }
    router.push("/admin/usuarios");
    router.refresh();
  }

  const suspended = status === "suspended";
  const field = "bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const btn = "px-3 py-2 text-sm rounded-xl border border-line text-ink-soft hover:bg-background disabled:opacity-50";

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 space-y-5">
      <h2 className="text-sm font-semibold text-ink">Acciones</h2>
      {error && <p className="text-sm text-alert-ink bg-alert-tint rounded-xl px-3 py-2">{error}</p>}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-faint">Plan (asignación manual, sin Stripe)</label>
        <select
          value={plan}
          disabled={busy}
          onChange={(e) => patch({ plan: e.target.value })}
          className={`${field} block w-full max-w-xs`}
        >
          {Object.values(PLANS).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre} · {p.precioEurMes}€/mes</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-faint">Tope de gasto mensual manual (USD) — sustituye al del plan</label>
        <div className="flex flex-wrap gap-2">
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            inputMode="decimal"
            placeholder="Sin override"
            className={`${field} w-40`}
          />
          <button
            disabled={busy || limit.trim() === ""}
            onClick={() => patch({ spendLimitOverrideUsd: Number(limit.replace(",", ".")) })}
            className={btn}
          >
            Guardar tope
          </button>
          {spendLimitOverrideUsd !== null && (
            <button
              disabled={busy}
              onClick={() => {
                setLimit("");
                patch({ spendLimitOverrideUsd: null });
              }}
              className={btn}
            >
              Quitar override
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-line">
        <button
          disabled={busy}
          onClick={() => (suspended ? patch({ status: "active" }) : setConfirm("suspend"))}
          className={btn}
        >
          {suspended ? "Reactivar cuenta" : "Suspender cuenta"}
        </button>
        <button disabled={busy} onClick={() => setConfirm("delete")} className="px-3 py-2 text-sm rounded-xl text-alert-ink bg-alert-tint hover:opacity-90 disabled:opacity-50">
          Borrar cuenta
        </button>
      </div>

      <ConfirmDialog
        open={confirm === "suspend"}
        title="¿Suspender esta cuenta?"
        description="El usuario perderá el acceso en su siguiente petición. Sus datos se conservan y puedes reactivarla cuando quieras."
        confirmLabel="Suspender"
        busy={busy}
        onConfirm={() => patch({ status: "suspended" })}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="¿Borrar la cuenta definitivamente?"
        description="Se eliminan la cuenta, todos sus proyectos y sus datos. El histórico de costes se conserva. No se puede deshacer."
        confirmLabel="Borrar cuenta"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
