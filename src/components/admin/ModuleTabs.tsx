"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Pestañas de nivel de módulo basadas en ruta (no en estado local), para los
// módulos que absorben sub-herramientas (Keywords+Arquitectura,
// Contenido+TF-IDF, Auditoría+Enlaces+Canibalizaciones). Cada pestaña es una
// ruta real: los deep-links (?estudio=, ?keyword=), los bookmarks y el
// switchProject del sidebar siguen funcionando sin estado extra. Mismo estilo
// de pestañas subrayadas que las internas de AuditoriaView.
export type ModuleTab = { href: string; label: string };

export default function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 border-b border-gray-100 overflow-x-auto">
      {tabs.map((t) => {
        // Coincidencia exacta: las pestañas no tienen sub-rutas y la raíz del
        // módulo (p.ej. /keywords) no debe quedar activa en /keywords/arquitectura.
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
