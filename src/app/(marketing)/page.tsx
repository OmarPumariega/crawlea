import type { Metadata } from "next";
import Link from "next/link";
import {
  Anchor,
  FileText,
  Globe,
  Key,
  Map,
  PenLine,
  ShieldCheck,
  TrendingUp,
  Users,
  FileBarChart2,
} from "lucide-react";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Crawlea · El SEO esencial, a tu alcance",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const FEATURES = [
  { icon: TrendingUp, title: "Posiciones", text: "Mira en qué puesto sale tu web en Google, por ubicación, y cómo evoluciona." },
  { icon: ShieldCheck, title: "Auditoría", text: "Rastreamos tu web entera y te decimos qué problemas corregir primero." },
  { icon: Key, title: "Palabras clave", text: "Volumen estimado, intención y estacionalidad de cada palabra clave." },
  { icon: Anchor, title: "Backlinks", text: "Qué webs te enlazan, cuánta autoridad tienen y cuáles enlazan a tu competencia." },
  { icon: Users, title: "Competidores", text: "Descubre las palabras por las que ellos posicionan y tú no." },
  { icon: Map, title: "SEO local", text: "Un mapa de calor con tu posición en Google Maps, punto a punto." },
  { icon: FileText, title: "Títulos y datos estructurados", text: "Títulos, descripciones y schema listos para tus páginas, a partir de su contenido real." },
  { icon: PenLine, title: "Contenido con IA", text: "Genera textos y optimiza páginas existentes con cambios concretos." },
  { icon: Globe, title: "Search Console y Analytics", text: "Tus datos de Google en el mismo sitio que el resto del trabajo." },
  { icon: FileBarChart2, title: "Informes", text: "Un informe claro por proyecto, listo para imprimir o guardar en PDF." },
];

const STEPS = [
  { n: "1", title: "Añade tu web", text: "Crea un proyecto con el dominio que quieres seguir." },
  { n: "2", title: "Lanza el primer rastreo", text: "Tarda unos minutos y detecta los problemas de tu web." },
  { n: "3", title: "Mejora lo primero", text: "Cada dato viene con una pista de qué hacer a continuación." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Crawlea",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Plan Gratis" },
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl">
            El SEO esencial, a tu alcance
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-ink-soft">
            Rastrea tu web, sigue tus posiciones y aprende qué mejorar primero.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/registro" className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(79,92,245,0.5)] hover:bg-brand-strong">
              Empieza gratis
            </Link>
            <Link href="/precios" className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink hover:bg-surface-muted">
              Mira los precios
            </Link>
          </div>
          <p className="text-sm text-ink-faint">El plan Gratis no pide tarjeta.</p>
        </div>

        {/* Tarjeta de muestra: ilustra el formato dato + pista + fuente. */}
        <div className="rounded-[20px] border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(17,20,43,0.04),0_10px_28px_-14px_rgba(17,20,43,0.10)]" aria-label="Ejemplo de cómo se muestra un dato">
          <p className="text-xs font-semibold text-ink-faint">Posición media</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl font-extrabold tracking-[-0.03em] text-ink tabular-nums">8,4</span>
            <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-xs font-bold text-accent-ink">▲ 1,2 pts</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Estás cerca de la primera página. Mejora el título de tus 3 páginas más cercanas.
          </p>
          <div className="mt-5 flex items-end gap-1.5" aria-hidden="true">
            {[34, 42, 38, 52, 58, 70, 82].map((h, i) => (
              <span key={i} className={i === 6 ? "w-full rounded-t-lg bg-brand" : "w-full rounded-t-lg bg-brand-100"} style={{ height: h }} />
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-faint">Datos de ejemplo.</p>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-ink">Lo que puedes hacer</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Seguimiento, backlinks, auditorías y optimización de títulos en un solo sitio.</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[20px] border border-line bg-background p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-brand">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-bold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Datos reales */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-[-0.02em] text-ink">Datos reales, sin inventos</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Cada cifra viene de una fuente comprobable: Search Console, Analytics, PageSpeed, los resultados de Google y el rastreo de tu propia web. Cuando un dato es una estimación, lo decimos.
            </p>
          </div>
          <ol className="space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-[20px] border border-line bg-surface p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{s.n}</span>
                <div>
                  <h3 className="font-bold text-ink">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-soft">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-[24px] bg-brand px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-3xl font-extrabold tracking-[-0.02em]">SEO claro, a un precio justo</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">Crea tu cuenta con Google y rastrea tu primera web hoy.</p>
          <Link href="/registro" className="mt-6 inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Rastrea mi web
          </Link>
        </div>
      </section>
    </>
  );
}
