import type { Metadata } from "next";
import ContactForm from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contacto · Crawlea",
  description: "Escríbenos si tienes una duda o quieres contarnos algo. Te respondemos por email.",
  alternates: { canonical: "/contacto" },
};

export default async function ContactoPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-ink">Contacto</h1>
      <p className="mb-8 mt-3 text-ink-soft">Cuéntanos qué necesitas. Te respondemos por email.</p>
      <ContactForm topic={plan?.slice(0, 40)} />
    </div>
  );
}
