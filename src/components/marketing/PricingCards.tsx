import Link from "next/link";
import { Check } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { PUBLIC_PLANS } from "@/lib/plans";
import { stripeReady } from "@/lib/stripe/client";
import CheckoutButton from "@/components/marketing/CheckoutButton";
import Spotlight from "@/components/marketing/Spotlight";

// Tarjetas de planes compartidas por la home y /precios: una sola fuente
// (plans.ts) y un solo diseño. Cuando haya precios y límites definitivos se
// cambia aquí y se actualizan las dos páginas.
export default async function PricingCards({ className = "", autoPlan, variant = "light" }: { className?: string; autoPlan?: string; variant?: "light" | "dark" }) {
  const plans = PUBLIC_PLANS;
  const [session, payReady] = await Promise.all([getServerSession(authOptions), stripeReady()]);
  const loggedIn = !!session?.user?.id;
  // Plan y suscripción actuales: evita ofrecer comprar lo que ya tienes.
  const me = loggedIn
    ? await prisma.user.findUnique({ where: { id: session!.user.id }, select: { plan: true, stripeSubscriptionId: true } })
    : null;
  if (variant === "dark") {
    const maxCredits = Math.max(...plans.map((p) => p.creditosMes ?? 0));
    return (
      <div data-section="precios" className={"grid items-stretch gap-5 lg:grid-cols-3 " + className}>
        {plans.map((p) => {
          const featured = p.id === "basic";
          const gratis = p.precioEurMes === 0;
          const credits = p.creditosMes ?? 0;
          const features = [
            p.maxProyectos === null ? "Proyectos sin límite" : `${p.maxProyectos} ${p.maxProyectos === 1 ? "proyecto" : "proyectos"}`,
            gratis ? "Sin competidores, backlinks, SEO local ni visibilidad en IA" : "Todas las funciones",
            "Auditoría, títulos, contenido y asistente sin gastar créditos",
            "Search Console y Analytics",
            "Informe en PDF o con enlace de solo lectura",
          ];
          const cta = (() => {
            const cls = "mt-8 block w-full rounded-full px-5 py-3.5 text-center text-sm font-bold transition-all duration-300 " + (featured ? "bg-white text-brand-700 hover:bg-brand-50" : gratis ? "bg-brand text-white hover:bg-brand-strong" : "border border-white/30 text-white hover:border-white hover:bg-white/10");
            const label = gratis ? "Empieza gratis" : `Elige ${p.nombre}`;
            if (loggedIn && me?.plan === p.id) return <span className={cls + " cursor-default opacity-70"}>Tu plan actual</span>;
            if (!gratis && payReady && loggedIn) {
              if (me?.stripeSubscriptionId) return <Link href="/app/perfil" data-track="manage_subscription_click" className={cls}>Cambiar desde tu perfil</Link>;
              return <CheckoutButton plan={p.id} priceEur={p.precioEurMes} autoStart={autoPlan === p.id} className={cls}>{label}</CheckoutButton>;
            }
            return (
              <Link href={gratis ? (loggedIn ? "/app" : "/registro") : `/registro?plan=${p.id}`} data-track="pricing_cta_click" data-track-plan={p.id} data-track-price_eur={String(p.precioEurMes)} className={cls}>
                {gratis && loggedIn ? "Ir al panel" : label}
              </Link>
            );
          })();
          const body = (
            <Spotlight className={"flex h-full flex-col overflow-hidden rounded-[27px] p-8 " + (featured ? "bg-[#141852]" : "border border-white/10 bg-white/[0.04] backdrop-blur-sm")}>
              <div className="relative flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-white">{p.nombre}</h3>
                {featured && <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white">Todas las funciones</span>}
              </div>
              <p className="relative mt-1 min-h-10 text-sm text-white/60">{p.descripcion}</p>
              <p className="relative mt-6 flex items-baseline gap-1 text-6xl font-extrabold tracking-[-0.04em] tabular-nums text-white">
                {p.precioEurMes} €<span className="text-sm font-medium tracking-normal text-white/45">/mes</span>
              </p>
              <div className="relative mt-6">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-bold text-white">{credits.toLocaleString("es-ES", { useGrouping: true })} créditos al mes</span>
                  <span className="text-white/40">IVA incluido</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-200" style={{ width: `${Math.max(6, (credits / maxCredits) * 100)}%` }} /></div>
              </div>
              <ul className="relative mt-7 flex-1 space-y-3 text-sm text-white/80">
                {features.map((t) => (
                  <li key={t} className="flex gap-3"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/30"><Check className="h-2.5 w-2.5 text-brand-200" aria-hidden="true" /></span><span>{t}</span></li>
                ))}
              </ul>
              <div className="relative">
                {cta}
                {!gratis && !payReady && <p className="mt-2 text-center text-xs text-white/45">Pago disponible próximamente. Empiezas en Gratis.</p>}
                {!gratis && payReady && !loggedIn && <p className="mt-2 text-center text-xs text-white/45">Crea tu cuenta gratis y pasa de plan cuando quieras.</p>}
              </div>
            </Spotlight>
          );
          return featured ? (
            <div key={p.id} className="mk-ring-glow rounded-[28px] bg-gradient-to-b from-brand-200 via-brand to-brand/10 p-px transition-transform duration-300 hover:-translate-y-1 lg:scale-[1.03]">{body}</div>
          ) : (
            <div key={p.id} className="rounded-[28px] transition-transform duration-300 hover:-translate-y-1">{body}</div>
          );
        })}
      </div>
    );
  }

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
                `${(p.creditosMes ?? 0).toLocaleString("es-ES")} créditos al mes para consultas de pago`,
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
