"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Layers } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";
import { fmtCredits } from "@/lib/credits";

type StudyListItem = { id: string; name: string; _count: { keywords: number } };
type Cluster = { head: string; headVolume: number | null; totalVolume: number; members: { keyword: string; volume: number | null; shared: number }[] };
type Payload = {
  clusters: Cluster[];
  analyzed: number;
  missing: number;
  missingCostUsd: number;
  maxPerRequest: number;
  fetched?: number;
  stopped?: string | null;
  errors?: string[];
  error?: string;
};

const num = (v: number | null) => (v == null ? "—" : v.toLocaleString("es-ES"));

export default function ClustersView({ projectId }: { projectId: string }) {
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [studyId, setStudyId] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const deepLink = useSearchParams().get("estudio");

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/keywords/estudios`)
      .then((r) => r.json())
      .then((list: StudyListItem[]) => {
        if (!Array.isArray(list)) return;
        setStudies(list);
        const pick = list.find((s) => s.id === deepLink) ?? list.find((s) => s._count.keywords > 0);
        if (pick) setStudyId(pick.id);
      });
  }, [projectId, deepLink]);

  useEffect(() => {
    if (!studyId) return;
    setLoading(true);
    fetch(`/api/proyectos/${projectId}/keywords/estudios/${studyId}/clusters`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [projectId, studyId]);

  async function fetchMissing() {
    setFetching(true);
    const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/${studyId}/clusters`, { method: "POST" });
    setData(await res.json());
    setFetching(false);
  }

  const multi = data?.clusters.filter((c) => c.members.length > 1) ?? [];
  const single = data?.clusters.filter((c) => c.members.length === 1) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Keywords · Clusters"
        title="Clusters de keywords"
        description="Agrupa las búsquedas que Google responde con las mismas páginas: cada grupo se puede cubrir con una sola página."
        actions={
          <select value={studyId} onChange={(e) => setStudyId(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
            {studies.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s._count.keywords})</option>
            ))}
          </select>
        }
      />
      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-ink-faint" /></div>
      ) : data?.error ? (
        <p className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert-ink">{data.error}</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Grupos con varias keywords" value={multi.length} hint="una página para cada uno" highlight />
            <StatTile label="Keywords analizadas" value={data.analyzed} hint="con su top-10 de Google" />
            <StatTile label="Sin analizar" value={data.missing} hint={data.missing > 0 ? "les falta el top-10" : "todas analizadas"} />
          </div>

          {data.missing > 0 && (
            <Section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  {data.missing} keywords todavía no tienen su top-10 de Google guardado. Traerlo cuesta {fmtCredits(data.missingCostUsd)} por tanda de hasta {data.maxPerRequest} keywords.
                </p>
                <button onClick={fetchMissing} disabled={fetching} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
                  {fetching && <Loader2 className="h-4 w-4 animate-spin" />}
                  Analizar {Math.min(data.missing, data.maxPerRequest)} ({fmtCredits(data.missingCostUsd)})
                </button>
              </div>
              {data.stopped && <p className="mt-2 text-xs text-alert-ink">{data.stopped}</p>}
              {data.errors && data.errors.length > 0 && <p className="mt-2 text-xs text-alert-ink">{data.errors.join(" · ")}</p>}
            </Section>
          )}

          {data.analyzed === 0 ? (
            <Section><p className="text-sm text-ink-soft">Aún no hay ninguna keyword analizada. Pulsa el botón de arriba para traer su top-10.</p></Section>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {multi.map((c) => (
                  <Section
                    key={c.head}
                    title={<span className="inline-flex items-center gap-2"><Layers className="h-4 w-4 text-brand" />{c.head}</span>}
                    description={`${c.members.length} keywords · ${num(c.totalVolume)} búsquedas/mes en total`}
                  >
                    <ul className="divide-y divide-line text-sm">
                      {c.members.map((m, i) => (
                        <li key={m.keyword} className="flex items-center justify-between gap-3 py-1.5">
                          <span className={i === 0 ? "font-semibold text-ink" : "text-ink-soft"}>{m.keyword}{i === 0 && <span className="ml-1.5 text-[11px] font-medium text-brand">principal</span>}</span>
                          <span className="shrink-0 text-xs tabular-nums text-ink-faint">{num(m.volume)} · {i === 0 ? "—" : `${m.shared} URLs en común`}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                ))}
              </div>
              {single.length > 0 && (
                <Section title="Keywords con página propia" description="Su top-10 no coincide con el de ninguna otra: cada una pide su propio contenido." flush>
                  <table className="data-table data-table-compact w-full">
                    <thead><tr><th>Keyword</th><th className="num">Volumen</th></tr></thead>
                    <tbody>{single.map((c) => (<tr key={c.head}><td className="font-medium">{c.head}</td><td className="num tabular-nums text-ink-soft">{num(c.headVolume)}</td></tr>))}</tbody>
                  </table>
                </Section>
              )}
            </>
          )}
          <p className="text-xs text-ink-faint">Criterio: dos keywords van juntas si su top-10 comparte al menos 3 páginas. Se usa el SERP de escritorio en la ubicación del estudio.</p>
        </>
      ) : null}
    </div>
  );
}
