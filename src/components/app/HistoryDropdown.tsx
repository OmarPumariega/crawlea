"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";

// Historial de un módulo en la barra superior (a la derecha de las pestañas),
// en vez de una columna lateral que dejaba un hueco en el margen. Se monta por
// portal en el hueco que deja ModuleTabs (#module-history-slot), así el
// contenido de cada módulo ocupa todo el ancho. `children` recibe `close` para
// cerrar el desplegable al elegir un elemento (los módulos con acciones
// internas, como comparar, pueden dejarlo abierto).
export default function HistoryDropdown({
  count,
  title = "Historial",
  loading = false,
  children,
}: {
  count: number;
  title?: string;
  loading?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlot(document.getElementById("module-history-slot"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!slot) return null;
  return createPortal(
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
          open ? "border-brand bg-brand-50 text-brand" : "border-line text-ink-soft hover:bg-surface-muted hover:text-ink"
        )}
      >
        <History className="h-4 w-4" />
        {title}
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold tabular-nums text-ink-soft">{loading ? "…" : count}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-[70vh] w-[min(32rem,90vw)] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-[0_12px_40px_-12px_rgba(17,20,43,0.25)]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>,
    slot
  );
}
