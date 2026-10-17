"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import CountUp from "./CountUp";
import { Donut, KeywordRows, Pill, RankLine } from "./mockups";
import { ReportMini, TreeMini } from "./mockups-extra";

// Recorrido de un proyecto, de cero a informe. En escritorio, la ventana de la
// derecha queda fija y cambia con el paso que está en pantalla; en móvil cada
// paso lleva su maqueta debajo. Todo son cifras de ejemplo.

const row = "flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs";

function StepFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-surface text-ink shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-muted px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-alert/70" /><span className="h-2.5 w-2.5 rounded-full bg-chart-muted" /><span className="h-2.5 w-2.5 rounded-full bg-brand/60" />
        <span className="ml-3 truncate text-[11px] font-semibold text-ink-faint">{title}</span>
      </div>
      <div className="mk-stagger space-y-3 p-5">{children}</div>
    </div>
  );
}

const st = (i: number) => ({ ["--i" as string]: i }) as React.CSSProperties;

const VISUALS: Record<string, () => React.ReactNode> = {
  proyecto: () => (
    <StepFrame title="crawlea.com/app/proyectos/nuevo">
      <div style={st(0)}>
        <p className="text-[11px] font-bold text-ink-faint">Dominio</p>
        <div className="mt-1 overflow-hidden rounded-xl border border-brand/40 bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink"><span className="mk-type inline-block">clinicaejemplo.es</span></div>
      </div>
      <div style={st(1)} className="rounded-2xl bg-surface-muted p-3.5">
        <p className="flex items-center gap-2 text-xs font-extrabold text-ink"><span className="mk-ring h-2 w-2 rounded-full bg-brand" />Negocio local detectado en Google Maps</p>
        <div className="mt-2.5 space-y-1.5 text-[12px] text-ink-soft">
          <p className="flex justify-between"><span>Nombre</span><span className="font-semibold text-ink">Clínica Ejemplo</span></p>
          <p className="flex justify-between"><span>Dirección</span><span className="font-semibold text-ink">Calle Mayor 1, Madrid</span></p>
          <p className="flex justify-between"><span>Teléfono</span><span className="font-semibold text-ink">910 000 000</span></p>
          <p className="flex justify-between"><span>Horario</span><span className="font-semibold text-ink">L–V 9:00–20:00</span></p>
        </div>
      </div>
      {["Palabras clave importadas al seguimiento", "Competidores analizados"].map((t, i) => (
        <div key={t} style={st(2 + i)} className={row}><span className="flex items-center gap-2 font-semibold text-ink"><Check className="h-3.5 w-3.5 text-brand" />{t}</span></div>
      ))}
    </StepFrame>
  ),
  rastreo: () => (
    <StepFrame title="Auditoría · clinicaejemplo.es">
      <div style={st(0)}>
        <div className="flex items-end justify-between">
          <p className="text-xs font-bold text-ink">Rastreando la web entera</p>
          <p className="text-3xl font-extrabold tracking-[-0.03em] tabular-nums text-ink"><CountUp to={1284} /><span className="ml-1 text-xs font-semibold text-ink-faint">URLs</span></p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-chart-track"><div className="mk-bar h-full rounded-full bg-brand" style={{ ["--to" as string]: "100%" }} /></div>
        <div className="mt-2 flex gap-1.5"><Pill tone="neutral">robots.txt</Pill><Pill tone="neutral">sitemap</Pill><Pill>enlaces</Pill></div>
      </div>
      <div style={st(1)} className="flex items-center gap-5 rounded-2xl bg-surface-muted p-4">
        <Donut value={82} className="w-24 shrink-0" />
        <ul className="space-y-1.5 text-[12px] text-ink-soft">
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-alert" /><b className="tabular-nums text-ink"><CountUp to={38} /></b> enlaces rotos</li>
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand" /><b className="tabular-nums text-ink"><CountUp to={4} /></b> páginas sin título</li>
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-200" /><b className="tabular-nums text-ink"><CountUp to={9} /></b> imágenes sin alt</li>
        </ul>
      </div>
      <div style={st(2)} className={row}><span className="font-semibold text-ink">Tareas creadas por la auditoría</span><Pill tone="neutral">3</Pill></div>
    </StepFrame>
  ),
  palabras: () => (
    <StepFrame title="Palabras clave · estudio «General»">
      <div style={st(0)}><KeywordRows /></div>
      <div style={st(1)}><TreeMini /></div>
      <div style={st(2)} className={row}><span className="font-semibold text-ink">Palabras que tu competidor posiciona y tú no</span><Pill tone="down">+34</Pill></div>
    </StepFrame>
  ),
  posiciones: () => (
    <StepFrame title="Rank tracking · clinicaejemplo.es">
      <div style={st(0)}>
        <p className="text-[11px] font-semibold text-ink-faint">Posición media</p>
        <p className="flex items-center gap-2 text-4xl font-extrabold tracking-[-0.03em] tabular-nums text-ink"><CountUp to={8.4} decimals={1} /> <Pill>▲ 1,2 pts</Pill></p>
      </div>
      <div style={st(1)}><RankLine className="text-ink" /></div>
      {[["«dentista madrid centro»", "3", "▲ 4"], ["«ortodoncia invisible»", "11", "▼ 2"]].map(([k, p, d], i) => (
        <div key={k} style={st(2 + i)} className={row}><span className="truncate font-semibold text-ink">{k}</span><span className="flex shrink-0 items-center gap-2"><b className="tabular-nums text-ink">{p}</b><Pill tone={d.startsWith("▲") ? "up" : "down"}>{d}</Pill></span></div>
      ))}
    </StepFrame>
  ),
  informe: () => (
    <StepFrame title="Informe · septiembre 2026">
      <div style={st(0)}><ReportMini /></div>
      <div style={st(1)} className={row}><span className="font-semibold text-ink">Enlace de solo lectura</span><Pill>Activo</Pill></div>
      <div style={st(2)} className={row}><span className="font-semibold text-ink">Envío mensual al cliente</span><Pill tone="neutral">Día 1</Pill></div>
    </StepFrame>
  ),
};

