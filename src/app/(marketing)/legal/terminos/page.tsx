import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Términos de uso · Crawlea",
  description: "Condiciones de uso del servicio Crawlea: cuenta, uso aceptable, datos, IA y responsabilidad.",
  alternates: { canonical: "/legal/terminos" },
};

export default function Page() {
  return (
    <LegalDoc
      title="Términos de uso"
      intro={`Estos términos regulan el uso del servicio ${COMPANY.marca} (${COMPANY.web}), ofrecido por ${COMPANY.nombre}. Al crear una cuenta o usar el servicio, aceptas estos términos. Si contratas un plan de pago, se aplican además las Condiciones de contratación.`}
      sections={[
        {
          heading: "El servicio",
          body: [
            "Crawlea es una herramienta SEO en línea que reúne seguimiento de posiciones, auditoría técnica, palabras clave, backlinks, análisis de competidores, SEO local, generación de títulos, datos estructurados y contenido con IA, informes y conexión con Google Search Console y Analytics. Las funciones disponibles dependen de tu plan y pueden cambiar con el tiempo.",
          ],
        },
        {
          heading: "Tu cuenta",
          body: [
            { list: [
              "Debes ser mayor de 18 años y tener capacidad para contratar.",
              "Inicias sesión con tu cuenta de Google. Eres responsable de la actividad de tu cuenta y de mantener su seguridad.",
              "Debes tener autoridad sobre los dominios que añades como proyectos, o permiso de su titular. Crawlea rastrea esos sitios, y tú respondes de que puedas hacerlo.",
              "Los datos que introduces son tuyos. Nos concedes el permiso necesario para tratarlos y prestarte el servicio.",
            ] },
          ],
        },
        {
          heading: "Uso aceptable",
          body: [
            "No puedes usar Crawlea para:",
            { list: [
              "Incumplir la ley o derechos de terceros.",
              "Rastrear sitios sin autorización o saltándote deliberadamente sus restricciones (por ejemplo, para sobrecargarlos).",
              "Intentar acceder a datos de otras cuentas, vulnerar la seguridad del servicio o eludir los límites de uso.",
              "Revender el servicio o su acceso, o extraer datos de forma masiva y automatizada fuera de los medios que ofrecemos.",
              "Introducir contenido ilícito o malicioso.",
            ] },
            "Podemos limitar o suspender cuentas que incumplan estas reglas, con aviso previo siempre que sea posible.",
          ],
        },
        {
          heading: "Planes, límites y costes de uso",
          body: [
            "Cada plan incluye un número de proyectos y un límite mensual de consultas de pago a servicios de terceros (por ejemplo, posiciones, palabras clave o backlinks). Al alcanzar el límite, esas consultas se bloquean hasta el mes siguiente o hasta que cambies de plan. Los límites y precios actuales figuran en la página de precios.",
          ],
        },
        {
          heading: "Datos de terceros, estimaciones y resultados",
          body: [
            "Los datos provienen de fuentes como Google, DataForSEO y el rastreo de tu propia web. Algunos, como el volumen de búsqueda o el tráfico de otras webs, son estimaciones y se indican como tales. Crawlea no garantiza que una acción mejore tus posiciones ni tus resultados: dependen de Google y de tu trabajo.",
          ],
        },
        {
          heading: "Funciones con inteligencia artificial",
          body: [
            "Los textos generados con IA (títulos, descripciones, contenido, asistente) pueden contener errores o imprecisiones. Debes revisarlos antes de publicarlos. Eres responsable del uso que hagas del contenido generado. Para generarlos, enviamos a proveedores de modelos el texto necesario para cada petición, tal como explica la Política de privacidad.",
          ],
        },
        {
          heading: "Conexión con Google",
          body: [
            "Si conectas Search Console o Analytics, nos autorizas a leer los datos de las propiedades que elijas, en modo solo lectura, para mostrártelos. Puedes desconectar en cualquier momento desde tu perfil o revocar el acceso en tu cuenta de Google. El uso de esos datos cumple la Política de datos de usuario de los servicios de las API de Google, incluidos los requisitos de uso limitado.",
          ],
        },
        {
          heading: "Disponibilidad y cambios",
          body: [
            "Trabajamos para que el servicio esté disponible, pero no garantizamos que funcione sin interrupciones ni errores. Podemos hacer mantenimientos, mejorar o retirar funciones. Si un cambio perjudica de forma relevante a un plan de pago, te avisaremos con antelación razonable.",
          ],
        },
        {
          heading: "Propiedad intelectual",
          body: [
            `${COMPANY.marca}, su software, diseño y marca pertenecen al titular. Se te concede una licencia personal, limitada, revocable y no transferible para usar el servicio mientras tu cuenta esté activa. Tus datos y los contenidos que generes siguen siendo tuyos.`,
          ],
        },
        {
          heading: "Responsabilidad",
          body: [
            "En la medida que permita la ley, el servicio se ofrece «tal cual» y el titular no responde de daños indirectos, lucro cesante ni pérdida de datos o de posiciones derivados del uso del servicio. Nada de lo anterior limita derechos que la ley reconozca a las personas consumidoras ni la responsabilidad que no pueda excluirse legalmente.",
          ],
        },
        {
          heading: "Baja y cancelación",
          body: [
            "Puedes borrar tu cuenta en cualquier momento desde tu perfil; se eliminan tus proyectos y datos asociados. Podemos suspender o cancelar una cuenta que incumpla estos términos. Las condiciones económicas de las suscripciones figuran en las Condiciones de contratación.",
          ],
        },
        {
          heading: "Modificación de los términos",
          body: [
            "Podemos modificar estos términos. Si el cambio es sustancial, te lo comunicaremos y, cuando proceda, te pediremos que aceptes la nueva versión para seguir usando el servicio.",
          ],
        },
        {
          heading: "Ley aplicable y jurisdicción",
          body: [
            `Estos términos se rigen por la ley española. Para cualquier controversia, los juzgados y tribunales de ${COMPANY.jurisdiccion}, sin perjuicio del fuero que corresponda a las personas consumidoras. También puedes recurrir a la plataforma europea de resolución de litigios en línea: https://ec.europa.eu/consumers/odr.`,
          ],
        },
      ]}
    />
  );
}
