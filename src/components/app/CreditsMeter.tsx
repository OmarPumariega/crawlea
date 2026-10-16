"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { creditsRenewalLabel } from "@/lib/credits";
import { cn } from "@/lib/utils";

type Balance = { used: number; limit: number | null };

// Barra de créditos del mes, siempre visible sobre la tarjeta de cuenta del
// menú lateral. Se refresca al navegar y al volver a la pestaña, así refleja el
// gasto justo después de lanzar una consulta. No aparece para el admin.
export default function CreditsMeter() {
  const pathname = usePathname();
  const [balance, setBalance] = useState<Balance | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch("/api/perfil/creditos")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d && !d.admin) setBalance({ used: d.used, limit: d.limit });
        })
        .catch(() => {});
    }
    load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, [pathname]);

  if (!balance) return null;
  const { used, limit } = balance;
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const empty = limit !== null && used >= limit;

  return (
    <Link
      href="/app/perfil"
      className="mx-3 mb-2 block rounded-xl border border-line bg-surface-muted px-3 py-2.5 transition-colors hover:border-brand-100"
      title={`Créditos del mes. Se renuevan el ${creditsRenewalLabel()}.`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-ink-soft">Créditos</span>
        <span className="text-xs font-semibold tabular-nums text-ink">
          {used.toLocaleString("es-ES")}
          {limit !== null && <span className="font-medium text-ink-faint"> / {limit.toLocaleString("es-ES")}</span>}
        </span>
      </div>
      {limit !== null ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50">
          <div
            className={cn("h-full rounded-full transition-[width]", empty ? "bg-alert" : pct >= 80 ? "bg-brand-300" : "bg-brand-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-ink-faint">Sin límite este mes</p>
      )}
      {limit !== null && (
        <p className={cn("mt-1.5 text-[11px]", empty ? "text-alert-ink" : "text-ink-faint")}>
          {empty ? `Agotados · se renuevan el ${creditsRenewalLabel()}` : `Se renuevan el ${creditsRenewalLabel()}`}
        </p>
      )}
    </Link>
  );
}
