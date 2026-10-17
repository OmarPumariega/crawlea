import { cn } from "@/lib/utils";

// Gráficos pequeños y sin dependencias, con la rampa índigo de la guía.

// Medidor circular: un porcentaje de un vistazo (p. ej. % de keywords en top 10).
export function RadialGauge({
  value,
  size = 84,
  label,
  className,
  onBrand = false,
  unit = "%",
}: {
  value: number; // 0-100
  size?: number;
  label?: string;
  className?: string;
  // Sobre una tarjeta de fondo índigo: arco blanco sobre pista blanca translúcida
  // (índigo sobre índigo no se distingue).
  onBrand?: boolean;
  unit?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = Math.round(size * 0.13);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={onBrand ? "stroke-white/25" : "stroke-brand-50"} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
            className={cn("transition-[stroke-dashoffset]", onBrand ? "stroke-white" : "stroke-brand-500")}
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums tracking-tight", onBrand ? "text-white" : "text-ink")}>
          {Math.round(v)}{unit}
        </span>
      </div>
      {label && <span className="mt-1 text-[11px] font-medium text-ink-faint">{label}</span>}
    </div>
  );
}

// Línea de tendencia con relleno suave (trazo 2,5 px brand-500 y degradado al 18 % → 0, como pide la guía).
export function AreaSpark({ points, height = 56, className }: { points: number[]; height?: number; className?: string }) {
  if (points.length < 2) return null;
  const W = 200;
  const H = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - min) / range) * (H - 8);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const id = `g${points.join("").length}${points[0]}${points[points.length - 1]}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("w-full text-brand-500", className)} style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Lista de barras: etiqueta, barra proporcional al máximo y valor a la derecha.
export function BarList({
  items,
  className,
}: {
  items: { label: string; value: number; display?: string; tag?: string }[];
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((it, i) => (
        <li key={`${it.label}-${i}`}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-ink">{it.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              {it.tag && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-accent-ink">{it.tag}</span>}
              <span className="font-semibold tabular-nums text-ink-soft">{it.display ?? it.value.toLocaleString("es-ES")}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-50">
            <div className="h-full rounded-full bg-brand-300" style={{ width: `${Math.max(4, (it.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
