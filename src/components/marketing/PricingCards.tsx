import Link from "next/link";
import { Check } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { PLANS } from "@/lib/plans";
import { stripeReady } from "@/lib/stripe/client";
import CheckoutButton from "@/components/marketing/CheckoutButton";

// Tarjetas de planes compartidas por la home y /precios: una sola fuente
// (plans.ts) y un solo diseño. Cuando haya precios y límites definitivos se
// cambia aquí y se actualizan las dos páginas.
export default async function PricingCards({ className = "", autoPlan }: { className?: string; autoPlan?: string }) {
  const plans = Object.values(PLANS);
  const [session, payReady] = await Promise.all([getServerSession(authOptions), stripeReady()]);
  const loggedIn = !!session?.user?.id;
  // Plan y suscripción actuales: evita ofrecer comprar lo que ya tienes.
  const me = loggedIn
    ? await prisma.user.findUnique({ where: { id: session!.user.id }, select: { plan: true, stripeSubscriptionId: true } })
    : null;
  return (
    <div data-section="precios" className={"grid overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_30px_70px_-30px_rgba(17,20,43,0.35)] md:grid-cols-3 " + className}>
      {plans.map((p) => {
        const dark = p.id === "basic";
        const gratis = p.precioEurMes === 0;
        return (
          <section key={p.id} className={"flex flex-col p-8 md:border-r md:last:border-r-0 " + (dark ? "bg-[#0E1033] text-white" : "border-line")}>
            <h3 className={"text-lg font-bold " + (dark ? "text-white" : "text-ink")}>{p.nombre}</h3>
            <p className={"mt-1 min-h-10 text-sm " + (dark ? "text-white/65" : "text-ink-soft")}>{p.descripcion}</p>
            <p className="mt-6 text-5xl font-extrabold tracking-[-0.035em] tabular-nums">
              {p.precioEurMes} € <span className={"text-sm font-medium tracking-normal " + (dark ? "text-white/50" : "text-ink-faint")}>/mes</span>
            </p>
            <ul className={"mt-7 flex-1 space-y-3 text-sm " + (dark ? "text-white/80" : "text-ink-soft")}>
              {[
                p.maxProyectos === null ? "Proyectos sin límite" : `${p.maxProyectos} ${p.maxProyectos === 1 ? "proyecto" : "proyectos"}`,
                gratis ? "Sin Backlinks, Competidores ni Geogrid" : "Todas las funciones",
                "Consultas de pago con límite mensual",
                "Conexión con Search Console y Analytics",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className={"mt-0.5 h-4 w-4 shrink-0 " + (dark ? "text-brand-200" : "text-brand")} aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            {(() => {
              const cls = "mt-8 block w-full rounded-full px-5 py-3 text-center text-sm font-bold transition-colors " + (dark ? "bg-white text-brand-700 hover:bg-brand-50" : gratis ? "bg-brand text-white hover:bg-brand-strong" : "border border-line text-ink hover:bg-surface-muted");
              const label = gratis ? "Empieza gratis" : `Elige ${p.nombre}`;
              if (loggedIn && me?.plan === p.id) {
                return <span className={cls + " cursor-default opacity-70"}>Tu plan actual</span>;
              }
              if (!gratis && payReady && loggedIn) {
                // Con suscripción activa los cambios se hacen desde el portal.
                if (me?.stripeSubscriptionId) {
                  return <Link href="/app/perfil" data-track="manage_subscription_click" className={cls}>Cambiar desde tu perfil</Link>;
                }
                return <CheckoutButton plan={p.id} priceEur={p.precioEurMes} autoStart={autoPlan === p.id} className={cls}>{label}</CheckoutButton>;
              }
              return (
                <Link
                  href={gratis ? (loggedIn ? "/app" : "/registro") : `/registro?plan=${p.id}`}
                  data-track="pricing_cta_click"
                  data-track-plan={p.id}
                  data-track-price_eur={String(p.precioEurMes)}
                  className={cls}
                >
                  {gratis && loggedIn ? "Ir al panel" : label}
                </Link>
              );
            })()}
            {!gratis && !payReady && <p className={"mt-2 text-center text-xs " + (dark ? "text-white/45" : "text-ink-faint")}>Pago disponible próximamente. Empiezas en Gratis.</p>}
            {!gratis && payReady && !loggedIn && <p className={"mt-2 text-center text-xs " + (dark ? "text-white/45" : "text-ink-faint")}>Crea tu cuenta gratis y pasa de plan cuando quieras. IVA incluido.</p>}
          </section>
        );
      })}
    </div>
  );
}
