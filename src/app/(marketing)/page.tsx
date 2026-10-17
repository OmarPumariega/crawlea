import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { AUDIENCES, FAQ } from "@/lib/marketing-content";
import { FEATURES } from "@/lib/marketing-features";
import SectionHead from "@/components/marketing/SectionHead";
import CtaBand from "@/components/marketing/CtaBand";
import Reveal from "@/components/marketing/Reveal";
import FeatureCarousel from "@/components/marketing/FeatureCarousel";
import FeatureCard from "@/components/marketing/FeatureCard";
import WorkflowTabs from "@/components/marketing/WorkflowTabs";
import PricingCards from "@/components/marketing/PricingCards";
import LogoMarquee from "@/components/marketing/LogoMarquee";
import HeroAnalyzer from "@/components/marketing/HeroAnalyzer";
import { AlertCard, DashboardMockup, GeoHeat, Pill } from "@/components/marketing/mockups";

export const metadata: Metadata = {
  title: "Crawlea · El SEO esencial, a tu alcance",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

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

      {/* ============ HERO ============ */}
      <section data-section="hero" className="relative overflow-hidden bg-[#0E1033] pb-8 pt-32 text-white sm:pt-40">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(79,92,245,0.65), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 30%, rgba(115,129,255,0.28), transparent 70%)" }} />
        <div className="mk-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="mk-glow pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-brand blur-[120px]" aria-hidden="true" />

        <div className="relative mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-200" />
              Herramienta SEO con datos reales
            </p>
            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              El SEO esencial,{" "}
              <span className="inline-block bg-gradient-to-r from-white via-brand-100 to-brand-300 bg-clip-text text-transparent">a tu alcance</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Rastrea tu web, sigue tus posiciones y aprende qué mejorar primero.
            </p>
            <HeroAnalyzer />
          </div>

          {/* Producto */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="pointer-events-none absolute -inset-x-10 -bottom-10 -top-6 rounded-[40px] bg-brand/30 blur-3xl" aria-hidden="true" />
            <div className="mk-tilt relative">
              <DashboardMockup />
            </div>
            <div className="mk-float-a absolute -left-4 top-24 hidden w-44 rounded-2xl border border-line bg-surface p-3.5 text-ink shadow-[0_24px_50px_-12px_rgba(10,12,50,0.6)] lg:block xl:-left-14">
              <p className="text-[11px] font-semibold text-ink-faint">«software seo»</p>
              <p className="mt-0.5 flex items-center gap-2 text-2xl font-extrabold tracking-[-0.03em] tabular-nums">3 <Pill>▲ 4</Pill></p>
              <p className="mt-1 text-[11px] text-ink-soft">Ya estás en la primera página.</p>
            </div>
            <div className="mk-float-b absolute -right-4 top-40 hidden lg:block xl:-right-12"><AlertCard /></div>
            <div className="mk-float-a absolute -bottom-6 right-24 hidden w-40 rounded-2xl border border-line bg-surface p-3 text-ink shadow-[0_24px_50px_-12px_rgba(10,12,50,0.6)] lg:block">
              <p className="mb-2 text-[11px] font-bold">Mapa de calor local</p>
              <GeoHeat className="gap-1" />
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-white/40">Maqueta con datos de ejemplo.</p>
        </div>
      </section>

      {/* ============ FUENTES ============ */}
      <section className="border-b border-line bg-surface py-8" aria-label="Fuentes de datos">
        <LogoMarquee />
      </section>

      {/* ============ FUNCIONES (carrusel) ============ */}
      <section data-section="funciones" className="overflow-hidden bg-background py-24">
        <Reveal>
          <FeatureCarousel count={FEATURES.length} title="Lo esencial del SEO, en un solo sitio">
            {FEATURES.map((f) => (
              <FeatureCard key={f.id} id={f.id} kicker={f.kicker} title={f.title} text={f.text} points={f.points} paid={f.paid}>
                {f.visual}
              </FeatureCard>
            ))}
          </FeatureCarousel>
        </Reveal>
        <div className="mx-auto mt-6 max-w-[1360px] px-5 sm:px-8 lg:px-10">
          <Link href="/funciones" data-track="see_all_features_click" className="inline-flex items-center gap-2 text-[15px] font-bold text-brand hover:text-brand-strong">
            Ver todas las funciones <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ============ CÓMO SE CONECTA ============ */}
      <section data-section="como-se-conecta" className="border-b border-line bg-background">
        <div className="mx-auto max-w-[1360px] px-5 py-24 sm:px-8 lg:px-10">
          <Reveal><SectionHead n="01" label="Cómo se conecta" title="Cada herramienta alimenta a la siguiente" text="Lo que descubres en una pasa a la otra con un clic. Así pasas de un dominio a un plan de mejora sin copiar y pegar." /></Reveal>
          <Reveal><WorkflowTabs /></Reveal>
        </div>
      </section>

      {/* ============ DATOS REALES (oscura) ============ */}
      <section data-section="datos-reales" className="relative overflow-hidden bg-[#0E1033] py-24 text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 60% 60% at 15% 50%, rgba(79,92,245,0.4), transparent 70%)" }} />
        <div className="mk-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1360px] items-center gap-14 px-5 sm:px-8 lg:px-10 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-200">Datos reales</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Cada dato, con su pista</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/70">
              No te dejamos con un número suelto. Cada cifra viene con una línea que dice qué significa o qué hacer, y la explicación completa a un clic. Si un dato es una estimación, lo decimos.
            </p>
            <ul className="mt-8 space-y-3 text-white/80">
              {["El dato, limpio y fácil de leer", "Una pista visible: qué significa o qué hacer", "La explicación, a un clic, con la fuente y su frescura"].map((t) => (
                <li key={t} className="flex items-start gap-3"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand"><Check className="h-3 w-3" /></span>{t}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-[24px] border border-line bg-surface p-6 text-ink shadow-[0_40px_90px_-30px_rgba(10,12,50,0.8)]">
              <p className="text-xs font-semibold text-ink-faint">Posición media</p>
              <p className="mt-1 flex items-center gap-3 text-5xl font-extrabold tracking-[-0.03em] tabular-nums">8,4 <Pill>▲ 1,2 pts</Pill> <Info className="h-5 w-5 text-brand" aria-hidden="true" /></p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">Estás cerca de la primera página. Mejora el título de tus 3 páginas más cercanas.</p>
              <div className="mt-4 rounded-2xl bg-surface-muted p-4 text-xs leading-relaxed text-ink-soft">
                <p className="font-bold text-ink">¿Qué es?</p>
                Es la media de tus posiciones en Google. Pasar del puesto 10 al 9 te lleva a la primera página, donde se concentran los clics.
                <p className="mt-2 text-ink-faint">Fuente: Search Console · actualizado hoy, 08:12 · Datos de ejemplo.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ PARA QUIÉN ============ */}
      <section data-section="para-quien" className="bg-background">
        <div className="mx-auto max-w-[1360px] px-5 py-24 sm:px-8 lg:px-10">
          <Reveal><SectionHead n="02" label="Para quién" title="Hecho para quien hace SEO a diario" text="Tres formas de usarlo. Cada una con las herramientas que de verdad necesita." /></Reveal>
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.title} delay={i * 80} className="h-full">
                <article className="flex h-full flex-col rounded-[22px] border border-line bg-surface p-7">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{a.kicker}</p>
                  <h3 className="mt-3 text-2xl font-extrabold leading-[1.1] tracking-[-0.025em] text-ink">{a.title}</h3>
                  <p className="mt-3 leading-relaxed text-ink-soft">{a.text}</p>
                  <ul className="mt-5 space-y-2.5">
                    {a.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{pt}</li>
                    ))}
                  </ul>
                  <Link href={a.href} data-track="audience_cta_click" data-track-audience={a.kicker} className="mt-auto inline-flex items-center gap-2 pt-7 text-[15px] font-bold text-brand hover:text-brand-strong">
                    {a.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRECIOS ============ */}
      <section data-section="precios-home" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1360px] px-5 py-24 sm:px-8 lg:px-10">
          <Reveal><SectionHead n="03" label="Precios" title="SEO claro, a un precio justo" text="Empieza gratis y sube de plan cuando lo necesites." /></Reveal>
          <Reveal className="mt-14"><PricingCards /></Reveal>
          <div className="mt-8">
            <Link href="/precios" className="inline-flex items-center gap-2 text-[15px] font-bold text-brand hover:text-brand-strong">Compara los planes <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-background">
        <div className="mx-auto grid max-w-[1360px] gap-12 px-5 py-24 sm:px-8 lg:px-10 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="text-sm font-bold text-ink"><span className="text-brand">04</span><span className="mx-2 text-ink-faint">/</span>Preguntas</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl">Preguntas frecuentes</h2>
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