const STEPS = [
  {
    id: "proyecto", n: "Paso 1", title: "Añade tu dominio",
    text: "Escribe la dirección de tu web. Si es un negocio local, elige tu ficha de Google y Crawlea rellena el nombre, la dirección, el teléfono y el horario.",
    points: ["Un proyecto por cliente o por web", "Los datos del negocio salen de Google Maps, sin teclearlos", "Poner en marcha importa tus palabras clave y analiza a tus competidores"],
  },
  {
    id: "rastreo", n: "Paso 2", title: "Rastrea la web entera",
    text: "El rastreo sigue tus enlaces y tu sitemap hasta 5.000 páginas, respeta el robots.txt y se identifica como CrawleaBot. Al terminar, ordena los problemas y crea las tareas.",
    points: ["Enlaces rotos, canonicals, títulos, H1 e imágenes sin alt", "PageSpeed de tu página principal", "Puntuación de 0 a 100 en 5 categorías, cada una explicada"],
  },
  {
    id: "palabras", n: "Paso 3", title: "Descubre qué buscan tus clientes",
    text: "Siembra una palabra y elige las relacionadas, con volumen estimado, coste por clic, intención y estacionalidad. Crawlea propone qué páginas crear y cuánto suma cada rama.",
    points: ["Competidores: las palabras que ellos posicionan y tú no", "Arquitectura de URLs con el volumen de cada rama", "TF-IDF: los términos del top 10 de Google para escribir mejor"],
  },
  {
    id: "posiciones", n: "Paso 4", title: "Sigue tus posiciones",
    text: "Elige la frecuencia (diaria, semanal o mensual), la profundidad y la ubicación, hasta ciudad o municipio. Si una palabra cae 10 puestos o más, te avisamos por email.",
    points: ["Histórico, mejor posición y tendencia por palabra", "Search Console y Analytics junto a tus posiciones", "Mapa de calor de Google Maps para negocios locales"],
  },
  {
    id: "informe", n: "Paso 5", title: "Enséñaselo a tu cliente",
    text: "El informe junta lo que elijas en un documento listo para imprimir o guardar en PDF. Compártelo con un enlace de solo lectura y con tu marca, o déjalo programado cada mes.",
    points: ["Tu nombre, tu logo y tu color", "El enlace se puede revocar cuando quieras", "Tu cliente nunca ve cifras de gasto"],
  },
];

export default function Journey() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-40% 0px -45% 0px" }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const cur = STEPS[active];

  return (
    <div className="relative mt-16 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      <ol>
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            data-i={i}
            ref={(el) => { refs.current[i] = el; }}
            className={cn("flex flex-col justify-center py-10 transition-opacity duration-500 lg:min-h-[72vh]", i === active ? "lg:opacity-100" : "lg:opacity-40")}
          >
            <p className="flex items-center gap-3 text-sm font-bold text-brand">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-white">{i + 1}</span>{s.n}
            </p>
            <h3 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-4xl">{s.title}</h3>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-soft">{s.text}</p>
            <ul className="mt-6 space-y-3">
              {s.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-ink-soft"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{p}</li>
              ))}
            </ul>
            <div className="mt-8 rounded-[24px] bg-[#0E1033] p-4 lg:hidden">{VISUALS[s.id]()}</div>
          </li>
        ))}
      </ol>

      <div className="relative hidden lg:block">
        <div className="sticky top-24">
          <div className="relative overflow-hidden rounded-[28px] bg-[#0E1033] p-8">
            <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 70% 55% at 100% 100%, rgba(79,92,245,0.55), transparent 70%)" }} />
            <div className="relative min-h-[440px]" key={cur.id} aria-live="polite">{VISUALS[cur.id]()}</div>
            <div className="relative mt-5 flex items-center justify-between">
              <div className="flex gap-1.5" aria-hidden="true">
                {STEPS.map((s, i) => <span key={s.id} className={cn("h-1.5 rounded-full transition-all duration-500", i === active ? "w-8 bg-white" : "w-1.5 bg-white/30")} />)}
              </div>
              <p className="text-xs text-white/50">Datos de ejemplo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
