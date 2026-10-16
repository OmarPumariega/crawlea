"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { track as trackEvent } from "@/lib/analytics/track";

// Carrusel horizontal de tarjetas de funciones. Arranca alineado con el
// contenedor de la página y sale por el borde derecho de la pantalla; las
// flechas desplazan una tarjeta y se desactivan en los extremos.
export default function FeatureCarousel({ children, title, count }: { children: React.ReactNode; title: React.ReactNode; count: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  // Arrastre con ratón (en táctil ya funciona el desplazamiento nativo). Durante
  // el arrastre se quita el imán (snap) para que siga al cursor y, al soltar,
  // se restaura para que la tarjeta más cercana se alinee. Si el cursor se
  // movió más de 5 px, se cancela el clic para no abrir el enlace «+» por error.
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !track.current) return;
    drag.current = { active: true, startX: e.clientX, startLeft: track.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active || !track.current) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 5) {
      // Solo ahora es un arrastre: se captura el puntero. Capturarlo en el
      // pointerdown hacía que el clic de los botones de las tarjetas se perdiera.
      d.moved = true;
      setDragging(true);
      track.current.setPointerCapture(e.pointerId);
    }
    if (d.moved) track.current.scrollLeft = d.startLeft - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    if (drag.current.moved) trackEvent("carousel_nav", { carousel: "funciones", method: "drag" });
    drag.current.active = false;
    setDragging(false);
    if (track.current?.hasPointerCapture(e.pointerId)) track.current.releasePointerCapture(e.pointerId);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  const go = (dir: 1 | -1) => {
    trackEvent("carousel_nav", { carousel: "funciones", direction: dir === 1 ? "next" : "prev", method: "arrow" });
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("article");
    const step = (card?.getBoundingClientRect().width ?? 400) + 16;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const btn = "flex h-12 w-12 items-center justify-center rounded-full border border-ink/25 text-ink transition-colors hover:bg-ink hover:text-background disabled:pointer-events-none disabled:opacity-30";

  return (
    <div>
      <div className="mx-auto flex max-w-[1360px] items-end justify-between gap-6 px-5 sm:px-8 lg:px-10">
        <div>
          <p className="text-sm font-bold tracking-wide text-ink">Funciones <span className="text-ink-faint">({count})</span></p>
          <h2 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-ink sm:text-6xl">{title}</h2>
        </div>
        <div className="hidden gap-3 sm:flex">
          <button type="button" onClick={() => go(-1)} disabled={edge.start} aria-label="Funciones anteriores" className={btn}><ArrowLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} disabled={edge.end} aria-label="Funciones siguientes" className={btn}><ArrowRight className="h-5 w-5" /></button>
        </div>
      </div>

      <div
        ref={track}
        onScroll={update}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className={cn(
          "mk-no-scrollbar mt-12 flex gap-4 overflow-x-auto pb-4",
          dragging ? "cursor-grabbing select-none snap-none" : "cursor-grab snap-x snap-mandatory"
        )}
        style={{ paddingLeft: "max(1.25rem, calc((100vw - 1360px) / 2 + 2.5rem))", paddingRight: "2.5rem", scrollPaddingLeft: "max(1.25rem, calc((100vw - 1360px) / 2 + 2.5rem))" }}
      >
        {children}
      </div>
    </div>
  );
}
