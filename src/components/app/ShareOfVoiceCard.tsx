"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Section from "@/components/ui/Section";

type Row = { domain: string; isOwn: boolean; pctTop3: number; pctTop10: number; keywordsTop10: number; avgPosition: number | null };
type Data = { rows: Row[]; totalVolume: number; keywordsCounted: number; keywordsTracked: number };

// Cuota de visibilidad frente a competidores: % del volumen de búsqueda que
// sigues con el que cada dominio está en el top 10 de Google.
export default function ShareOfVoiceCard({ projectId, group }: { projectId: string; group?: string }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    setData(null);
    fetch(`/api/proyectos/${projectId}/rank/cuota${group ? `?group=${encodeURIComponent(group)}` : ""}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ rows: [], totalVolume: 0, keywordsCounted: 0, keywordsTracked: 0 }));
  }, [projectId, group]);

  if (!data) {
    return (
      <Section title="Cuota de visibilidad"><div className="flex h-16 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-ink-faint" /></div></Section>
    );
  }
  if (data.rows.length === 0 || data.rows.length === 1 && data.rows[0].isOwn && data.keywordsCounted === 0) return null;
  const hasCompetitors = data.rows.some((r) => !r.isOwn);

  return (
    <Section
      title="Cuota de visibilidad"
      description={`De las búsquedas que sigues (${data.totalVolume.toLocaleString("es-ES")} al mes en total), qué parte tiene cada web en el top 10 de Google.`}
    >
      <ul className="space-y-3">
        {data.rows.slice(0, 8).map((r) => (
          <li key={r.domain}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className={cn("truncate", r.isOwn ? "font-semibold text-ink" : "text-ink-soft")}>
                {r.domain}
                {r.isOwn && <span className="ml-1.5 text-[11px] font-semibold text-brand">tú</span>}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                top 3: {r.pctTop3.toFixed(0)} % · <span className="font-semibold text-ink">top 10: {r.pctTop10.toFixed(0)} %</span>
                {r.avgPosition != null && <> · media #{r.avgPosition.toFixed(1).replace(".", ",")}</>}
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-brand-50">
              <div className={cn("absolute inset-y-0 left-0 rounded-full", r.isOwn ? "bg-brand-500" : "bg-brand-200")} style={{ width: `${Math.max(1, r.pctTop10)}%` }} />
              <div className={cn("absolute inset-y-0 left-0 rounded-full", r.isOwn ? "bg-brand-700" : "bg-brand-400")} style={{ width: `${Math.max(0.5, r.pctTop3)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-faint">
        Calculado con la posición real del último chequeo de {data.keywordsCounted} de tus {data.keywordsTracked} keywords (las que tienen volumen conocido).
        {!hasCompetitors && " Añade competidores en el módulo Competidores para compararte con ellos."}
      </p>
    </Section>
  );
}
