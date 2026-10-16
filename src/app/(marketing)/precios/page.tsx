import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Precios · Crawlea",
  description: "Empieza gratis y sube de plan cuando lo necesites. Precios claros, sin letra pequeña.",
  alternates: { canonical: "/precios" },
};

const FAQ = [
  { q: "¿Necesito tarjeta para empezar?", a: "No. El plan Gratis no pide ningún dato de pago." },
  { q: "¿De dónde salen los datos?", a: "De Search Console, Analytics, PageSpeed, los resultados de Google y el rastreo de tu web. Los volúmenes de búsqueda son estimaciones y los marcamos como tales." },
  { q: "¿Prometéis posiciones?", a: "No. Te mostramos qué ocurre en tu web y qué mejorar primero. Los resultados dependen de Google y de tu trabajo." },
];

// Renderiza desde plans.ts: misma fuente de verdad que el backend.
export default function PreciosPage() {
  const plans = Object.values(PLANS);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-ink">Precios claros</h1>
        <p className="mt-3 text-lg text-ink-soft">Empieza gratis y sube de plan cuando lo necesites.</p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const destacado = p.id === "pro";
          const gratis = p.precioEurMes === 0;
          return (
            <section
              key={p.id}
              className={
                "flex flex-col rounded-[20px] border p-6 " +
                (destacado ? "border-brand bg-surface shadow-[0_10px_30px_-14px_rgba(79,92,245,0.45)]" : "border-line bg-surface")
              }
            >
              <h2 className="text-lg font-bold text-ink">{p.nombre}</h2>
              <p className="mt-1 min-h-10 text-sm text-ink-soft">{p.descripcion}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-[-0.03em] text-ink tabular-nums">{p.precioEurMes} €</span>
                <span className="text-sm text-ink-faint">/mes</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-soft">
                <Item>{p.maxProyectos === null ? "Proyectos sin límite" : `${p.maxProyectos} ${p.maxProyectos === 1 ? "proyecto" : "proyectos"}`}</Item>
                <Item>{p.modulos.length >= 14 ? "Todas las funciones" : `${p.modulos.length} funciones`}</Item>
                <Item>Consultas de pago con límite mensual (posiciones, palabras clave, backlinks)</Item>
                <Item>Conexión con Search Console y Analytics</Item>
              </ul>
              <Link
                href="/registro"
                className={
                  "mt-6 rounded-full px-5 py-3 text-center text-sm font-semibold " +
                  (destacado ? "bg-brand text-white hover:bg-brand-strong" : "border border-line bg-surface text-ink hover:bg-surface-muted")
                }
              >
                {gratis ? "Empieza gratis" : `Elige ${p.nombre}`}
              </Link>
              {!gratis && (
                <p className="mt-2 text-center text-xs text-ink-faint">Pago disponible próximamente. Empiezas en Gratis.</p>
              )}
            </section>
          );
        })}
      </div>

      <section className="mx-auto mt-20 max-w-2xl">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-ink">Preguntas frecuentes</h2>
        <dl className="mt-6 space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-bold text-ink">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-soft">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
