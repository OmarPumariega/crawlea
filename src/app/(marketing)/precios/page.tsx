import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/lib/marketing-content";
import PricingCards from "@/components/marketing/PricingCards";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import CtaBand from "@/components/marketing/CtaBand";

export const metadata: Metadata = {
  title: "Precios · Crawlea",
  description: "Empieza gratis y sube de plan cuando lo necesites. Precios claros, sin letra pequeña.",
  alternates: { canonical: "/precios" },
};

// Renderiza desde plans.ts: misma fuente de verdad que el backend.
export default async function PreciosPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <>
      <PageHero kicker="Precios" title="SEO claro, a un precio justo" text="Empieza gratis y sube de plan cuando lo necesites. Sin tarjeta para empezar." />

      <section className="bg-background">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10">
          <Reveal className="relative z-10 -mt-12">
            <PricingCards autoPlan={plan} />
          </Reveal>
        </div>

        <div className="mx-auto grid max-w-[1360px] gap-12 px-5 py-24 sm:px-8 lg:px-10 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <h2 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">Preguntas frecuentes</h2>
            <p className="mt-4 max-w-xs text-ink-soft">¿Te queda alguna duda? <Link href="/contacto" className="font-bold text-brand hover:text-brand-strong">Escríbenos</Link>.</p>
          </Reveal>
          <Reveal delay={80}>
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary data-track="faq_toggle" data-track-question={f.q} className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold text-ink">
                    {f.q}
                    <span className="text-2xl font-light text-brand transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
