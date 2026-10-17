"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pill } from "./mockups";
import Spotlight from "./Spotlight";

// Cada dato con su pista y su explicación a un clic (regla de la guía de
// comunicación). Cifras de ejemplo; la fuente y la frescura van siempre a la vista.
const ITEMS = [
  {
    id: "posicion", tab: "Posición", label: "Posición media", value: "8,4", pill: "▲ 1,2 pts", tone: "up" as const,
    hint: "Estás cerca de la primera página. Mejora el título de tus 3 páginas más cercanas.",
    why: "Es la media de tus posiciones en Google. Pasar del puesto 10 al 9 te lleva a la primera página, donde se concentran los clics. Reescribe el título para que incluya la palabra clave y despierte interés.",
    source: "Search Console · actualizado hoy, 08:12", kind: "Medido",
  },
  {
    id: "rotos", tab: "Enlaces rotos", label: "Enlaces rotos", value: "38", pill: "12 con tráfico", tone: "down" as const,
    hint: "12 están en páginas con tráfico: empieza por esas.",
    why: "Un enlace roto lleva a una página que ya no existe (error 404). Quien llega se va, y Google gasta rastreo en vano. Corrige el enlace o redirígelo a una página parecida.",
    source: "Rastreo propio · hace 2 días", kind: "Medido",
  },
  {
    id: "ctr", tab: "CTR", label: "CTR", value: "3,4 %", pill: "▼ 0,3 pts", tone: "down" as const,
    hint: "Te ven más de lo que te clican. Prueba un título más concreto.",
    why: "CTR es el porcentaje de personas que hacen clic al ver tu resultado. Si es bajo, reescribe el título y la descripción para que prometan justo lo que la página resuelve. Puede deberse también a un competidor con mejor posición.",
    source: "Search Console · últimos 28 días", kind: "Medido",
  },
  {
    id: "volumen", tab: "Volumen", label: "Búsquedas al mes · «software seo»", value: "2.400", pill: "Estimado", tone: "neutral" as const,
    hint: "Úsalo para comparar palabras entre sí, no como cifra exacta.",
    why: "El volumen es una estimación mensual de búsquedas en España. Sirve para decidir qué palabra trabajar primero. La cifra exacta solo la conoce Google, y por eso la marcamos siempre como estimada.",
    source: "DataForSEO · caché de 30 días", kind: "Estimado",
  },
];

export default function DataDeck() {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const it = ITEMS[i];

  return (
    <div>
      <div role="tablist" aria-label="Ejemplos de datos" className="mb-3 flex flex-wrap gap-2">
        {ITEMS.map((x, k) => (
          <button
            key={x.id} type="button" role="tab" aria-selected={k === i}
            onClick={() => { setI(k); setOpen(false); }}
            className={cn("rounded-full border px-4 py-1.5 text-[13px] font-bold transition-colors", k === i ? "border-white bg-white text-[#0E1033]" : "border-white/25 text-white/75 hover:border-white/60 hover:text-white")}
          >{x.tab}</button>
        ))}
      </div>
      <Spotlight className="overflow-hidden rounded-[24px] border border-line bg-surface p-6 text-ink shadow-[0_40px_90px_-30px_rgba(10,12,50,0.8)]">
        <div key={it.id} className="mk-stagger relative">
          <p style={{ ["--i" as string]: 0 }} className="text-xs font-semibold text-ink-faint">{it.label}</p>
          <p style={{ ["--i" as string]: 1 }} className="mt-1 flex flex-wrap items-center gap-3 text-5xl font-extrabold tracking-[-0.03em] tabular-nums">
            {it.value} <Pill tone={it.tone}>{it.pill}</Pill>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Qué significa este dato" className={cn("rounded-full p-1 transition-colors", open ? "bg-brand text-white" : "text-brand hover:bg-surface-muted")}>
              <Info className="h-5 w-5" aria-hidden="true" />
            </button>
          </p>
          <p style={{ ["--i" as string]: 2 }} className="mt-3 text-sm leading-relaxed text-ink-soft">{it.hint}</p>
          <div className={cn("faq-body", open && "faq-open")} style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
            <div>
              <div className="mt-4 rounded-2xl bg-surface-muted p-4 text-xs leading-relaxed text-ink-soft">
                <p className="font-bold text-ink">¿Qué es?</p>
                {it.why}
              </div>
            </div>
          </div>
          <p style={{ ["--i" as string]: 3 }} className="mt-4 flex items-center gap-2 text-[11px] text-ink-faint">
            <span className={cn("rounded-full px-2 py-0.5 font-bold", it.kind === "Medido" ? "bg-accent-tint text-accent-ink" : "bg-surface-muted text-ink-soft")}>{it.kind}</span>
            Fuente: {it.source} · Datos de ejemplo.
          </p>
        </div>
      </Spotlight>
    </div>
  );
}
