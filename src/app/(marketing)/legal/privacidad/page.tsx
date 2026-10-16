import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Política de privacidad · Crawlea", alternates: { canonical: "/legal/privacidad" } };

export default function Page() {
  return (
    <LegalPage
      title="Política de privacidad"
      sections={[
        { heading: "Quién es el responsable", hint: "TITULAR, NIF, DIRECCIÓN Y EMAIL DE CONTACTO" },
        { heading: "Qué datos tratamos y para qué", hint: "TEXTO PENDIENTE: cuenta de Google, proyectos, uso y conexión con Search Console y Analytics" },
        { heading: "Con quién los compartimos", hint: "TEXTO PENDIENTE: Google, Stripe, proveedores de datos SEO e IA, hosting" },
        { heading: "Cuánto tiempo los conservamos", hint: "TEXTO PENDIENTE" },
        { heading: "Tus derechos", hint: "TEXTO PENDIENTE: acceso, rectificación, supresión y cómo ejercerlos" },
      ]}
    />
  );
}
