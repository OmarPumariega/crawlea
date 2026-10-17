"use client";

import { useEffect, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";
import { ISSUE_META } from "@/lib/audit/issue-meta";
import type { AuditDiff } from "@/lib/audit/diff";

type Side = { completedAt: string | null; score: number | null; pages: number; truncated: boolean };
type Payload = { needsTwo?: true; runs?: number; error?: string; cur?: Side; prev?: Side; diff?: AuditDiff };

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function CambiosView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/auditoria/cambios`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "Error al cargar la comparación");
        return body as Payload;
      })
      .then(setData)
      .catch((e) => setData({ error: e.message }))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Auditoría · Cambios"
        title="Qué ha cambiado"
        description="Comparación entre tus dos últimas auditorías: lo que has arreglado y lo que ha aparecido nuevo."
      />
      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-ink-faint" /></div>
      ) : data?.error ? (
        <p className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert-ink">{data.error}</p>
      ) : data?.needsTwo ? (
        <Section>
          <p className="text-sm text-ink-soft">
            Hacen falta al menos dos auditorías completadas para comparar{data.runs === 1 ? " (hay una)" : ""}. Lanza otra desde la pestaña Auditoría cuando hayas hecho cambios.
          </p>
        </Section>
      ) : data?.cur && data.prev && data.diff ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Puntuación"
              value={`${data.cur.score ?? "—"}/100`}
              hint={data.prev.score != null && data.cur.score != null ? `${data.cur.score - data.prev.score >= 0 ? "+" : ""}${data.cur.score - data.prev.score} frente a ${data.prev.score}` : undefined}
              highlight
            />
            <StatTile label="Incidencias arregladas" value={data.diff.totalFixed} hint="en páginas que siguen existiendo" />
            <StatTile label="Incidencias nuevas" value={data.diff.totalAppeared} hint="incluye páginas nuevas" />
            <StatTile label="Páginas" value={`${data.diff.newPages} nuevas · ${data.diff.removedPages} menos`} hint={`${data.prev.pages} → ${data.cur.pages} rastreadas`} />
          </div>

          <Section title="Cambios por tipo de incidencia" description={`Auditoría del ${date(data.prev.completedAt)} frente a la del ${date(data.cur.completedAt)}. Arriba, lo que más empeora.`} flush>
            {data.diff.changes.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-ink-soft">No hay diferencias entre las dos auditorías.</p>
            ) : (
              <table className="data-table data-table-compact w-full">
                <thead>
                  <tr>
                    <th>Incidencia</th>
                    <th className="num">Antes</th>
                    <th className="num">Ahora</th>
                    <th className="num">Arregladas</th>
                    <th className="num">Nuevas</th>
                    <th>Ejemplos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.diff.changes.map((c) => {
                    const worse = c.cur > c.prev;
                    return (
                      <tr key={c.issue} className="align-top">
                        <td className="font-medium text-ink">{ISSUE_META[c.issue]?.label ?? c.issue}</td>
                        <td className="num tabular-nums text-ink-soft">{c.prev}</td>
                        <td className={cn("num tabular-nums font-semibold", worse ? "text-alert-ink" : "text-ink")}>{c.cur}</td>
                        <td className="num tabular-nums text-ink-soft">{c.fixed}</td>
                        <td className={cn("num tabular-nums", c.appeared > 0 ? "text-alert-ink" : "text-ink-soft")}>{c.appeared}</td>
                        <td className="max-w-[320px] text-xs text-ink-faint">
                          {[...c.appearedSample.map((u) => ({ u, nuevo: true })), ...c.fixedSample.slice(0, 2).map((u) => ({ u, nuevo: false }))].slice(0, 4).map(({ u, nuevo }) => (
                            <a key={u + nuevo} href={u} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate hover:text-ink">
                              <span className={cn("shrink-0 rounded px-1 text-[10px] font-semibold", nuevo ? "bg-alert-tint text-alert-ink" : "bg-accent-tint text-accent-ink")}>{nuevo ? "nueva" : "arreglada"}</span>
                              <span className="truncate">{u.replace(/^https?:\/\/(www\.)?/, "")}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
          {(data.cur.truncated || data.prev.truncated) && (
            <p className="text-xs text-ink-faint">Alguna de las dos auditorías alcanzó el máximo de páginas, así que las diferencias pueden incluir páginas que solo se rastrearon en una.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
