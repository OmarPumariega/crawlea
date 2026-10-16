import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import CookieSettingsLink from "@/components/analytics/CookieSettingsLink";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Política de cookies · Crawlea",
  description: "Qué cookies y almacenamiento local usa Crawlea, para qué y cómo gestionarlos.",
  alternates: { canonical: "/legal/cookies" },
};

export default function Page() {
  return (
    <>
      <LegalDoc
        title="Política de cookies"
        intro="Una cookie es un pequeño archivo que un sitio web guarda en tu dispositivo. Crawlea usa cookies técnicas, necesarias para funcionar, y, solo si las aceptas, cookies de analítica. No usamos cookies de publicidad ni de seguimiento entre sitios."
        sections={[
          {
            heading: "Cookies necesarias (sin consentimiento)",
            body: [
              "Son imprescindibles para prestar el servicio que pides: mantener tu sesión, proteger el inicio de sesión y recordar tus preferencias. Por eso no requieren tu consentimiento.",
              { table: {
                head: ["Nombre", "Finalidad", "Duración", "Titular"],
                rows: [
                  ["next-auth.session-token (o __Secure-next-auth.session-token)", "Mantiene tu sesión iniciada", "30 días", "Propia"],
                  ["next-auth.csrf-token (o __Host-next-auth.csrf-token)", "Protección contra falsificación de peticiones en el acceso", "Sesión", "Propia"],
                  ["next-auth.callback-url (o __Secure-next-auth.callback-url)", "Recuerda a qué página volver tras iniciar sesión", "Sesión", "Propia"],
                  ["google_oauth_state", "Seguridad al conectar Search Console y Analytics", "10 minutos", "Propia"],
                  ["crawlea_consent", "Guarda tu elección sobre las cookies", "12 meses", "Propia"],
                ],
              } },
            ],
          },
          {
            heading: "Almacenamiento local del navegador",
            body: [
              "Además de cookies, guardamos algunas preferencias en el almacenamiento local de tu navegador. No se envían a nuestros servidores.",
              { table: {
                head: ["Clave", "Finalidad"],
                rows: [
                  ["theme", "Recuerda si prefieres el tema claro u oscuro"],
                  ["crawlea:recentProjects", "Lista tus últimos proyectos en el selector (solo dentro de la app)"],
                  ["crawlea:copilotWidget", "Estado del asistente flotante (solo dentro de la app)"],
                  ["crawlea:signupTracked", "Evita contar dos veces un registro, solo si aceptas la analítica"],
                ],
              } },
            ],
          },
          {
            heading: "Cookies de analítica (con tu consentimiento)",
            body: [
              "Solo si pulsas «Aceptar» (o activas la analítica en «Configurar»), cargamos Google Tag Manager y Google Analytics 4 para medir qué páginas se visitan y qué funciones se usan, y así mejorar Crawlea. Los datos se miden sin tu email ni tu nombre; dentro de la app se usa un identificador anónimo.",
              { table: {
                head: ["Nombre", "Finalidad", "Duración", "Titular"],
                rows: [
                  ["_ga", "Distingue usuarios únicos", "2 años", "Google"],
                  ["_ga_<ID de medición>", "Mantiene el estado de la sesión de Google Analytics 4", "2 años", "Google"],
                ],
              } },
              "Si rechazas, no se carga ninguna etiqueta de analítica ni se guarda ninguna de estas cookies. Los proveedores pueden tratar datos fuera de la UE; consulta la Política de privacidad.",
            ],
          },
          {
            heading: "Cómo cambiar o retirar tu consentimiento",
            body: [
              "Puedes cambiar tu elección cuando quieras con el botón «Configurar cookies» que hay en el pie de la web. Retirar el consentimiento es tan fácil como darlo, y al hacerlo borramos las cookies de analítica.",
              "También puedes borrar o bloquear cookies desde la configuración de tu navegador (Chrome, Firefox, Safari y Edge lo permiten). Si bloqueas las necesarias, partes del servicio, como el inicio de sesión, no funcionarán.",
            ],
          },
          {
            heading: "Responsable y cambios",
            body: [
              `El responsable es ${COMPANY.nombre} (${COMPANY.email}). Actualizaremos esta política si cambia el uso de cookies; cuando el cambio sea relevante, volveremos a pedirte tu elección.`,
            ],
          },
        ]}
      />
      <div className="mx-auto -mt-8 max-w-3xl px-5 pb-20 sm:px-8">
        <CookieSettingsLink className="rounded-full bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-strong" />
      </div>
    </>
  );
}
