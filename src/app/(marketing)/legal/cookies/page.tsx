import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Política de cookies · Crawlea", alternates: { canonical: "/legal/cookies" } };

export default function Page() {
  return (
    <LegalPage
      title="Política de cookies"
      sections={[
        { heading: "Qué cookies usamos", hint: "TEXTO PENDIENTE: hoy solo cookies técnicas de sesión y seguridad del acceso" },
        { heading: "Cómo gestionarlas", hint: "TEXTO PENDIENTE" },
      ]}
    />
  );
}
