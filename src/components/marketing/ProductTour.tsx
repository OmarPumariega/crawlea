"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";

// «La herramienta por dentro»: lista de módulos a la izquierda y, a la
// derecha, una captura de ese módulo en la herramienta. Las capturas
// (public/demo) son de un proyecto de demostración con datos de ejemplo.
const AUTOPLAY_MS = 7000;

const MODULES = [
  { id: "palabras-clave", route: "keywords", label: "Palabras clave", file: "keywords", text: "Volumen, coste por clic, dificultad, intención y tendencia de cada palabra, y cuáles ya posicionas." },
  { id: "arquitectura", route: "keywords/arquitectura", label: "Arquitectura de URLs", file: "arquitectura", text: "Un árbol con las páginas que conviene crear, su URL, sus encabezados y las palabras que cubre cada una." },
  { id: "analizador", route: "analizador", label: "Analizador de URL", file: "analizador", text: "Puntuación on-page de cualquier URL y una lista de qué arreglar primero, con cómo hacerlo." },
  { id: "auditoria", route: "auditoria", label: "Auditoría", file: "auditoria", text: "Puntuación de 0 a 100 en cinco categorías, cada una explicada, con los problemas ordenados por importancia." },
  { id: "enlaces-internos", route: "auditoria/enlaces", label: "Enlaces internos", file: "enlaces", text: "Qué página enlazar, desde cuál y con qué texto. Detecta las páginas huérfanas de tu web." },
  { id: "tareas", route: "tareas", label: "Tareas", file: "tareas", text: "Lo que encuentra la auditoría se convierte en una lista con su prioridad. Las que marcas como hechas entran en el informe." },
  { id: "posiciones", route: "rank", label: "Rank tracking", file: "rank", text: "Cada palabra con su posición semana a semana, su ubicación y su tendencia. Ves cuántas están en el top 10." },
  { id: "competidores", route: "competidores", label: "Competidores", file: "competidores", text: "Tráfico estimado, palabras posicionadas y fuerza de cada competidor frente a tu web." },
  { id: "backlinks", route: "competidores/backlinks", label: "Backlinks", file: "backlinks", text: "Tu autoridad frente a la de tus competidores y los enlaces de otras webs que apuntan a la tuya." },
  { id: "seo-local", route: "geogrid", label: "SEO local", file: "geogrid", text: "Un mapa de calor sobre Google Maps, punto a punto, con quién aparece primero en cada zona." },
  { id: "visibilidad-ia", route: "ia", label: "Visibilidad en IA", file: "ia", text: "Si Google muestra una respuesta con IA para tus palabras, qué fuentes cita y si te cita a ti." },
  { id: "informes", route: "informe", label: "Informes", file: "informe", text: "El informe del mes con las secciones que elijas, listo para imprimir o compartir con tu cliente." },
];

export default function ProductTour() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // La rotación automática empieza al ver la sección y se detiene para siempre en cuanto el visitante elige un módulo.
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setAuto((a) => a || e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || paused) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % MODULES.length), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [auto, paused, active]);

  const pick = (i: number) => {
    track("product_tour_select", { module: MODULES[i].id });
    setAuto(false);
    setActive(i);
  };

  const cur = MODULES[active];

  return (
    <div ref={root} className="mt-14 grid gap-6 lg:grid-cols-[340px_1fr] lg:gap-10" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div role="tablist" aria-label="Módulos de la herramienta" className="mk-no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0">
        {MODULES.map((m, i) => {
          const on = i === active;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              id={`tour-tab-${m.id}`}
              aria-selected={on}
              aria-controls="tour-panel"
              onClick={() => pick(i)}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-2xl border px-5 py-3.5 text-left transition-colors lg:py-4",
                on ? "border-[#0E1033] bg-[#0E1033] text-white" : "border-line bg-surface text-ink hover:border-ink/30"
              )}
            >
              <span className="flex items-center gap-3 text-[15px] font-bold">
                <span className={cn("text-xs tabular-nums", on ? "text-brand-200" : "text-ink-faint")}>{String(i + 1).padStart(2, "0")}</span>
                {m.label}
              </span>
              {on && (
                <span className="mt-2 hidden text-[13px] font-normal leading-snug text-white/70 lg:block">{m.text}</span>
              )}
              {on && auto && !paused && (
                <span key={`${active}-bar`} className="mk-bar absolute inset-x-0 bottom-0 h-0.5 bg-brand-200" style={{ ["--to" as string]: "100%", animationDuration: `${AUTOPLAY_MS}ms`, animationDelay: "0s", animationTimingFunction: "linear" }} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${cur.id}`}>
        <div className="relative overflow-hidden rounded-[28px] bg-[#0E1033] p-4 sm:p-8">
          <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 70% 55% at 100% 100%, rgba(79,92,245,0.55), transparent 70%)" }} />

          <p className="relative mb-4 text-[15px] leading-snug text-white/80 lg:hidden">{cur.text}</p>

          <div className="relative overflow-hidden rounded-[16px] border border-white/15 bg-surface shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-1.5 border-b border-line bg-surface-muted px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-alert/70" /><span className="h-2.5 w-2.5 rounded-full bg-chart-muted" /><span className="h-2.5 w-2.5 rounded-full bg-brand/60" />
              <span className="ml-3 truncate rounded-md bg-surface px-3 py-0.5 text-[11px] font-semibold text-ink-faint">crawlea.com/app/proyectos/…/{cur.route}</span>
            </div>
            <div className="relative aspect-[16/10] bg-surface-muted">
              {MODULES.map((m, i) => (
                <Image
                  key={m.id}
                  src={`/demo/${m.file}.webp`}
                  alt={`Captura del módulo ${m.label} en Crawlea, con un proyecto de demostración`}
                  width={2880}
                  height={1800}
                  sizes="(min-width: 1024px) 860px, 100vw"
                  quality={82}
                  priority={i === 0}
                  className={cn("absolute inset-0 h-full w-full object-cover object-top transition-all duration-700", i === active ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-[1.015] opacity-0")}
                />
              ))}
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/50">Capturas de un proyecto de demostración con datos de ejemplo.</p>
            <Link href={`/funciones#${cur.id}`} data-track="product_tour_more_click" data-track-module={cur.id} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-200 hover:text-white">
              Ver {cur.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
