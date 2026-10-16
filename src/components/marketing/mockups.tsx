import { cn } from "@/lib/utils";

// Maquetas de la herramienta dibujadas en HTML/SVG con los tokens de la guía
// de estilo. Son ilustraciones con datos de EJEMPLO (la web lo indica); no
// salen de ninguna cuenta real.

const LINE = "M0 78 C 30 70, 52 74, 80 58 S 130 62, 160 44 S 215 40, 245 24 S 290 20, 320 8";

export function RankLine({ className, len = 420 }: { className?: string; len?: number }) {
  return (
    <svg viewBox="0 0 320 96" className={cn("w-full", className)} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="rl-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4F5CF5" stopOpacity=".28" />
          <stop offset="1" stopColor="#4F5CF5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[20, 44, 68].map((y) => (
        <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="currentColor" strokeOpacity=".08" />
      ))}
      <path d={`${LINE} L320 96 L0 96 Z`} fill="url(#rl-fill)" className="mk-fade" />
      <path d={LINE} stroke="#4F5CF5" strokeWidth="3" strokeLinecap="round" className="mk-draw" style={{ ["--len" as string]: len }} />
      <path d="M0 84 C 40 80, 90 82, 140 74 S 240 70, 320 60" stroke="#C3CAFF" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
      <circle cx="320" cy="8" r="5" fill="#4F5CF5" />
      <circle cx="320" cy="8" r="10" fill="#4F5CF5" opacity=".2" />
    </svg>
  );
}

export function Bars({ values, highlight, className }: { values: number[]; highlight?: number; className?: string }) {
  const hi = highlight ?? values.length - 1;
  return (
    <div className={cn("flex items-end gap-1.5", className)} aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("mk-grow w-full rounded-t-lg", i === hi ? "bg-brand" : "bg-chart-muted")}
          style={{ height: `${v}%`, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}

export function Donut({ value, className }: { value: number; className?: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative aspect-square", className)} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="14" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke="#4F5CF5" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="mk-draw" style={{ ["--len" as string]: c }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold tracking-[-0.03em] text-ink tabular-nums">{value}</span>
    </div>
  );
}

// Mapa de calor del geogrid: 5×5 con la escala brand-50 → brand-500.
const HEAT = [
  [1, 2, 2, 1, 0], [2, 3, 4, 3, 1], [2, 4, 4, 4, 2], [1, 3, 4, 3, 2], [0, 1, 2, 2, 1],
];
const HEAT_COLORS = ["#EEF0FF", "#C3CAFF", "#9DA8FF", "#7381FF", "#4F5CF5"];
export function GeoHeat({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-5 gap-1.5", className)} aria-hidden="true">
      {HEAT.flat().map((v, i) => (
        <span key={i} className="aspect-square rounded-lg mk-fade" style={{ background: HEAT_COLORS[v], animationDelay: `${(i % 5) * 80 + Math.floor(i / 5) * 80}ms` }} />
      ))}
    </div>
  );
}

export function Pill({ children, tone = "up" }: { children: React.ReactNode; tone?: "up" | "down" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
        tone === "up" && "bg-accent-tint text-accent-ink",
        tone === "down" && "bg-alert-tint text-alert-ink",
        tone === "neutral" && "bg-surface-muted text-ink-soft"
      )}
    >
      {children}
    </span>
  );
}

