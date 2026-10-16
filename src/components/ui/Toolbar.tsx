import type { ReactNode } from "react";

// Barra de ajustes compacta: sustituye a las tarjetas enteras que solo
// contenían un selector o un aviso. Filtros a la izquierda, información o
// acciones a la derecha, todo en una línea.
export default function Toolbar({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[20px] border border-line bg-surface px-5 py-3 shadow-card">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {aside && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">{aside}</div>}
    </div>
  );
}
