import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { FAQ, FAQ_CATS } from "@/lib/marketing-content";
import { FEATURES } from "@/lib/marketing-features";
import SectionHead from "@/components/marketing/SectionHead";
import CtaBand from "@/components/marketing/CtaBand";
import Reveal from "@/components/marketing/Reveal";
import FeatureCarousel from "@/components/marketing/FeatureCarousel";
import FeatureCard from "@/components/marketing/FeatureCard";
import ProductTour from "@/components/marketing/ProductTour";
import Audiences from "@/components/marketing/Audiences";
import FaqAccordion from "@/components/marketing/FaqAccordion";
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
              Rastreo, posiciones y backlinks en un solo sitio
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

      {/* ============ LA HERRAMIENTA POR DENTRO (capturas) ============ */}
      <section data-section="herramienta" className="border-b border-line bg-background">
        <div className="mx-auto max-w-[1360px] px-5 pb-24 pt-8 sm:px-8 lg:px-10">
          <Reveal>
            <p className="text-sm font-bold text-ink"><span className="text-brand">Capturas</span><span className="mx-2 text-ink-faint">/</span>La herramienta por dentro</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-ink sm:text-5xl">Así se ve cada módulo, por dentro</h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">Elige uno y mira la pantalla tal como la usarás.</p>
          </Reveal>
          <ProductTour />
        </div>
      </section>

      {/* ============ PRECIOS (banda oscura) ============ */}
      <section data-section="precios-home" className="relative overflow-hidden bg-[#0E1033] py-24 text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79,92,245,0.45), transparent 70%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(115,129,255,0.25), transparent 70%)" }} />
        <div className="mk-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80"><span className="h-1.5 w-1.5 rounded-full bg-brand-200" />Precios</p>
              <h2 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-6xl">SEO claro, a un precio justo</h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/70">Empieza gratis y sube de plan cuando lo necesites. Sin tarjeta para empezar y sin permanencia.</p>
            </div>
          </Reveal>
          <Reveal className="mt-14" delay={80}><PricingCards variant="dark" /></Reveal>
          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/70">
            {["Plan Gratis sin tarjeta", "Cancelas cuando quieras", "IVA incluido"].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/40"><Check className="h-3 w-3 text-brand-200" aria-hidden="true" /></span>{t}</li>
            ))}
          </ul>
          <p className="mt-10 text-center">
            <Link href="/precios" className="inline-flex items-center gap-2 text-[15px] font-bold text-brand-200 hover:text-white">Compara los planes al detalle <ArrowRight className="h-4 w-4" /></Link>
          </p>
        </div>
      </section>

      {/* ============ PARA QUIÉN ============ */}
      <section data-section="para-quien" className="bg-background">
        <div className="mx-auto max-w-[1360px] px-5 py-24 sm:px-8 lg:px-10">
          <Reveal><SectionHead n="01" label="Para quién" title="Hecho para quien hace SEO a diario" text="Tres formas de usarlo. Elige la tuya y mira cómo sería un día." /></Reveal>
          <Reveal><Audiences /></Reveal>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-background">
        <div className="mx-auto max-w-[1360px] px-5 py-24 sm:px-8 lg:px-10">
          <FaqAccordion items={FAQ} cats={FAQ_CATS} />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
