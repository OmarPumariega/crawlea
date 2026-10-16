import { cn } from "@/lib/utils";
import { GeoHeat, Pill } from "@/components/marketing/mockups";

// Visuales de la sección «cómo funciona». Son ilustraciones con datos de
// EJEMPLO dibujadas en HTML/SVG (la sección lo indica); las cifras de las
// teselas (5.000, top 100, 7×7, 20 tipos) sí son límites reales del producto.

// 5.000 páginas: una cuadrícula de puntos que se va «rastreando».
export function CrawlGrid({ className }: { className?: string }) {
  const cols = 16;
  const rows = 6;
  return (
    <div className={cn("grid gap-1.5", className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: cols * rows }).map((_, i) => {
        const done = (i * 7) % 11 < 8; // distribución fija, sin aleatoriedad en cliente
        return <span key={i} className={cn("aspect-square rounded-[4px] mk-fade", done ? "bg-brand" : "bg-brand-100")} style={{ animationDelay: `${(i % cols) * 40 + Math.floor(i / cols) * 90}ms`, opacity: done ? 1 : 0.7 }} />;
      })}
    </div>
  );
}

// Top 100: barras descendentes con una posición destacada.
export function RankStrip({ className }: { className?: string }) {
  const bars = Array.from({ length: 24 }, (_, i) => 100 - i * 3.2);
  return (
    <div className={cn("flex h-24 items-end gap-1", className)} aria-hidden="true">
      {bars.map((h, i) => (
        <span key={i} className={cn("mk-grow w-full rounded-t-md", i === 7 ? "bg-brand" : "bg-chart-muted")} style={{ height: `${h}%`, animationDelay: `${i * 35}ms` }} />
      ))}
    </div>
  );
}

// 20 tipos de schema: un fragmento JSON-LD.
export function SchemaCode({ className }: { className?: string }) {
  return (
    <pre className={cn("overflow-hidden rounded-xl bg-[#0E1033] p-4 text-[11px] leading-[1.7] text-white/80", className)} aria-hidden="true">
      <code>
        <span className="text-white/40">{"{"}</span>{"\n"}
        {"  "}<span className="text-brand-200">&quot;@type&quot;</span>: <span className="text-[#9be7c4]">&quot;LocalBusiness&quot;</span>,{"\n"}
        {"  "}<span className="text-brand-200">&quot;name&quot;</span>: <span className="text-[#9be7c4]">&quot;Tu negocio&quot;</span>,{"\n"}
        {"  "}<span className="text-brand-200">&quot;telephone&quot;</span>: <span className="text-[#9be7c4]">&quot;+34 …&quot;</span>{"\n"}
        <span className="text-white/40">{"}"}</span>
      </code>
    </pre>
  );
}

export function FactTile({ big, label, children, className }: { big: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full flex-col rounded-[22px] border border-line bg-surface p-6", className)}>
      <div className="flex flex-1 items-center rounded-2xl bg-surface-muted p-4"><div className="w-full">{children}</div></div>
      <p className="mt-5 text-4xl font-extrabold tracking-[-0.035em] text-ink sm:text-5xl">{big}</p>
      <p className="mt-1.5 text-sm leading-snug text-ink-soft">{label}</p>
    </div>
  );
}

// Paso 1: añadir la web.
export function StepAdd() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <p className="text-[11px] font-bold text-ink-faint">Nuevo proyecto</p>
      <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink">ejemplo.es<span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-brand align-middle" /></div>
      <div className="rounded-full bg-brand px-4 py-2 text-center text-xs font-bold text-white">Crear proyecto</div>
    </div>
  );
}

// Paso 2: rastreo en marcha.
export function StepCrawl() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex items-center justify-between text-xs"><span className="font-bold text-ink">Rastreando ejemplo.es</span><span className="tabular-nums text-brand font-bold">24 %</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-chart-track"><div className="h-full w-1/4 rounded-full bg-brand" /></div>
      <p className="text-[11px] text-ink-faint">312 de 1.284 URLs…</p>
      <div className="flex gap-1.5"><Pill tone="neutral">robots.txt</Pill><Pill tone="neutral">sitemap</Pill><Pill>enlaces</Pill></div>
    </div>
  );
}

// Paso 3: resultado con pista.
export function StepFix() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[
        ["38 enlaces rotos", "Empieza por los de páginas con tráfico.", true],
        ["4 páginas sin título", "Escribe uno de 30 a 60 caracteres.", false],
      ].map(([t, h, alert]) => (
        <div key={t as string} className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
          <p className="flex items-center gap-2 text-xs font-bold text-ink"><span className={cn("h-2 w-2 rounded-full", alert ? "bg-alert" : "bg-brand")} />{t as string}</p>
          <p className="mt-0.5 pl-4 text-[11px] text-ink-soft">{h as string}</p>
        </div>
      ))}
    </div>
  );
}

export { GeoHeat };
