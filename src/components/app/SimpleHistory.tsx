"use client";

import { useEffect, useState } from "react";
import HistoryDropdown from "@/components/app/HistoryDropdown";
import Pill from "@/components/app/Pill";

export type HistoryEntry = {
  id: string;
  title: string; // qué se midió (dominio, URL...)
  subtitle?: string | null;
  date: string;
  pills?: { text: string; tone?: "brand" | "neutral" | "danger" }[];
  lines?: string[]; // detalle: una línea por dato
};

// Historial genérico de un módulo: pide la lista a `url` ({ items: HistoryEntry[] }) y la muestra en el
// desplegable de la barra superior. Se vuelve a pedir cuando cambia `refreshKey`.
export default function SimpleHistory({
  url,
  empty,
  refreshKey = null,
}: {
  url: string;
  empty: string;
  refreshKey?: unknown; // cuando cambia (p. ej. el objeto de datos de la vista), se vuelve a pedir
}) {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d: { items?: HistoryEntry[] }) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url, refreshKey]);

  return (
    <HistoryDropdown count={items.length} loading={loading}>
      {() =>
        items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-ink-soft">{empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="py-2">
                <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{it.title}</p>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {new Date(it.date).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {it.subtitle && <p className="text-xs text-ink-faint">{it.subtitle}</p>}
                  {it.pills && it.pills.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {it.pills.map((p, i) => (
                        <Pill key={i} tone={p.tone ?? "neutral"}>{p.text}</Pill>
                      ))}
                    </div>
                  )}
                </button>
                {open === it.id && it.lines && it.lines.length > 0 && (
                  <ul className="mt-2 space-y-0.5 rounded-xl bg-surface-muted/60 p-3 text-xs text-ink-soft">
                    {it.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      }
    </HistoryDropdown>
  );
}
