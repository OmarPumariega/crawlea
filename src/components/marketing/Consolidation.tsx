"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// «Qué reúne»: las piezas sueltas con las que se trabaja hoy aparecen
// desordenadas y, al entrar en pantalla, se colocan dentro de un solo proyecto.
const ROWS = [
  { old: "Hoja de cálculo de posiciones", now: "Rank tracking", x: "-26px", y: "-10px", r: "-4deg" },
  { old: "Programa de rastreo aparte", now: "Auditoría", x: "30px", y: "12px", r: "3deg" },
  { old: "Otra herramienta para enlaces", now: "Backlinks", x: "-18px", y: "8px", r: "2deg" },
  { old: "Lista de tareas en un bloc", now: "Tareas", x: "34px", y: "-12px", r: "-3deg" },
  { old: "Mapa local hecho a mano", now: "SEO local", x: "-30px", y: "10px", r: "4deg" },
  { old: "Informe montado a mano", now: "Informe", x: "22px", y: "-8px", r: "-2deg" },
];

export default function Consolidation() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("rounded-[28px] border border-line bg-surface-muted p-5 sm:p-8", inView && "cs-in")}>
      <div className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
          <p className="text-sm font-extrabold text-ink">Proyecto · Clínica Ejemplo</p>
          <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-[11px] font-bold text-accent-ink">Todo en un sitio</span>
        </div>
        <ul className="space-y-3">
          {ROWS.map((r, i) => (
            <li key={r.now} className="cs-row flex items-center gap-3" style={{ ["--i" as string]: i, ["--x" as string]: r.x, ["--y" as string]: r.y, ["--r" as string]: r.r }}>
              <span className="cs-old min-w-0 flex-1 truncate rounded-xl border border-dashed border-ink/25 bg-surface-muted px-3.5 py-2.5 text-[13px] text-ink-soft">{r.old}</span>
              <ArrowRight className="cs-arrow h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="cs-new w-[34%] shrink-0 rounded-xl bg-brand px-3 py-2.5 text-center text-[13px] font-bold text-white">{r.now}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
