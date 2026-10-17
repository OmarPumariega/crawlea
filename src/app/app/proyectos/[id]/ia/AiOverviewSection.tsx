"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, Quote, Eye, Search } from "lucide-react";
import Pill from "@/components/app/Pill";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";
import { BarList, RadialGauge } from "@/components/ui/charts";
import { fmtCredits } from "@/lib/credits";
import { cn } from "@/lib/utils";

type Ref = { domain: string; url: string; title: string | null; source: string | null };
type Check = { hasOverview: boolean; cited: boolean; citedRank: number | null; references: Ref[]; excerpt: string | null; checkedAt: string };
type Row = { id: string; keyword: string; device: string; locationName: string | null; lastPosition: number | null; check: Check | null };
type Data = { domain: string | null; competitors: string[]; estCostUsd: number; keywords: Row[] };

const BATCH = 25;

export default function AiOverviewSection({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null); // "all" | "pending" | id
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${projectId}/ia/overview`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo cargar");
      setData(body as Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const rows = data?.keywords ?? [];
    const checked = rows.filter((r) => r.check);
    const withAio = checked.filter((r) => r.check!.hasOverview);
    const cited = withAio.filter((r) => r.check!.cited);
    const domains = new Map<string, number>();
    for (const r of withAio) for (const d of new Set(r.check!.references.map((x) => x.domain))) domains.set(d, (domains.get(d) ?? 0) + 1);
    return {
      total: rows.length,
      checked: checked.length,
      withAio: withAio.length,
      cited: cited.length,
      ranking: [...domains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [data]);

  async function check(ids: string[], key: string) {
    if (ids.length === 0) return;
    setChecking(key);
    setNotice(null);
    let done = 0;
    let stopped: string | null = null;
    const errors = new Set<string>();
    try {
      for (let i = 0; i < ids.length && !stopped; i += BATCH) {
        const res = await fetch(`/api/proyectos/${projectId}/ia/overview/comprobar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rankKeywordIds: ids.slice(i, i + BATCH) }),
        });
        const body = await res.json();
        if (!res.ok) {
          stopped = body.error ?? "No se pudo comprobar";
          break;
        }
        done += body.done ?? 0;
        if (body.stopped) stopped = body.stopped;
        for (const e of body.errors ?? []) errors.add(e);
      }
      await load();
      if (stopped) setNotice({ tone: "danger", text: `${done > 0 ? `Hecho en parte (${done} keywords). ` : ""}${stopped}` });
      else if (errors.size > 0) setNotice({ tone: "danger", text: `${done} keywords comprobadas. ${[...errors].join(" ")}` });
      else setNotice({ tone: "success", text: `${done} keywords comprobadas` });
    } finally {
      setChecking(null);
    }
  }

  if (error) return <p className="text-sm text-alert-ink">{error}</p>;
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const isOwn = (d: string) => !!data.domain && (d === data.domain || d.endsWith(`.${data.domain}`));
  const isComp = (d: string) => data.competitors.some((c) => d === c || d.endsWith(`.${c}`));
  const pendingIds = data.keywords.filter((k) => !k.check).map((k) => k.id);
  const allIds = data.keywords.map((k) => k.id);
  const pct = stats.withAio > 0 ? Math.round((stats.cited / stats.withAio) * 100) : 0;

  if (data.keywords.length === 0) {
    return (
      <Section title="AI Overview de Google por keyword">
        <div className="mx-auto max-w-xl py-4 text-center space-y-3">
          <Search className="mx-auto h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-soft">
            Se mide sobre las keywords que ya sigues en Rank Tracking. Añade alguna y vuelve aquí para ver si Google
            muestra una respuesta con IA y si te cita.
          </p>
          <Link
            href={`/app/proyectos/${projectId}/rank`}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong transition-colors"
          >
            Ir a Rank Tracking
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">AI Overview de Google por keyword</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-soft">
            Para cada keyword que sigues: ¿Google muestra una respuesta con IA? ¿Te cita como fuente? En búsquedas locales
            («… en Oviedo») Google suele mostrar el mapa en vez del AI Overview, y eso también es un dato real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notice && <Pill tone={notice.tone}>{notice.text}</Pill>}
          {pendingIds.length > 0 && pendingIds.length < allIds.length && (
            <button
              type="button"
              disabled={checking !== null}
              onClick={() => check(pendingIds, "pending")}
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-background transition-colors disabled:opacity-50"
            >
              {checking === "pending" && <Loader2 className="h-4 w-4 animate-spin" />}
              Solo las {pendingIds.length} sin comprobar
            </button>
          )}
          <button
            type="button"
            disabled={checking !== null || !data.domain}
            onClick={() => check(allIds, "all")}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong transition-colors disabled:opacity-50"
          >
            {checking === "all" && <Loader2 className="h-4 w-4 animate-spin" />}
            Comprobar {allIds.length} keywords
            <span className="font-normal text-white/70">{fmtCredits(data.estCostUsd * allIds.length)}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          highlight
          label="Keywords con AI Overview"
          value={`${stats.withAio}/${stats.checked}`}
          hint={stats.checked < stats.total ? `${stats.total - stats.checked} sin comprobar todavía` : "Google muestra respuesta con IA"}
          icon={<Quote className="h-4 w-4" />}
        />
        <StatTile
          label="Te citan en"
          value={`${stats.cited}/${stats.withAio}`}
          hint="de las que tienen AI Overview"
          icon={<Eye className="h-4 w-4" />}
        />
        <div className="rounded-[20px] border border-line bg-surface p-5 shadow-card flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-ink-soft">Cuota de citas</p>
            <p className="mt-2 text-xs text-ink-faint">sobre las keywords con AI Overview</p>
          </div>
          <RadialGauge value={pct} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section className="lg:col-span-2" title="Keywords" description="Pulsa una fila para ver las fuentes que cita Google." flush>
          <div className="overflow-hidden">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>AI Overview</th>
                  <th>Te citan</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {data.keywords.map((k) => {
                  const c = k.check;
                  const open = expanded === k.id;
                  return (
                    <Fragment key={k.id}>
                      <tr className={cn(c?.hasOverview && "cursor-pointer")} onClick={() => c?.hasOverview && setExpanded(open ? null : k.id)}>
                        <td className="max-w-[300px]">
                          <span className="flex items-start gap-2">
                            {c?.hasOverview ? (
                              open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <span className="text-ink">
                              {k.keyword}
                              {k.locationName && <span className="block text-xs text-ink-faint">{k.locationName}</span>}
                            </span>
                          </span>
                        </td>
                        <td>
                          {!c ? <span className="text-xs text-ink-faint">Sin comprobar</span> : c.hasOverview ? <Pill tone="brand">Sí</Pill> : <Pill tone="neutral">No lo muestra</Pill>}
                        </td>
                        <td>
                          {!c || !c.hasOverview ? (
                            <span className="text-xs text-ink-faint">—</span>
                          ) : c.cited ? (
                            <Pill tone="brand">Citado{c.citedRank ? ` · #${c.citedRank}` : ""}</Pill>
                          ) : (
                            <Pill tone="neutral">No te cita</Pill>
                          )}
                        </td>
                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={checking !== null || !data.domain}
                            onClick={() => check([k.id], k.id)}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-ink-soft hover:bg-background hover:text-ink disabled:opacity-40"
                          >
                            {checking === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : c ? "Repetir" : "Comprobar"}
                          </button>
                        </td>
                      </tr>
                      {open && c && (
                        <tr>
                          <td colSpan={4} className="bg-surface-muted/40">
                            {c.excerpt && <p className="mb-3 text-xs text-ink-soft">{c.excerpt}{c.excerpt.length >= 600 ? "…" : ""}</p>}
                            <ul className="space-y-1">
                              {c.references.map((r) => (
                                <li key={r.url} className="flex items-center gap-2 text-xs">
                                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-medium", isOwn(r.domain) ? "bg-brand-50 text-brand" : isComp(r.domain) ? "bg-accent-tint text-accent-ink" : "bg-surface-muted text-ink-soft")}>
                                    {isOwn(r.domain) ? "Tú" : isComp(r.domain) ? "Competidor" : r.domain}
                                  </span>
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-ink-soft hover:text-ink">
                                    {r.title ?? r.url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-[11px] text-ink-faint">Comprobado el {new Date(c.checkedAt).toLocaleDateString("es-ES")}</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Quién sale citado" description="Webs que más aparecen como fuente en los AI Overview.">
          {stats.ranking.length === 0 ? (
            <p className="text-sm text-ink-soft">Aún no hay fuentes: comprueba alguna keyword.</p>
          ) : (
            <BarList
              items={stats.ranking.map(([domain, n]) => ({
                label: domain,
                value: n,
                display: `${n}`,
                tag: isOwn(domain) ? "Tú" : isComp(domain) ? "Competidor" : undefined,
              }))}
            />
          )}
        </Section>
      </div>
    </div>
  );
}
