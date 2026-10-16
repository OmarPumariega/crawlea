import type { Metadata } from "next";
import { Check } from "lucide-react";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import CtaBand from "@/components/marketing/CtaBand";
import {
  BacklinksMini, Bars, CompetitorBars, ContentMini, Donut, GeoHeat, KeywordRows, Pill, RankLine,
} from "@/components/marketing/mockups";

export const metadata: Metadata = {
  title: "Funciones · Crawlea",
  description: "Seguimiento de posiciones, auditoría, palabras clave, backlinks, competidores, SEO local y contenido. Lo esencial del SEO en un solo sitio.",
  alternates: { canonical: "/funciones" },
};

type Module = { id: string; kicker: string; title: string; text: string; points: string[]; visual: React.ReactNode };

const MODULES: Module[] = [
  {
    id: "posiciones", kicker: "Posiciones", title: "Sigue dónde sales en Google",
    text: "Comprueba la posición de tus palabras clave por ubicación y mira cómo evolucionan.",
    points: ["Profundidad de 10, 30, 50 o 100 resultados", "Frecuencia diaria, semanal o mensual", "Ubicación por comunidad, provincia o ciudad", "Histórico, mejor posición y aviso por email si caes 10 puestos o más"],
    visual: (<><p className="flex items-center gap-2 text-3xl font-extrabold tracking-[-0.03em] tabular-nums">8,4 <Pill>▲ 1,2 pts</Pill></p><RankLine className="mt-3 text-ink" /></>),
  },
  {
    id: "auditoria", kicker: "Auditoría", title: "Encuentra qué corregir primero",
    text: "Rastreamos tu web entera, respetando robots.txt, y te ordenamos los problemas.",
    points: ["Hasta 5.000 páginas por rastreo, empezando por el sitemap", "Enlaces rotos, HTTPS, canonicals, títulos, descripciones, H1 e imágenes sin alt", "PageSpeed de la home y puntuación de 0 a 100 en 5 categorías explicadas", "Tareas automáticas con lo que hay que corregir"],
    visual: (<div className="flex items-center gap-6"><Donut value={82} className="w-32 shrink-0" /><ul className="space-y-2.5 text-sm text-ink-soft"><li className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full bg-alert" />38 enlaces rotos</li><li className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full bg-brand" />4 páginas sin título</li><li className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full bg-brand-200" />9 imágenes sin alt</li></ul></div>),
  },
  {
    id: "palabras-clave", kicker: "Palabras clave", title: "Descubre qué busca tu gente",
    text: "Estudios de palabras clave con los datos que necesitas para decidir qué trabajar.",
    points: ["Volumen mensual estimado, competencia y coste por clic", "Intención de búsqueda: informativa, comercial o mixta", "Estacionalidad de los últimos 12 meses", "Una estructura de URLs propuesta a partir de tu estudio"],
    visual: <KeywordRows />,
  },
  {
    id: "backlinks", kicker: "Backlinks", title: "Quién te enlaza y cuánto pesa",
    text: "Los enlaces de otras webs que apuntan a la tuya y a la de tu competencia.",
    points: ["Autoridad de dominio, backlinks totales y dominios de referencia", "Dofollow, nofollow y enlaces rotos", "Anchor, primera y última vez visto de cada enlace", "Dominios que enlazan a tu competidor y todavía no a ti"],
    visual: <BacklinksMini />,
  },
  {
    id: "competidores", kicker: "Competidores", title: "Mídete con los demás",
    text: "Mira la visibilidad de cualquier dominio y qué palabras posiciona que tú no.",
    points: ["Tráfico orgánico estimado y número de palabras posicionadas", "Distribución en top 3, top 10 y top 100", "Palabras que ellos posicionan y tú no, con el texto que muestran en Google", "Añade cualquier palabra a tu seguimiento con un clic"],
    visual: <CompetitorBars />,
  },
  {
    id: "seo-local", kicker: "SEO local", title: "Tu posición, punto a punto",
    text: "Para negocios locales: un mapa de calor de Google Maps alrededor de tu ubicación.",
    points: ["Rejilla de 3×3, 5×5 o 7×7 puntos y radio configurable", "La posición de tu negocio en cada punto, por palabra clave", "Histórico y comparación entre dos mediciones"],
    visual: <GeoHeat className="mx-auto max-w-[240px]" />,
  },
  {
    id: "contenido", kicker: "Títulos y contenido", title: "Títulos, datos estructurados y textos",
    text: "Genera lo que tu página necesita a partir de su contenido real, no de una plantilla.",
    points: ["Tres variantes de título y descripción con los límites de caracteres", "Unos 20 tipos de datos estructurados (schema), validados", "Contenido para blog, página, producto o novedad de ficha de Google", "Optimiza una URL existente con una lista de cambios concretos"],
    visual: <ContentMini />,
  },
  {
    id: "google", kicker: "Google", title: "Search Console y Analytics",
    text: "Conecta tu cuenta de Google y mira lo que pasa en tu web junto al resto del trabajo.",
    points: ["Clics, impresiones, CTR y posición, con las consultas y páginas principales", "Sesiones, canales de tráfico y páginas de aterrizaje", "Canibalizaciones: varias URLs compitiendo por la misma consulta"],
    visual: (<><div className="flex items-center justify-between"><p className="text-xs font-bold">Clics</p><Pill>▲ 12 %</Pill></div><Bars values={[40, 52, 47, 60, 66, 74, 90]} className="mt-4 h-28" /></>),
  },
];

export default function FuncionesPage() {
  return (
    <>
      <PageHero kicker="Funciones" title="Lo esencial del SEO, en un solo sitio" text="Seguimiento, backlinks, auditorías y optimización de títulos. Cada dato con su pista y su fuente." />

      <div className="bg-background">
        <div className="mx-auto max-w-[1360px] divide-y divide-line px-5 sm:px-8 lg:px-10">
          {MODULES.map((m, i) => (
            <section key={m.id} id={m.id} className="scroll-mt-24 grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
              <Reveal className={i % 2 ? "lg:order-2" : ""}>
                <p className="text-sm font-bold text-ink"><span className="text-brand">{String(i + 1).padStart(2, "0")}</span><span className="mx-2 text-ink-faint">/</span>{m.kicker}</p>
                <h2 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-4xl">{m.title}</h2>
                <p className="mt-3 max-w-md text-lg leading-relaxed text-ink-soft">{m.text}</p>
                <ul className="mt-6 space-y-3">
                  {m.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-ink-soft">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{p}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={80} className={i % 2 ? "lg:order-1" : ""}>
                <div className="relative overflow-hidden rounded-[24px] border border-line bg-surface-muted p-6 sm:p-8">
                  <div className="mk-grid-light pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
                  <div className="relative rounded-[18px] border border-line bg-surface p-5 sm:p-6">{m.visual}</div>
                  <p className="relative mt-3 text-xs text-ink-faint">Datos de ejemplo.</p>
                </div>
              </Reveal>
            </section>
          ))}
        </div>

        <div className="mx-auto max-w-[1360px] px-5 pb-20 sm:px-8 lg:px-10">
          <div className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line md:grid-cols-2">
            <div className="bg-surface p-8"><h3 className="text-lg font-bold text-ink">Informes</h3><p className="mt-2 text-ink-soft">Un informe claro por proyecto, con las secciones que elijas, listo para imprimir o guardar en PDF.</p></div>
            <div className="bg-surface p-8"><h3 className="text-lg font-bold text-ink">Asistente con IA</h3><p className="mt-2 text-ink-soft">Pregunta sobre tu proyecto en lenguaje normal. Responde con tus datos y no modifica nada.</p></div>
          </div>
        </div>
      </div>

      <CtaBand />
    </>
  );
}
