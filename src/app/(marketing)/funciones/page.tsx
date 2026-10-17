import type { Metadata } from "next";
import { Check } from "lucide-react";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import CtaBand from "@/components/marketing/CtaBand";
import { FEATURES } from "@/lib/marketing-features";

export const metadata: Metadata = {
  title: "Funciones · Crawlea",
  description: "Palabras clave, análisis de URL, auditoría, seguimiento de posiciones, competidores, backlinks, SEO local, visibilidad en IA, contenido e informes. Todas las herramientas de Crawlea.",
  alternates: { canonical: "/funciones" },
};

export default function FuncionesPage() {
  return (
    <>
      <PageHero kicker="Funciones" title="Lo esencial del SEO, en un solo sitio" text={`${FEATURES.length} herramientas para investigar, optimizar, auditar y seguir tu SEO. Cada dato con su pista y su fuente.`} />

      <div className="bg-background">
        <div className="mx-auto max-w-[1360px] divide-y divide-line px-5 sm:px-8 lg:px-10">
          {FEATURES.map((m, i) => (
            <section key={m.id} id={m.id} className="scroll-mt-24 grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
              <Reveal className={i % 2 ? "lg:order-2" : ""}>
                <p className="text-sm font-bold text-ink"><span className="text-brand">{String(i + 1).padStart(2, "0")}</span><span className="mx-2 text-ink-faint">/</span>{m.kicker}{m.paid && <span className="ml-3 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-ink-soft">Plan de pago</span>}</p>
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
      </div>

      <CtaBand />
    </>
  );
}
