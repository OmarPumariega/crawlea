import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Pill } from "./mockups";

// Maquetas adicionales para las funciones de la web pública (arquitectura,
// analizador, TF-IDF, enlaces internos, IA, informe, tareas, notas, asistente...).
// Igual que mockups.tsx: ilustraciones con datos de EJEMPLO, no salen de ninguna cuenta.

const row = "flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs";

export function TreeMini({ className }: { className?: string }) {
  const nodes = [
    ["/software-seo", "5.400", 0],
    ["/software-seo/auditoria", "1.300", 1],
    ["/software-seo/posiciones", "880", 1],
    ["/software-seo/local", "590", 1],
  ] as const;
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {nodes.map(([p, v, lvl]) => (
        <div key={p} className={cn(row, lvl === 1 && "ml-5")}>
          <span className="truncate font-semibold text-ink">{p}</span>
          <span className="shrink-0 tabular-nums text-ink-soft">{v}</span>
        </div>
      ))}
      <p className="px-1 text-[11px] text-ink-faint">Volumen sumado por rama.</p>
    </div>
  );
}

export function UrlChecksMini({ className }: { className?: string }) {
  const rows = [
    ["Un solo H1", true],
    ["Keyword en el título", true],
    ["Meta descripción", false],
    ["Imágenes con alt", false],
  ] as const;
  return (
    <div className={cn("space-y-1.5", className)} aria-hidden="true">
      <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2">
        <span className="text-[11px] font-semibold text-ink-soft">Puntuación de la URL</span>
        <span className="text-base font-extrabold tabular-nums text-ink">74<span className="text-[11px] text-ink-faint">/100</span></span>
      </div>
      {rows.map(([t, ok]) => (
        <div key={t} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-[11px]">
          <span className="truncate font-semibold text-ink">{t}</span>
          {ok ? <Pill>Bien</Pill> : <Pill tone="down">Arreglar</Pill>}
        </div>
      ))}
    </div>
  );
}

export function SerpPreviewMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-1.5 rounded-2xl border border-line bg-surface p-3.5", className)} aria-hidden="true">
      <p className="text-[11px] text-ink-faint">tuweb.es › servicios</p>
      <p className="text-sm font-bold leading-snug text-brand">Auditoría SEO para pymes: qué corregir primero</p>
      <p className="text-xs leading-relaxed text-ink-soft">Revisamos tu web entera y te decimos qué mejorar primero, con ejemplos…</p>
      <div className="flex gap-2 pt-1"><Pill tone="neutral">Título 52/60</Pill><Pill tone="neutral">Meta 148/155</Pill></div>
    </div>
  );
}

export function TermsMini({ className }: { className?: string }) {
  const rows = [["auditoría seo", 92], ["rastreo", 71], ["enlaces rotos", 58], ["canonical", 36]] as const;
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Términos del top 10</p>
      {rows.map(([t, v]) => (
        <div key={t}>
          <div className="mb-1 flex justify-between text-[11px]"><span className="font-semibold text-ink">{t}</span><span className="tabular-nums text-ink-faint">{v}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-chart-track"><div className="h-full rounded-full bg-brand" style={{ width: `${v}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function InternalLinksMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      <div className={row}><span className="truncate font-semibold text-ink">/guia-seo-local</span><Pill tone="down">Huérfana</Pill></div>
      <div className="flex items-center gap-2 px-2 text-[11px] text-ink-soft">
        <span className="h-4 w-px bg-line" />Enlazar desde <span className="font-semibold text-ink">/blog/seo-para-pymes</span>
      </div>
      <div className="rounded-2xl bg-surface-muted px-3.5 py-2.5 text-[11px] text-ink-soft">Anchor sugerido: <span className="font-bold text-brand">guía de SEO local</span></div>
    </div>
  );
}

export function CannibalMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      <p className="text-xs font-bold text-ink">«abogado laboralista madrid»</p>
      {[["/servicios/laboral", "3,2"], ["/blog/despido", "7,8"]].map(([u, p]) => (
        <div key={u} className={row}><span className="truncate font-semibold text-ink">{u}</span><span className="shrink-0 tabular-nums text-ink-soft">pos. {p}</span></div>
      ))}
      <p className="px-1 text-[11px] text-ink-faint">Dos URLs compiten por la misma consulta.</p>
    </div>
  );
}

