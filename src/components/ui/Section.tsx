import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Bloque base de toda pantalla de módulo. Una sola cabecera (título, ayuda
// opcional y acciones a la derecha) y un cuerpo con aire, para que todas las
// secciones se lean igual y lo importante (el dato) mande sobre el marco.
export default function Section({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  // Sin relleno interior (tablas a sangre: la tabla llega a los bordes de la tarjeta).
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[20px] border border-line bg-surface shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(flush ? "mt-4" : "px-6 pb-6 pt-4", !title && !actions && !flush && "pt-6")}>{children}</div>
    </section>
  );
}
