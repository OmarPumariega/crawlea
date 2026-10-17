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
export type ModuleTab = { href: string; label: string; hint?: string };

// Barra de pestañas a ancho completo sobre una tarjeta blanca (bg-surface) que
// la separa del fondo gris de la herramienta, con la pestaña activa como píldora índigo clara (esquinas redondeadas completas, sin subrayados que se corten): es la
// forma más reconocible de "aquí hay más secciones" y no se confunde con un
// filtro. Antes era un control segmentado gris y pequeño que pasaba
// desapercibido a quien llegaba por primera vez.
// `tabs` es opcional: un módulo sin pestañas pasa `title` (+ `hint`) y la barra
// muestra ese nombre como única "pestaña" fija, para que todos los módulos
// tengan la misma barra superior. A la derecha queda el hueco del historial
// (id="module-history-slot"): cada vista monta ahí su <HistoryDropdown>.
export default function ModuleTabs({ tabs, title, hint }: { tabs?: ModuleTab[]; title?: string; hint?: string }) {
  const pathname = usePathname();
  const pill = "flex flex-col rounded-xl px-5 py-2.5 transition-colors";
  return (
    <nav aria-label="Secciones del módulo" className="flex flex-wrap items-stretch gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card">
      {tabs
        ? tabs.map((t) => {
            // Coincidencia exacta: las pestañas no tienen sub-rutas y la raíz del
            // módulo (p. ej. /keywords) no debe quedar activa en /keywords/arquitectura.
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(pill, active ? "bg-brand-50 text-brand" : "text-ink-soft hover:bg-surface-muted hover:text-ink")}
              >
                <span className="text-[15px] font-semibold leading-tight whitespace-nowrap">{t.label}</span>
                {t.hint && <span className={cn("mt-0.5 text-xs font-normal leading-tight", active ? "text-brand/70" : "text-ink-faint")}>{t.hint}</span>}
              </Link>
            );
          })
        : title && (
            <div className={cn(pill, "bg-brand-50 text-brand")}>
              <span className="text-[15px] font-semibold leading-tight whitespace-nowrap">{title}</span>
              {hint && <span className="mt-0.5 text-xs font-normal leading-tight text-brand/70">{hint}</span>}
            </div>
          )}
      <div id="module-history-slot" className="ml-auto flex items-center self-center pr-1" />
    </nav>
  );
}