export function SearchConsoleMini({ className }: { className?: string }) {
  const kpis = [["Clics", "1.284"], ["Impr.", "38,2 k"], ["CTR", "3,4 %"], ["Pos.", "9,1"]];
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)} aria-hidden="true">
      {kpis.map(([k, v]) => (
        <div key={k} className="rounded-2xl border border-line bg-surface px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-ink-faint">{k}</p>
          <p className="text-lg font-extrabold tabular-nums text-ink">{v}</p>
        </div>
      ))}
    </div>
  );
}

export function AiOverviewMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      <p className="text-xs font-bold text-ink">«mejor software seo»</p>
      <div className={row}><span className="font-semibold text-ink">Google muestra AI Overview</span><Pill>Sí</Pill></div>
      <div className={row}><span className="font-semibold text-ink">Te cita como fuente</span><Pill tone="down">No</Pill></div>
      <p className="px-1 text-[11px] text-ink-faint">Fuentes citadas: 4 dominios.</p>
    </div>
  );
}

export function ReportMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-2xl border border-line bg-surface p-3.5", className)} aria-hidden="true">
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold text-ink">Informe mensual</p>
        <span className="h-5 w-5 rounded-md bg-brand" />
      </div>
      {["Resumen de auditoría", "Posiciones", "Palabras clave", "Search Console"].map((s) => (
        <p key={s} className="flex items-center gap-2 text-[11px] text-ink-soft"><Check className="h-3.5 w-3.5 text-brand" />{s}</p>
      ))}
      <p className="rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft">crawlea.com/informe/…</p>
    </div>
  );
}

export function TasksMini({ className }: { className?: string }) {
  const rows = [["Corregir 38 enlaces rotos", false], ["Añadir H1 a 4 páginas", false], ["Revisar títulos duplicados", true]] as const;
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {rows.map(([t, done]) => (
        <div key={t} className={row}>
          <span className="flex items-center gap-2">
            <span className={cn("flex h-4 w-4 items-center justify-center rounded border", done ? "border-brand bg-brand text-white" : "border-line")}>{done && <Check className="h-3 w-3" />}</span>
            <span className={cn("font-semibold", done ? "text-ink-faint line-through" : "text-ink")}>{t}</span>
          </span>
        </div>
      ))}
      <p className="px-1 text-[11px] text-ink-faint">Generadas por la última auditoría.</p>
    </div>
  );
}

export function NotesMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-2xl border border-line bg-surface p-3.5", className)} aria-hidden="true">
      <p className="text-xs font-extrabold text-ink">Reunión con el cliente</p>
      <p className="text-xs leading-relaxed text-ink-soft"><span className="font-bold text-ink">Acordado:</span> priorizar la página de servicios y subir fotos del local.</p>
      <div className="flex gap-2"><span className="h-10 w-10 rounded-lg bg-surface-muted" /><span className="h-10 w-10 rounded-lg bg-surface-muted" /></div>
    </div>
  );
}

export function ChatMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 text-xs", className)} aria-hidden="true">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 font-semibold text-white">¿Qué página debería mejorar primero?</p>
      <p className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-surface-muted px-3.5 py-2 leading-relaxed text-ink-soft">Según tu último rastreo y Search Console, empieza por /servicios: tiene muchas impresiones y un título duplicado.</p>
    </div>
  );
}

export function ProjectMini({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      <div className="rounded-2xl border border-line bg-surface px-3.5 py-2.5">
        <p className="text-xs font-extrabold text-ink">Clínica Ejemplo</p>
        <p className="text-[11px] text-ink-faint">clinicaejemplo.es · Calle Mayor 1 · 910 000 000</p>
      </div>
      <div className={row}><span className="font-semibold text-ink">Poner en marcha el proyecto</span><Pill tone="neutral">3 pasos</Pill></div>
    </div>
  );
}

export function BootstrapMini({ className }: { className?: string }) {
  const rows = ["Palabras clave importadas a seguimiento", "TF-IDF calculado sin coste", "Competidores analizados"];
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      <div className="rounded-2xl border border-line bg-surface px-3.5 py-2.5">
        <p className="text-xs font-extrabold text-ink">Poner en marcha el proyecto</p>
        <p className="text-[11px] text-ink-faint">ejemplo.es</p>
      </div>
      {rows.map((r) => (
        <div key={r} className={row}>
          <span className="flex items-center gap-2 font-semibold text-ink"><Check className="h-3.5 w-3.5 text-brand" />{r}</span>
        </div>
      ))}
      <div className="rounded-full bg-brand px-4 py-2 text-center text-xs font-bold text-white">Poner en marcha</div>
    </div>
  );
}
