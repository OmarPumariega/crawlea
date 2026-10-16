"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Pestañas de nivel de módulo basadas en ruta (no en estado local), para los
// módulos que absorben sub-herramientas (Keywords+Arquitectura,
// Contenido+TF-IDF, Auditoría+Enlaces+Canibalizaciones). Cada pestaña es una
// ruta real: los deep-links (?estudio=, ?keyword=), los bookmarks y el
// switchProject del sidebar siguen funcionando sin estado extra. Control
// segmentado: pista gris y pestaña activa como píldora blanca elevada.
export type ModuleTab = { href: string; label: string };

export default function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();
  return (
    <div className="inline-flex items-center gap-1 bg-black/[0.05] rounded-xl p-1">
      {tabs.map((t) => {
        // Coincidencia exacta: las pestañas no tienen sub-rutas y la raíz del
        // módulo (p. ej. /keywords) no debe quedar activa en /keywords/arquitectura.
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3.5 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
              active
                ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]"
                : "text-ink-soft hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
