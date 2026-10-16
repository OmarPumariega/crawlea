import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Política de privacidad · Crawlea",
  description: "Cómo trata Crawlea tus datos personales: qué datos, para qué, con quién y cuáles son tus derechos.",
  alternates: { canonical: "/legal/privacidad" },
};

export default function Page() {
  return (
    <LegalDoc
      title="Política de privacidad"
      intro="Esta política explica cómo tratamos tus datos personales cuando visitas crawlea.com, usas el analizador, nos escribes o utilizas la herramienta, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD)."
      sections={[
        {
          heading: "Responsable del tratamiento",
          body: [
            { list: [
              `Responsable: ${COMPANY.nombre}`,
              `NIF/CIF: ${COMPANY.nif}`,
              `Domicilio: ${COMPANY.domicilio}`,
              `Contacto para privacidad y ejercicio de derechos: ${COMPANY.email}`,
            ] },
          ],
        },
        {
          heading: "Qué datos tratamos, para qué y con qué base legal",
          body: [
            { table: {
              head: ["Finalidad", "Datos", "Base legal"],
              rows: [
                ["Crear y gestionar tu cuenta e iniciar sesión con Google", "Email, nombre y foto de tu cuenta de Google; identificador interno; plan", "Ejecución del contrato (art. 6.1.b RGPD)"],
                ["Prestar la herramienta: proyectos, rastreos, posiciones, informes, tareas y notas", "Los datos que introduces (dominios, palabras clave, datos de negocio local, notas) y los resultados generados", "Ejecución del contrato"],
                ["Conectar Google Search Console y Google Analytics (si lo activas)", "Datos de tus propiedades a las que concedes acceso de solo lectura: clics, impresiones, consultas, páginas, sesiones y conversiones", "Tu consentimiento (art. 6.1.a), que puedes revocar en cualquier momento"],
                ["Analizador de webs de la página principal", "La dirección web que escribes y el resultado técnico de la revisión. No se guarda tu dirección IP más allá del límite temporal de uso (en memoria)", "Interés legítimo en ofrecer una muestra del servicio (art. 6.1.f) y medidas precontractuales"],
                ["Atender consultas por el formulario de contacto", "Nombre, email y mensaje", "Interés legítimo / medidas precontractuales"],
                ["Cobro de suscripciones (cuando estén disponibles)", "Datos de facturación y de pago, que gestiona Stripe; nosotros guardamos el estado de la suscripción", "Ejecución del contrato y obligación legal (fiscal y contable)"],
                ["Control de costes, seguridad y prevención del abuso", "Registros de uso y consumo de servicios de terceros por cuenta y proyecto; registros técnicos", "Interés legítimo en la seguridad y la sostenibilidad del servicio"],
                ["Analítica de uso del sitio y de la app (opcional)", "Páginas vistas, clics y acciones en módulos, con un identificador anónimo (sin email ni nombre) y cookies de Google Analytics", "Tu consentimiento, mediante el banner de cookies"],
                ["Avisos por correo sobre tu cuenta (auditorías, caídas de posición, límites de gasto)", "Email de tu cuenta y el contenido del aviso", "Ejecución del contrato"],
              ],
            } },
            "No tomamos decisiones automatizadas con efectos jurídicos sobre ti. No usamos tus datos para publicidad.",
          ],
        },
        {
          heading: "Datos obtenidos de Google (Search Console y Analytics)",
          body: [
            "El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se ajustará a la Política de datos de usuario de los servicios de las API de Google, incluidos los requisitos de uso limitado (Google API Services User Data Policy, Limited Use).",
            { list: [
              "Solo pedimos permisos de lectura (webmasters.readonly y analytics.readonly) y solo para mostrarte tus propios datos dentro de Crawlea.",
              "No vendemos estos datos, no los cedemos a terceros con fines publicitarios y no los usamos para entrenar modelos de IA.",
              "Una persona no puede leer tus datos de Google salvo que lo autorices, sea necesario por seguridad o soporte, lo exija la ley o los datos estén agregados y anonimizados.",
              "Los datos agregados de tu proyecto pueden enviarse a un proveedor de modelos de lenguaje únicamente para responder a tus propias peticiones en el asistente de la app.",
              "Puedes desconectar Google en cualquier momento desde tu perfil y revocar el acceso en myaccount.google.com/permissions.",
            ] },
          ],
        },
        {
          heading: "Destinatarios y encargados del tratamiento",
          body: [
            "Para prestar el servicio utilizamos proveedores que tratan datos en nuestro nombre, con contrato de encargo de tratamiento:",
            { table: {
              head: ["Proveedor", "Para qué", "Datos que recibe"],
              rows: [
                ["Google LLC / Google Ireland Ltd.", "Inicio de sesión, Search Console, Analytics, PageSpeed, Tag Manager", "Los necesarios para cada servicio"],
                ["DataForSEO", "Datos de palabras clave, resultados de búsqueda, backlinks y Maps", "Palabras clave, dominios y ubicaciones consultados; no tus datos personales"],
                ["OpenRouter y los proveedores de modelos que usa", "Generación de textos y asistente con IA", "Texto de las páginas y de los datos del proyecto necesarios para cada petición"],
                ["Stripe Payments Europe Ltd.", "Cobros (cuando estén activos)", "Datos de pago y facturación"],
                [`Proveedor de alojamiento (${COMPANY.ubicacionHosting})`, "Servidores y base de datos", "Todos los datos de la cuenta, cifrados en reposo cuando son credenciales"],
                [COMPANY.proveedorCorreo, "Envío de correos y avisos", "Email y contenido del aviso"],
              ],
            } },
            "No vendemos datos personales. Podremos comunicar datos a las autoridades cuando una ley nos obligue.",
          ],
        },
        {
          heading: "Transferencias internacionales",
          body: [
            "Algunos proveedores (Google, OpenRouter y sus proveedores de modelos, Stripe) pueden tratar datos fuera del Espacio Económico Europeo, en particular en Estados Unidos. Cuando ocurre, se apoya en una decisión de adecuación (como el Marco de Privacidad de Datos UE-EE. UU.) o en cláusulas contractuales tipo de la Comisión Europea.",
          ],
        },
        {
          heading: "Cuánto tiempo conservamos los datos",
          body: [
            { list: [
              "Cuenta y proyectos: mientras mantengas la cuenta. Al borrarla, se eliminan sus proyectos y datos asociados, incluidos los tokens de Google.",
              "Registros de consumo de servicios de terceros: se conservan sin vínculo con tu proyecto tras el borrado, por motivos contables.",
              "Facturación: el tiempo exigido por la normativa fiscal y mercantil.",
              "Mensajes de contacto: el tiempo necesario para atenderlos y, como máximo, [PLAZO, p. ej. 12 meses] después.",
              "Analítica: según los plazos de Google Analytics configurados en la propiedad ([14 meses] por defecto en el aviso).",
            ] },
          ],
        },
        {
          heading: "Tus derechos",
          body: [
            "Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, y retirar tu consentimiento en cualquier momento, escribiendo a " + COMPANY.email + " e indicando el derecho que ejerces. Podemos pedirte que acredites tu identidad. Respondemos en un plazo máximo de un mes.",
            "Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
          ],
        },
        {
          heading: "Seguridad",
          body: [
            "Aplicamos medidas técnicas y organizativas razonables: conexión cifrada (HTTPS), aislamiento de datos por cuenta, cifrado de credenciales y tokens en la base de datos, control de acceso y límites de uso. Ningún sistema es infalible; si hubiera una brecha que te afecte de forma relevante, te lo comunicaremos según exige la ley.",
          ],
        },
        {
          heading: "Menores",
          body: ["El servicio está dirigido a personas mayores de 18 años. No tratamos de forma consciente datos de menores."],
        },
        {
          heading: "Cambios en esta política",
          body: ["Podemos actualizar esta política. Si el cambio es sustancial, te lo avisaremos en la web o por correo y, cuando proceda, volveremos a pedirte la aceptación."],
        },
      ]}
    />
  );
}
