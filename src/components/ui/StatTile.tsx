import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tarjeta KPI: etiqueta pequeña → cifra grande → apoyo. Va en una fila de 3-4
// al principio de la pantalla para que lo primero que se lea sea el resumen.
export default function StatTile({
  label,
  value,
  hint,
  icon,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  // Una sola tarjeta destacada por fila (fondo índigo, como pide la guía).
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border p-5",
        highlight ? "border-transparent bg-brand text-white shadow-[0_10px_30px_-12px_rgba(79,92,245,0.6)]" : "border-line bg-surface shadow-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[13px] font-semibold", highlight ? "text-white/75" : "text-ink-soft")}>{label}</p>
        {icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", highlight ? "bg-white/15 text-white" : "bg-brand-50 text-brand")}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
      {hint && <p className={cn("mt-2 text-xs", highlight ? "text-white/70" : "text-ink-faint")}>{hint}</p>}
    </div>
  );
}
