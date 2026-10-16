import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/plans";

// Tarjetas de planes compartidas por la home y /precios: una sola fuente
// (plans.ts) y un solo diseño. Cuando haya precios y límites definitivos se
// cambia aquí y se actualizan las dos páginas.
export default function PricingCards({ className = "" }: { className?: string }) {
  const plans = Object.values(PLANS);
  return (
    <div className={"grid overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_30px_70px_-30px_rgba(17,20,43,0.35)] md:grid-cols-3 " + className}>
      {plans.map((p) => {
        const dark = p.id === "pro";
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
                "Todas las funciones",
                "Consultas de pago con límite mensual (posiciones, palabras clave, backlinks)",
                "Conexión con Search Console y Analytics",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className={"mt-0.5 h-4 w-4 shrink-0 " + (dark ? "text-brand-200" : "text-brand")} aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/registro"
              className={"mt-8 rounded-full px-5 py-3 text-center text-sm font-bold transition-colors " + (dark ? "bg-white text-brand-700 hover:bg-brand-50" : gratis ? "bg-brand text-white hover:bg-brand-strong" : "border border-line text-ink hover:bg-surface-muted")}
            >
              {gratis ? "Empieza gratis" : `Elige ${p.nombre}`}
            </Link>
            {!gratis && <p className={"mt-2 text-center text-xs " + (dark ? "text-white/45" : "text-ink-faint")}>Pago disponible próximamente. Empiezas en Gratis.</p>}
          </section>
        );
      })}
    </div>
  );
}
