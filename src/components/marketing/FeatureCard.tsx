"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Tarjeta alta del carrusel: etiqueta, título y botón «+». Al pulsarlo el
// título se sustituye, en el hueco de arriba, por la descripción del módulo
// (texto, tres puntos y enlace a /funciones); el «+» pasa a «×» y vuelve.
export default function FeatureCard({
  id,
  kicker,
  title,
  text,
  points,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  text: string;
  points: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="mk-hatch relative flex h-[560px] w-[84vw] shrink-0 snap-start flex-col overflow-hidden rounded-[22px] mk-card-tint p-7 sm:w-[400px] lg:w-[416px]">
      <div className="flex items-start justify-between gap-4">
        <p className="pt-1 text-xs font-bold uppercase tracking-[0.12em] text-ink">{kicker}</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`feat-${id}`}
          aria-label={open ? `Cerrar la descripción de ${kicker}` : `Qué hace ${kicker}`}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
            open ? "border-ink bg-ink text-background" : "border-ink/30 text-ink hover:bg-ink hover:text-background"
          )}
        >
          <Plus className={cn("h-5 w-5 transition-transform duration-300", open && "rotate-45")} />
        </button>
      </div>

      {/* Zona de texto: o el título, o la descripción. Misma altura mínima
          para que la maqueta de abajo no se mueva. */}
      <div id={`feat-${id}`} className="relative mt-4 min-h-[210px] flex-1">
        <h3 className={cn("max-w-[260px] text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-ink transition-all duration-300", open ? "pointer-events-none absolute opacity-0 -translate-y-2" : "opacity-100")}>
          {title}
        </h3>
        <div className={cn("transition-all duration-300", open ? "opacity-100" : "pointer-events-none absolute inset-x-0 top-0 translate-y-2 opacity-0")} aria-hidden={!open}>
          <p className="text-[15px] leading-relaxed text-ink">{text}</p>
          <ul className="mt-4 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{p}
              </li>
            ))}
          </ul>
          <Link href={`/funciones#${id}`} tabIndex={open ? 0 : -1} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand">
            Ver más <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="relative z-10 mt-auto rounded-[22px] border border-white/60 bg-white/40 p-2.5 backdrop-blur-sm">
        <div className="overflow-hidden rounded-[14px] bg-surface p-4 text-ink shadow-[0_10px_30px_-18px_rgba(17,20,43,0.4)]">{children}</div>
      </div>
    </article>
  );
}
