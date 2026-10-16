import type { ReactNode } from "react";

// Cabecera v3 de página: título grande ybold + subtítulo en gris suave, sin
// adornos técnicos (nada de mono/uppercase). El "eyebrow" que las vistas ya
// pasan se renderiza como ruta discreta (Proyecto · Módulo). Las acciones
// van a la derecha en escritorio.
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[13px] font-medium text-ink-faint">{eyebrow}</p>
        )}
        <h1 className="text-[28px] leading-tight font-bold tracking-tight text-ink mt-0.5">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
