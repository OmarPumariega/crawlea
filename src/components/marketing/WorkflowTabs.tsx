"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";
import { Donut, KeywordRows, Pill, RankLine } from "./mockups";
import { BootstrapMini, ReportMini, TasksMini, TreeMini } from "./mockups-extra";

// «Cómo se conecta»: el valor de Crawlea no son 19 herramientas sueltas, sino
// que cada una alimenta a la siguiente. Cuatro etapas de trabajo; cada una
// muestra la cadena real de herramientas (lo que pasa de una a otra) y una maqueta.
type Step = { tool: string; gives: string };
type Stage = {
  id: string;
  tab: string;
  title: string;
  text: string;
  steps: Step[];
  link: { href: string; label: string };
  visual: React.ReactNode;
};

const STAGES: Stage[] = [
  {
    id: "empieza", tab: "Empieza", title: "Pon en marcha un proyecto en minutos",
    text: "Añades el dominio y Crawlea prepara el resto con datos reales: no empiezas con un panel vacío.",
    steps: [
      { tool: "Ficha del proyecto", gives: "Dominio y, si es un negocio local, nombre, dirección y teléfono desde tu ficha de Google." },
      { tool: "Poner en marcha", gives: "Importa tus palabras clave al seguimiento de posiciones y analiza a tus competidores." },
      { tool: "Primer rastreo", gives: "Revisa la web entera y deja las tareas listas." },
    ],
    link: { href: "/registro", label: "Crea tu proyecto" },
    visual: <BootstrapMini />,
  },
  {
    id: "investiga", tab: "Investiga", title: "De una palabra a un plan de páginas",
    text: "Lo que descubres en una herramienta pasa a la siguiente con un clic, sin copiar y pegar.",
    steps: [
      { tool: "Palabras clave", gives: "Siembras una palabra y eliges las relacionadas con volumen, intención y estacionalidad." },
      { tool: "Competidores", gives: "Ves las palabras que ellos posicionan y tú no, y las llevas a tu estudio." },
      { tool: "Arquitectura de URLs", gives: "Propone qué páginas crear, con el volumen de cada rama." },
    ],
    link: { href: "/funciones#palabras-clave", label: "Ver las herramientas" },
    visual: (<div className="space-y-3"><KeywordRows /><TreeMini /></div>),
  },
  {
    id: "mejora", tab: "Mejora", title: "Qué corregir y qué escribir",
    text: "Los problemas de tu web se convierten en tareas, y lo que usan las páginas que ya están arriba, en una guía para tu texto.",
    steps: [
      { tool: "Auditoría", gives: "Rastrea el sitio entero y crea una tarea por cada tipo de problema." },
      { tool: "Enlaces internos y analizador", gives: "Dicen qué páginas enlazar y qué falta en cada URL." },
      { tool: "TF-IDF y contenido", gives: "Los términos del top 10 pasan al generador de textos." },
    ],
    link: { href: "/funciones#auditoria", label: "Ver la auditoría" },
    visual: (<div className="space-y-4"><div className="flex items-center gap-5"><Donut value={82} className="w-24 shrink-0" /><p className="text-xs leading-relaxed text-ink-soft">Puntuación de 0 a 100 en 5 categorías explicadas.</p></div><TasksMini /></div>),
  },
  {
    id: "sigue", tab: "Sigue y enseña", title: "Mide lo que cambia y cuéntaselo a tu cliente",
    text: "Posiciones y Search Console te dicen si va bien. El informe lo convierte en algo que se puede enviar.",
    steps: [
      { tool: "Posiciones y Search Console", gives: "Histórico por palabra y aviso por email si caes 10 puestos o más." },
      { tool: "Visibilidad en IA", gives: "Si Google muestra una respuesta con IA y te cita entre sus fuentes." },
      { tool: "Informe con tu marca", gives: "Enlace de solo lectura y envío mensual por email a tu cliente." },
    ],
    link: { href: "/funciones#informes", label: "Ver los informes" },
    visual: (<div className="space-y-3"><div><p className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.03em] tabular-nums">8,4 <Pill>▲ 1,2 pts</Pill></p><RankLine className="mt-2 text-ink" /></div><ReportMini /></div>),
  },
];

export default function WorkflowTabs() {
  const [active, setActive] = useState(0);
  const s = STAGES[active];

  return (
    <div className="mt-14 grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-10">
      <div role="tablist" aria-label="Etapas de trabajo" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {STAGES.map((st, i) => (
          <button
            key={st.id}
            type="button"
            role="tab"
            id={`wf-tab-${st.id}`}
            aria-selected={i === active}
            aria-controls="wf-panel"
            onClick={() => { track("workflow_tab", { stage: st.id }); setActive(i); }}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-colors lg:py-5",
              i === active ? "border-[#0E1033] bg-[#0E1033] text-white" : "border-line bg-surface text-ink hover:border-ink/30"
            )}
          >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold", i === active ? "bg-white text-[#0E1033]" : "bg-surface-muted text-brand")}>{i + 1}</span>
            <span className="text-[15px] font-bold">{st.tab}</span>
          </button>
        ))}
      </div>

      <div id="wf-panel" role="tabpanel" aria-labelledby={`wf-tab-${s.id}`} className="grid gap-8 rounded-[24px] border border-line bg-surface p-6 sm:p-8 xl:grid-cols-[1.1fr_1fr]">
        <div>
          <h3 className="text-2xl font-extrabold leading-[1.1] tracking-[-0.025em] text-ink sm:text-3xl">{s.title}</h3>
          <p className="mt-3 max-w-md leading-relaxed text-ink-soft">{s.text}</p>
          <ol className="mt-6">
            {s.steps.map((st, i) => (
              <li key={st.tool}>
                <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3">
                  <p className="text-sm font-extrabold text-ink">{st.tool}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{st.gives}</p>
                </div>
                {i < s.steps.length - 1 && <ArrowDown className="mx-auto my-1.5 h-4 w-4 text-brand" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <Link href={s.link.href} data-track="workflow_cta_click" data-track-stage={s.id} className="mt-6 inline-flex items-center gap-2 text-[15px] font-bold text-brand hover:text-brand-strong">
            {s.link.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-[20px] bg-[#0E1033] p-5 sm:p-6">
          <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 70% 50% at 100% 100%, rgba(79,92,245,0.5), transparent 70%)" }} />
          <div className="relative rounded-[14px] bg-surface p-4 text-ink">{s.visual}</div>
          <p className="relative mt-3 text-xs text-white/50">Datos de ejemplo.</p>
        </div>
      </div>
    </div>
  );
}
