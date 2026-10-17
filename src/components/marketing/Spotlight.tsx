"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

// Contenedor con un foco de luz que sigue al cursor (solo en dispositivos con ratón).
export default function Spotlight({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      <div className="mk-spot pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden="true" />
      {children}
    </div>
  );
}
