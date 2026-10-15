import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Sparkline SVG mínimo: polilínea suavizada de una serie corta de valores.
// Decorativa (sin ejes): da la sensación de "dato vivo" de las referencias.
function Sparkline({ data, tone = "brand" }: { data: number[]; tone?: "brand" | "white" | "danger" | "success" }) {
  if (data.length < 2) return null;
  const w = 96;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke =
    tone === "white" ? "rgba(255,255,255,0.9)"
    : tone === "danger" ? "#dc2626"
    : tone === "success" ? "#059669"
    : "var(--brand)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-24" fill="none" aria-hidden="true">
      <polyline
        points={pts.join(" ")}
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Tarjeta de métrica protagonista: número XL + etiqueta + delta opcional
// (chip con flecha) + sparkline opcional. Es el bloque base de los bento
// de las referencias (número gigante, no tabla).
export default function StatHero({
  label,
  value,
  sub,
  icon,
  delta,
  spark,
  tone = "light",
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  delta?: { dir: "up" | "down" | "flat"; text: string };
  spark?: number[];
  tone?: "light" | "ink";
  className?: string;
}) {
  const dark = tone === "ink";
  const deltaCls =
    delta?.dir === "up"
      ? "bg-emerald-50 text-emerald-700"
      : delta?.dir === "down"
        ? "bg-red-50 text-red-700"
        : dark
          ? "bg-white/10 text-white/70"
          : "bg-gray-100 text-gray-600";
  const DeltaIcon = delta?.dir === "up" ? TrendingUp : delta?.dir === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "rounded-2xl p-5 flex flex-col gap-3 transition-shadow",
        dark
          ? "bg-brand text-white shadow-[0_10px_30px_-10px_rgba(14,107,79,0.55)]"
          : "bg-white border border-line shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)] hover:shadow-[0_6px_20px_rgba(26,29,26,0.07)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[13px] font-medium", dark ? "text-white/60" : "text-gray-500")}>
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              dark ? "bg-white/10 text-white/80" : "bg-brand/10 text-brand"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className={cn("text-4xl font-bold tracking-tight tabular-nums leading-none", dark ? "text-white" : "text-gray-900")}>
            {value}
          </div>
          {sub && <p className={cn("text-xs mt-2", dark ? "text-white/50" : "text-gray-400")}>{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                deltaCls
              )}
            >
              <DeltaIcon className="h-3 w-3" />
              {delta.text}
            </span>
          )}
          {spark && <Sparkline data={spark} tone={dark ? "white" : "brand"} />}
        </div>
      </div>
    </div>
  );
}