// Ventana de la herramienta para el hero: sidebar + KPIs + gráfico + tabla.
export function DashboardMockup({ className }: { className?: string }) {
  const nav = ["Resumen", "Posiciones", "Auditoría", "Backlinks", "Geogrid", "Informe"];
  const rows = [
    ["software seo para agencias", "3", "▲ 4"],
    ["rastreo de posiciones", "7", "▲ 2"],
    ["auditoría técnica web", "12", "▼ 1"],
    ["backlinks de la competencia", "9", "▲ 6"],
  ];
  return (
    <div className={cn("overflow-hidden rounded-[20px] border border-line bg-surface text-ink shadow-[0_40px_90px_-20px_rgba(10,12,50,0.7)]", className)} aria-label="Maqueta de la herramienta con datos de ejemplo">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-muted px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-3 hidden rounded-full bg-surface px-3 py-1 text-[11px] text-ink-faint sm:inline">crawlea.com/app</span>
      </div>
      <div className="grid grid-cols-[150px_1fr] max-sm:grid-cols-1">
        <aside className="hidden space-y-1 border-r border-line p-3 sm:block">
          {nav.map((n, i) => (
            <div key={n} className={cn("rounded-xl px-3 py-2 text-xs font-semibold", i === 1 ? "bg-brand text-white" : "text-ink-soft")}>{n}</div>
          ))}
        </aside>
        <div className="space-y-4 bg-background p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Posición media", "8,4", "▲ 1,2 pts"],
              ["Visibilidad", "68,4 %", "▲ 4,2 pts"],
              ["Salud web", "82", "▲ 3 pts"],
            ].map(([l, v, d]) => (
              <div key={l} className="rounded-2xl border border-line bg-surface p-3">
                <p className="truncate text-[10px] font-semibold text-ink-faint sm:text-[11px]">{l}</p>
                <p className="mt-0.5 text-xl font-extrabold tracking-[-0.03em] tabular-nums sm:text-2xl">{v}</p>
                <Pill>{d}</Pill>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold">Evolución de posiciones</p>
              <Pill tone="neutral">90 días</Pill>
            </div>
            <RankLine className="text-ink" />
          </div>
          <div className="hidden rounded-2xl border border-line bg-surface sm:block">
            {rows.map(([k, p, d]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-xs last:border-0">
                <span className="truncate text-ink-soft">«{k}»</span>
                <span className="flex items-center gap-3">
                  <span className="font-bold tabular-nums">{p}</span>
                  <Pill tone={d.startsWith("▼") ? "down" : "up"}>{d}</Pill>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BacklinksMini({ className }: { className?: string }) {
  const rows = [
    ["blog-ejemplo.es", 72],
    ["revista-sector.com", 64],
    ["directorio-pyme.es", 51],
    ["foro-marketing.net", 38],
  ] as const;
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden="true">
      {rows.map(([d, a]) => (
        <div key={d} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-brand">{d[0].toUpperCase()}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{d}</span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-chart-track"><span className="block h-full rounded-full bg-brand" style={{ width: `${a}%` }} /></span>
          <span className="w-6 text-right text-xs font-bold tabular-nums text-ink">{a}</span>
        </div>
      ))}
    </div>
  );
}

export function KeywordRows({ className }: { className?: string }) {
  const rows = [
    ["software seo", "2.400", "Comercial"],
    ["qué es el seo local", "880", "Informativa"],
    ["auditoría web gratis", "1.300", "Mixta"],
  ];
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {rows.map(([k, v, t]) => (
        <div key={k} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs">
          <span className="truncate font-semibold text-ink">«{k}»</span>
          <span className="flex shrink-0 items-center gap-2"><span className="tabular-nums text-ink-soft">{v}</span><Pill tone="neutral">{t}</Pill></span>
        </div>
      ))}
      <p className="px-1 text-[11px] text-ink-faint">Volumen mensual estimado.</p>
    </div>
  );
}

export function CompetitorBars({ className }: { className?: string }) {
  const rows = [["Tu web", 62, true], ["competidor-a.es", 78, false], ["competidor-b.com", 45, false], ["competidor-c.es", 31, false]] as const;
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      {rows.map(([n, v, me]) => (
        <div key={n}>
          <div className="mb-1 flex justify-between text-[11px]"><span className={me ? "font-bold text-ink" : "text-ink-soft"}>{n}</span><span className="tabular-nums text-ink-faint">{v} %</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-chart-track"><div className={cn("h-full rounded-full", me ? "bg-brand" : "bg-chart-muted")} style={{ width: `${v}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function ContentMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-2xl border border-line bg-surface p-3.5", className)} aria-hidden="true">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Título sugerido</p>
      <p className="text-sm font-bold leading-snug text-brand">Software SEO para agencias: seguimiento y auditorías</p>
      <p className="text-[11px] text-ink-faint">58 de 60 caracteres</p>
      <div className="h-px bg-line" />
      <p className="text-xs leading-relaxed text-ink-soft">Controla las posiciones de tus clientes y detecta los problemas de cada web en un solo panel…</p>
    </div>
  );
}

export function AlertCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-3.5 shadow-[0_20px_40px_-12px_rgba(10,12,50,0.5)]", className)}>
      <p className="flex items-center gap-2 text-xs font-bold text-ink"><span className="h-2 w-2 rounded-full bg-alert" />12 problemas nuevos</p>
      <p className="mt-1 max-w-[200px] text-[11px] leading-snug text-ink-soft">38 enlaces rotos. Empieza por los de las páginas con tráfico.</p>
    </div>
  );
}
