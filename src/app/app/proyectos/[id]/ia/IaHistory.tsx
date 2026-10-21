"use client";

import { useEffect, useState } from "react";
import HistoryDropdown from "@/components/app/HistoryDropdown";
import Pill from "@/components/app/Pill";

type Source = { domain: string; url: string; title?: string | null };
type Item = {
  id: string;
  kind: "overview" | "chatgpt" | "perplexity";
  title: string;
  detail: string | null;
  outcome: "citado" | "no_citado" | "sin_overview" | "mencionado" | "no_aparece";
  citedRank: number | null;
  text: string | null;
  sources: Source[] | null;
  fanOutQueries: string[] | null;
  checkedAt: string;
};

const KIND_LABEL: Record<Item["kind"], string> = { overview: "AI Overview", chatgpt: "ChatGPT", perplexity: "Perplexity" };
const OUTCOME_LABEL: Record<Item["outcome"], string> = {
  citado: "Te cita",
  no_citado: "Hay AI Overview, no te cita",
  sin_overview: "Sin AI Overview",
  mencionado: "Te menciona",
  no_aparece: "No aparece",
};

// Historial de todo lo que se ha comprobado en el módulo (cada medición de AI Overview y cada pregunta a
// ChatGPT/Perplexity), con su resultado y fecha. Se vuelve a pedir cuando cambia `refreshKey`.
export default function IaHistory({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proyectos/${projectId}/ia/historial`)
      .then((r) => r.json())
      .then((d: { items?: Item[] }) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  return (
    <HistoryDropdown count={items.length} loading={loading}>
      {() =>
        items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-ink-soft">Aún no se ha comprobado nada. Cada comprobación quedará aquí.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="py-2">
                <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <Pill tone="neutral">{KIND_LABEL[it.kind]}</Pill>
                    <Pill tone={it.outcome === "citado" ? "brand" : "neutral"}>
                      {OUTCOME_LABEL[it.outcome]}
                      {it.outcome === "citado" && it.citedRank ? ` · #${it.citedRank}` : ""}
                    </Pill>
                    <span className="ml-auto shrink-0 text-xs text-ink-faint">
                      {new Date(it.checkedAt).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-ink">{it.title}</p>
                  {it.detail && <p className="text-xs text-ink-faint">{it.detail}</p>}
                </button>
                {open === it.id && (
                  <div className="mt-2 space-y-2 rounded-xl bg-surface-muted/60 p-3 text-xs text-ink-soft">
                    {it.text ? <p className="max-h-40 overflow-y-auto whitespace-pre-line">{it.text}</p> : <p>Sin texto guardado.</p>}
                    {it.fanOutQueries && it.fanOutQueries.length > 0 && (
                      <p>
                        <span className="font-semibold">Lo que buscó la IA: </span>
                        {it.fanOutQueries.join(" · ")}
                      </p>
                    )}
                    {it.sources && it.sources.length > 0 && (
                      <ul className="space-y-0.5">
                        {it.sources.slice(0, 8).map((s) => (
                          <li key={s.url} className="truncate">
                            <span className="font-medium">{s.domain}</span>{" "}
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                              {s.title ?? s.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      }
    </HistoryDropdown>
  );
}
