"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Donut, GeoHeat, Pill } from "./mockups";
import { TasksMini } from "./mockups-extra";

// «Para quién»: tres maneras de usar Crawlea, cada una con un día de ejemplo y
// la maqueta de lo que ve esa persona.
const row = "flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs";

function ProjectsTable() {
  const rows = [["clinicaejemplo.es", "82", "▲ 3", "up"], ["tiendaejemplo.com", "64", "▼ 5", "down"], ["abogadosejemplo.es", "91", "▲ 1", "up"], ["restauranteejemplo.es", "73", "▲ 2", "up"]] as const;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Panel general · avisos</p>
      {rows.map(([d, s, v, t]) => (
        <div key={d} className={row}>
          <span className="truncate font-semibold text-ink">{d}</span>
          <span className="flex shrink-0 items-center gap-2"><b className="tabular-nums text-ink">{s}</b><Pill tone={t}>{v}</Pill></span>
        </div>
      ))}
      <div className={row}><span className="font-semibold text-ink">Informe del mes enviado</span><Pill tone="neutral">4 de 4</Pill></div>
    </div>
  );
}

const PEOPLE = [
  {
    id: "agencias", tab: "Agencias y freelances", title: "Tus clientes, ordenados",
    text: "Cada cliente es un proyecto con su seguimiento, su auditoría, sus tareas y su informe. El plan Pro llega a 10 proyectos.",
    day: [
      ["09:00", "Abres el panel y ves qué proyectos tienen avisos: caídas de posición o auditorías con problemas."],
      ["09:20", "Cambias de cliente con el buscador del menú, sin salir de la herramienta."],
      ["10:00", "Repasas las tareas que dejó la última auditoría y marcas las hechas."],
      ["17:00", "Envías el enlace del informe, con tu nombre, tu logo y tu color."],
    ],
    cta: { href: "/precios", label: "Ver el plan Pro" }, visual: <ProjectsTable />,
  },
  {
    id: "locales", tab: "Negocios locales", title: "Tu zona, punto a punto",
    text: "Elige tu ficha de Google y el proyecto se configura como negocio local. El mapa de calor te dice dónde apareces y dónde no.",
    day: [
      ["Día 1", "Eliges tu ficha y Crawlea rellena nombre, dirección, teléfono y horario."],
      ["Día 1", "Lanzas una rejilla de 5×5: 25 puntos alrededor de tu negocio."],
      ["Día 2", "Ves en qué puntos sales primero y en cuáles no apareces."],
      ["Mes siguiente", "Repites la medición y comparas las dos lado a lado."],
    ],
    cta: { href: "/funciones#seo-local", label: "Ver el SEO local" },
    visual: (<div className="space-y-3"><GeoHeat className="mx-auto max-w-[170px]" /><div className="flex justify-center gap-2"><Pill>▲ 6 puntos en el top 3</Pill><Pill tone="neutral">5×5</Pill></div></div>),
  },
  {
    id: "web", tab: "Tu propia web", title: "Empiezas gratis, sin tarjeta",
    text: "Un proyecto, el rastreo del sitio entero y una pista junto a cada dato para saber qué hacer después.",
    day: [
      ["Minuto 1", "Entras con tu cuenta de Google y escribes el dominio."],
      ["Minuto 5", "Lanzas el primer rastreo y ves los problemas ordenados."],
      ["Ese día", "Empiezas por la primera tarea de la lista."],
      ["Cada semana", "Miras tus posiciones y qué páginas están cerca de la primera."],
    ],
    cta: { href: "/registro", label: "Empieza gratis" },
    visual: (<div className="space-y-4"><div className="flex items-center gap-5"><Donut value={82} className="w-24 shrink-0" /><p className="text-xs leading-relaxed text-ink-soft">Puntuación de tu web, con lo que baja cada categoría.</p></div><TasksMini /></div>),
  },
];

export default function Audiences() {
  const [i, setI] = useState(0);
  const p = PEOPLE[i];
  return (
    <div className="mt-14">
      <div role="tablist" aria-label="Tipo de uso" className="flex flex-wrap gap-2">
        {PEOPLE.map((x, k) => (
          <button key={x.id} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)}
            className={cn("rounded-full border px-5 py-2.5 text-sm font-bold transition-colors", k === i ? "border-[#0E1033] bg-[#0E1033] text-white" : "border-line bg-surface text-ink-soft hover:border-ink/30 hover:text-ink")}
          >{x.tab}</button>
        ))}
      </div>

      <div key={p.id} className="mk-stagger mt-6 grid overflow-hidden rounded-[28px] border border-line bg-surface lg:grid-cols-[1.15fr_1fr]">
        <div style={{ ["--i" as string]: 0 }} className="p-7 sm:p-10">
          <h3 className="text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-4xl">{p.title}</h3>
          <p className="mt-3 max-w-md text-lg leading-relaxed text-ink-soft">{p.text}</p>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Un día de ejemplo</p>
          <ol className="relative mt-4 space-y-5 border-l-2 border-dashed border-brand/30 pl-6">
            {p.day.map(([t, d]) => (
              <li key={d} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-surface" aria-hidden="true" />
                <p className="text-xs font-extrabold text-brand">{t}</p>
                <p className="mt-0.5 text-[15px] leading-snug text-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
          <Link href={p.cta.href} data-track="audience_cta_click" data-track-audience={p.id} className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-strong">
            {p.cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div style={{ ["--i" as string]: 1 }} className="relative overflow-hidden bg-[#0E1033] p-7 sm:p-10">
          <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 80% 60% at 100% 100%, rgba(79,92,245,0.55), transparent 70%)" }} />
          <div className="relative flex h-full flex-col justify-center">
            <div className="rounded-[18px] bg-surface p-5 text-ink shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">{p.visual}</div>
            <p className="mt-3 text-xs text-white/50">Datos de ejemplo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
