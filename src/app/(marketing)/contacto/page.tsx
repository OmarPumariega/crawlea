import type { Metadata } from "next";
import PageHero from "@/components/marketing/PageHero";
import ContactForm from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contacto · Crawlea",
  description: "Escríbenos si tienes una duda o quieres contarnos algo. Te respondemos por email.",
  alternates: { canonical: "/contacto" },
};

export default async function ContactoPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <>
      <PageHero kicker="Contacto" title="Cuéntanos qué necesitas" text="Te respondemos por email." />
      <section className="bg-background">
        <div className="mx-auto grid max-w-[1360px] gap-12 px-5 pb-24 sm:px-8 lg:px-10 lg:grid-cols-[1fr_1.2fr]">
          <ul className="space-y-6 pt-12 lg:pt-16">
            {[
              ["Dudas sobre los planes", "Te contamos qué incluye cada uno y cuál encaja con tu caso."],
              ["Ayuda con tu cuenta", "Si algo no funciona, cuéntanos qué has hecho y qué esperabas."],
              ["Ideas y sugerencias", "Lo que echas de menos nos ayuda a decidir qué construir."],
            ].map(([t, d]) => (
              <li key={t} className="border-t border-line pt-5">
                <h2 className="font-bold text-ink">{t}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</p>
              </li>
            ))}
          </ul>
          <div className="relative z-10 -mt-12">
            <ContactForm topic={plan?.slice(0, 40)} />
          </div>
        </div>
      </section>
    </>
  );
}
