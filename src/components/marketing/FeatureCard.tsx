"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/track";

// Tarjeta alta del carrusel: etiqueta, título y botón «+». Al pulsarlo el
// título se sustituye, en el hueco de arriba, por la descripción del módulo
// (texto, tres puntos y enlace a /funciones); el «+» pasa a «×» y vuelve.
export default function FeatureCard({
  id,
  kicker,
  title,
  text,
  points,
  paid,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  text: string;
  points: string[];
  paid?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="relative flex h-[560px] w-[84vw] shrink-0 snap-start flex-col overflow-hidden rounded-[22px] bg-[#0E1033] p-7 text-white sm:w-[400px] lg:w-[416px]">
      <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: "radial-gradient(ellipse 70% 50% at 100% 100%, rgba(79,92,245,0.5), transparent 70%)" }} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <p className="pt-1 text-xs font-bold uppercase tracking-[0.12em]">{kicker}{paid && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 align-middle text-[10px] normal-case tracking-normal">De pago</span>}</p>
        <button
          type="button"
          onClick={() => {
            track("feature_card_toggle", { feature: id, open: !open });
            setOpen((o) => !o);
          }}
          aria-expanded={open}
          aria-controls={`feat-${id}`}
          aria-label={open ? `Cerrar la descripción de ${kicker}` : `Qué hace ${kicker}`}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
            open ? "border-white bg-white text-[#0E1033]" : "border-white/40 text-white hover:bg-white hover:text-[#0E1033]"
          )}
        >
          <Plus className={cn("h-5 w-5 transition-transform duration-300", open && "rotate-45")} />
        </button>
      </div>

      {/* Zona de texto: o el título, o la descripción. Ocupa el hueco entre la
          cabecera y la maqueta (min-h-0), así que nunca se pisan. */}
      <div id={`feat-${id}`} className="relative z-10 mt-3 min-h-0 flex-1">
        <h3 className={cn("max-w-[260px] text-[26px] font-bold leading-[1.15] tracking-[-0.02em] transition-all duration-300", open ? "pointer-events-none absolute opacity-0 -translate-y-2" : "opacity-100")}>
          {title}
        </h3>
        <div className={cn("transition-all duration-300", open ? "opacity-100" : "pointer-events-none absolute inset-x-0 top-0 translate-y-2 opacity-0")} aria-hidden={!open}>
          <p className="text-[14px] leading-relaxed text-white/85">{text}</p>
          <ul className="mt-3 space-y-1.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[13px] leading-snug text-white/70">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" aria-hidden="true" />{p}
              </li>
            ))}
          </ul>
          <Link href={`/funciones#${id}`} data-track="feature_see_more_click" data-track-feature={id} tabIndex={open ? 0 : -1} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-200 hover:text-white">
            Ver más <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Al abrir la descripción, la maqueta se recorta por abajo (con desvanecido)
          para dejar sitio al texto sin que se pisen. */}
      <div className="relative z-10 mt-3 rounded-[22px] border border-white/10 bg-white/5 p-2.5 backdrop-blur-sm">
        <div
          className={cn("overflow-hidden rounded-[14px] bg-surface p-4 text-ink shadow-[0_10px_30px_-18px_rgba(17,20,43,0.4)] transition-[max-height] duration-500", open ? "max-h-[120px]" : "max-h-[340px]")}
          style={open ? { maskImage: "linear-gradient(to bottom, #000 55%, transparent)" } : undefined}
        >
          {children}
        </div>
      </div>
    </article>
  );
}
