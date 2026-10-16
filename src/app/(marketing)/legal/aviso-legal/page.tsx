import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Aviso legal · Crawlea",
  description: "Datos identificativos del titular de Crawlea y condiciones generales de uso del sitio web.",
  alternates: { canonical: "/legal/aviso-legal" },
};

export default function Page() {
  return (
    <LegalDoc
      title="Aviso legal"
      intro={`En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se facilitan los datos identificativos del titular de ${COMPANY.web}.`}
      sections={[
        {
          heading: "Titular del sitio web",
          body: [
            { list: [
              `Titular: ${COMPANY.nombre}`,
              `NIF/CIF: ${COMPANY.nif}`,
              `Domicilio: ${COMPANY.domicilio}`,
              `Correo electrónico de contacto: ${COMPANY.email}`,
              `Teléfono: ${COMPANY.telefono}`,
              `Datos registrales: ${COMPANY.registro}`,
              `Nombre comercial y dominio: ${COMPANY.marca}, ${COMPANY.web}`,
            ] },
          ],
        },
        {
          heading: "Objeto",
          body: [
            "Crawlea es una plataforma de herramientas SEO en línea: seguimiento de posiciones, auditoría técnica, palabras clave, backlinks, análisis de competidores, SEO local y generación de contenido, entre otras funciones. Este sitio web informa de ellas y permite crear una cuenta para utilizarlas.",
          ],
        },
        {
          heading: "Condiciones de uso del sitio web",
          body: [
            "El acceso y la navegación por el sitio son libres y gratuitos. Usar determinadas funciones exige crear una cuenta y aceptar los Términos de uso. La persona usuaria se compromete a hacer un uso lícito del sitio y a no realizar acciones que dañen, inutilicen o sobrecarguen sus sistemas, ni a intentar acceder a datos de otras cuentas.",
          ],
        },
        {
          heading: "Propiedad intelectual e industrial",
          body: [
            `Los contenidos del sitio (textos, diseños, código, logotipos, marca «${COMPANY.marca}», interfaz y bases de datos) son propiedad del titular o se usan con licencia, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución o transformación sin autorización expresa, salvo lo permitido por la ley.`,
            "Las marcas de terceros que aparecen en el sitio (por ejemplo, Google, Search Console, Analytics, PageSpeed Insights o Google Maps) pertenecen a sus respectivos titulares. Se citan solo para indicar la fuente de los datos, y no implican afiliación, patrocinio ni respaldo.",
          ],
        },
        {
          heading: "Responsabilidad",
          body: [
            "El titular procura que la información del sitio sea veraz y esté actualizada, pero no garantiza la ausencia de errores ni la disponibilidad continuada del servicio. Los datos mostrados por la herramienta proceden de fuentes de terceros o son estimaciones; se indican como tales. Crawlea no garantiza posiciones ni resultados en buscadores.",
            "El titular no se hace responsable de los daños derivados de un uso indebido del sitio, de fallos de terceros (proveedores de datos, de infraestructura o de pago) ni del contenido de los sitios web enlazados.",
          ],
        },
        {
          heading: "Enlaces",
          body: [
            "El sitio puede incluir enlaces a páginas de terceros. El titular no controla su contenido ni responde de él. Para enlazar al sitio, no se necesita permiso previo, siempre que el enlace no sugiera una relación inexistente ni dañe la imagen de la marca.",
          ],
        },
        {
          heading: "Protección de datos y cookies",
          body: [
            "El tratamiento de datos personales se detalla en la Política de privacidad, y el uso de cookies, en la Política de cookies.",
          ],
        },
        {
          heading: "Ley aplicable y jurisdicción",
          body: [
            `Este aviso se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de ${COMPANY.jurisdiccion}, sin perjuicio del fuero que corresponda por ley a las personas consumidoras y usuarias.`,
          ],
        },
      ]}
    />
  );
}
