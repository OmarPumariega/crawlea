import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import { COMPANY } from "@/lib/legal/company";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Condiciones de contratación · Crawlea",
  description: "Condiciones de compra de las suscripciones de Crawlea: precios, pago, renovación, desistimiento y cancelación.",
  alternates: { canonical: "/legal/condiciones-contratacion" },
};

export default function Page() {
  const plans = Object.values(PLANS);
  return (
    <LegalDoc
      title="Condiciones de contratación"
      intro={`Estas condiciones regulan la contratación de las suscripciones de pago de ${COMPANY.marca} con ${COMPANY.nombre} (NIF/CIF ${COMPANY.nif}). Se aplican junto con los Términos de uso. Las suscripciones de pago estarán disponibles próximamente; hasta entonces, el plan Gratis no tiene coste.`}
      sections={[
        {
          heading: "Planes y precios",
          body: [
            { table: {
              head: ["Plan", "Precio mensual", "Proyectos"],
              rows: plans.map((p) => [p.nombre, p.precioEurMes === 0 ? "0 €" : `${p.precioEurMes} € (IVA incluido)`, p.maxProyectos === null ? "Sin límite" : String(p.maxProyectos)]),
            } },
            "Los precios y límites pueden cambiar. Un cambio de precio no afecta al periodo ya pagado, y a las suscripciones en curso les avisaremos con al menos 30 días de antelación; podrás cancelar antes de que se aplique.",
          ],
        },
        {
          heading: "Proceso de contratación",
          body: [
            "Para contratar, inicias sesión, eliges un plan y completas el pago en la pasarela de Stripe. Antes de confirmar, verás el plan, el precio y los impuestos. Al pulsar el botón de pago, aceptas estas condiciones y los Términos de uso. Recibirás la confirmación y la factura por correo. La contratación se formaliza en español.",
          ],
        },
        {
          heading: "Pago y facturación",
          body: [
            "El pago se realiza por adelantado con tarjeta u otros medios que ofrezca Stripe. Nosotros no almacenamos los datos de tu tarjeta. La suscripción es mensual y se renueva automáticamente cada mes hasta que la canceles. Emitimos una factura por cada cobro con los datos que nos facilites; debes mantenerlos correctos.",
          ],
        },
        {
          heading: "Renovación, cancelación y cambios de plan",
          body: [
            { list: [
              "Puedes cancelar cuando quieras desde el portal de facturación. La cancelación evita futuras renovaciones y mantiene el acceso hasta el final del periodo ya pagado.",
              "Puedes cambiar de plan en cualquier momento. Al subir de plan, el cambio es inmediato y se ajusta el importe de forma proporcional; al bajar, se aplica en la siguiente renovación.",
              "Si falla un pago, reintentaremos el cobro; si no se resuelve, la cuenta volverá al plan Gratis y los límites de ese plan se aplicarán de nuevo. No se borran tus datos.",
            ] },
          ],
        },
        {
          heading: "Derecho de desistimiento",
          body: [
            "Si contratas como persona consumidora, tienes derecho a desistir en 14 días naturales desde la contratación, sin necesidad de justificarlo, escribiendo a " + COMPANY.email + " o con el modelo de formulario de desistimiento. Te devolveremos los pagos en un máximo de 14 días desde que nos comuniques tu decisión.",
            "Si pides expresamente que el servicio empiece antes de que acabe ese plazo, y lo has utilizado, deberás abonar la parte proporcional ya prestada. Cuando el servicio se haya prestado por completo con tu consentimiento expreso y conocimiento de que pierdes el derecho de desistimiento, este se extingue. Este derecho no aplica si contratas como profesional o empresa.",
          ],
        },
        {
          heading: "Reembolsos",
          body: [
            "Salvo el desistimiento y lo que exija la ley, los pagos de periodos ya iniciados no son reembolsables. Si has sufrido un problema grave y atribuible al servicio, escríbenos y lo estudiaremos de buena fe.",
          ],
        },
        {
          heading: "Uso razonable y límites",
          body: [
            "Cada plan incluye un tope mensual de consultas de pago a servicios de terceros. Si lo alcanzas, esas consultas se pausan hasta el mes siguiente. Podemos limitar usos que perjudiquen al servicio o al resto de personas usuarias.",
          ],
        },
        {
          heading: "Conformidad y garantía",
          body: [
            "El servicio se presta con diligencia profesional. Si el contenido o servicio digital no es conforme, las personas consumidoras tienen los derechos que reconoce el Real Decreto Legislativo 1/2007 (texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios).",
          ],
        },
        {
          heading: "Atención al cliente y reclamaciones",
          body: [
            `Para cualquier duda o reclamación, escribe a ${COMPANY.email}. Disponemos de hojas de reclamaciones a disposición de las personas consumidoras. También puedes acudir a la plataforma europea de resolución de litigios en línea: https://ec.europa.eu/consumers/odr.`,
          ],
        },
        {
          heading: "Ley aplicable y jurisdicción",
          body: [
            `Estas condiciones se rigen por la ley española. Los juzgados y tribunales de ${COMPANY.jurisdiccion} serán competentes, salvo que la ley atribuya otro fuero a las personas consumidoras.`,
          ],
        },
      ]}
    />
  );
}
