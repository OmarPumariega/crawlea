import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Términos de uso · Crawlea", alternates: { canonical: "/legal/terminos" } };

export default function Page() {
  return (
    <LegalPage
      title="Términos de uso"
      sections={[
        { heading: "El servicio", hint: "TEXTO PENDIENTE" },
        { heading: "Cuenta y planes", hint: "TEXTO PENDIENTE: planes, límites de uso, suscripciones y cancelación" },
        { heading: "Uso aceptable", hint: "TEXTO PENDIENTE" },
        { heading: "Datos estimados y resultados", hint: "TEXTO PENDIENTE: sin garantía de posiciones" },
        { heading: "Ley aplicable", hint: "JURISDICCIÓN PENDIENTE" },
      ]}
    />
  );
}
