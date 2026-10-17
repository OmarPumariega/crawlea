"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, MessageSquareText, Plus, Trash2, ListChecks } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import Modal from "@/components/app/Modal";
import Pill from "@/components/app/Pill";
import Section from "@/components/ui/Section";
import { BarList } from "@/components/ui/charts";
import AiOverviewSection from "./AiOverviewSection";
import { fmtCredits } from "@/lib/credits";
import { cn } from "@/lib/utils";

type Source = { domain: string; url: string; title: string | null };
type Check = {
  id: string;
  platform: "chatgpt" | "perplexity";
  model: string | null;
  cited: boolean;
  mentioned: boolean;
  citedRank: number | null;
  sources: Source[];
  answer: string;
  fanOutQueries?: string[] | null;
  checkedAt: string;
};
type Prompt = { id: string; prompt: string; createdAt: string; checks: Check[] };
type Data = {
  domain: string | null;
  competitors: string[];
  platforms: Record<string, { label: string; estCostUsd: number }>;
  prompts: Prompt[];
};

const BATCH = 10; // la API comprueba como máximo 10 preguntas por llamada

function latest(p: Prompt, platform: string): Check | undefined {
  return p.checks.find((c) => c.platform === platform);
}

function StatusPill({ check }: { check?: Check }) {
  if (!check) return <span className="text-xs text-ink-faint">Sin comprobar</span>;
  if (check.cited) return <Pill tone="brand">Citado{check.citedRank ? ` · #${check.citedRank}` : ""}</Pill>;
  if (check.mentioned) return <Pill tone="neutral">Mencionado</Pill>;
  return <Pill tone="neutral">No aparece</Pill>;
}

export default function IaView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>(["chatgpt", "perplexity"]);
  const [checking, setChecking] = useState<string | null>(null); // "all" | promptId
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${projectId}/ia`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo cargar");
      setData(body as Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const estCost = useMemo(() => {
    if (!data) return 0;
    return platforms.reduce((s, p) => s + (data.platforms[p]?.estCostUsd ?? 0), 0);
  }, [data, platforms]);

  async function addPrompts() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setAdding(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/proyectos/${projectId}/ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: lines }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudieron añadir");
      setText("");
      setAddOpen(false);
      await load();
    } catch (e) {
      setNotice({ tone: "danger", text: e instanceof Error ? e.message : "Error inesperado" });
    } finally {
      setAdding(false);
    }
  }

  async function check(ids: string[], key: string) {
    if (platforms.length === 0) {
      setNotice({ tone: "danger", text: "Elige al menos un asistente" });
      return;
    }
    setChecking(key);
    setNotice(null);
    let done = 0;
    let stopped: string | null = null;
    const errors = new Set<string>();
    try {
      for (let i = 0; i < ids.length && !stopped; i += BATCH) {
        const res = await fetch(`/api/proyectos/${projectId}/ia/comprobar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptIds: ids.slice(i, i + BATCH), platforms }),
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
      if (stopped) setNotice({ tone: "danger", text: `${done > 0 ? `Hecho en parte (${done} consultas). ` : ""}${stopped}` });
      else if (errors.size > 0) setNotice({ tone: "danger", text: `${done} consultas hechas. ${[...errors].join(" ")}` });
      else setNotice({ tone: "success", text: `${done} consultas hechas` });
    } finally {
      setChecking(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("¿Dejar de seguir esta pregunta? Se borra también su historial.")) return;
    await fetch(`/api/proyectos/${projectId}/ia/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }
  if (error || !data) return <p className="text-sm text-alert-ink">{error ?? "No se pudo cargar"}</p>;

  // ── Agregados sobre la última comprobación de cada (pregunta × asistente) ──
  const latestChecks = data.prompts.flatMap((p) =>
    Object.keys(data.platforms).map((pl) => latest(p, pl)).filter((c): c is Check => Boolean(c))
  );

  const domainCount = new Map<string, number>();
  for (const c of latestChecks) {
    for (const d of new Set(c.sources.map((s) => s.domain))) domainCount.set(d, (domainCount.get(d) ?? 0) + 1);
  }
  const ranking = [...domainCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const isOwn = (d: string) => !!data.domain && (d === data.domain || d.endsWith(`.${data.domain}`));
  const isComp = (d: string) => data.competitors.some((c) => d === c || d.endsWith(`.${c}`));

  const checkBar = (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(data.platforms).map(([key, p]) => {
        const on = platforms.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== key) : [...cur, key]))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              on ? "border-brand bg-brand-50 text-brand" : "border-line text-ink-soft hover:bg-background"
            )}
          >
            {p.label}
          </button>
        );
      })}
      <button
        type="button"
        disabled={checking !== null || data.prompts.length === 0 || platforms.length === 0}
        onClick={() => check(data.prompts.map((p) => p.id), "all")}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong transition-colors disabled:opacity-50"
      >
        {checking === "all" && <Loader2 className="h-4 w-4 animate-spin" />}
        Comprobar todas
        <span className="font-normal text-white/70">{fmtCredits(estCost * data.prompts.length)}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Módulo · Visibilidad IA"
        title="Visibilidad en IA"
        description="Comprueba si Google muestra una respuesta con IA (AI Overview) para tus keywords y si te cita como fuente. Debajo, a modo de muestra, qué responden ChatGPT y Perplexity a preguntas de cliente."
      />

      {!data.domain && (
        <Pill tone="danger">Añade el dominio del proyecto en Perfil para poder medir si apareces.</Pill>
      )}

      <AiOverviewSection projectId={projectId} />

      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">Preguntas a ChatGPT y Perplexity</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-soft">
            Una respuesta de IA cambia de una vez a otra: esto es una muestra puntual, no una medición. Sirve para ver
            qué fuentes y competidores salen, no para sacar un porcentaje.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-background transition-colors"
        >
          <Plus className="h-4 w-4" /> Añadir preguntas
        </button>
      </div>

      {data.prompts.length === 0 ? (
        <Section>
          <div className="mx-auto max-w-xl py-6 text-center space-y-3">
            <MessageSquareText className="mx-auto h-8 w-8 text-ink-faint" />
            <h2 className="text-base font-bold text-ink">Empieza con 3 a 5 preguntas de cliente</h2>
            <p className="text-sm text-ink-soft">
              Escríbelas como las escribiría alguien que busca lo que ofreces, por ejemplo «¿cuál es el mejor despacho de
              auditoría en Oviedo?» o «¿qué hay que mirar al contratar un cerrajero urgente?».
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong transition-colors"
            >
              <Plus className="h-4 w-4" /> Añadir preguntas
            </button>
          </div>
        </Section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {checkBar}
            {notice && <Pill tone={notice.tone}>{notice.text}</Pill>}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Section
              className="lg:col-span-2"
              title="Preguntas"
              description="Pulsa una fila para ver la respuesta y las fuentes que citó cada asistente."
              flush
            >
              <div className="overflow-hidden">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Pregunta</th>
                      {Object.entries(data.platforms).map(([k, p]) => (
                        <th key={k}>{p.label}</th>
                      ))}
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.prompts.map((p) => {
                      const open = expanded === p.id;
                      return (
                        <FragmentRow
                          key={p.id}
                          open={open}
                          colSpan={Object.keys(data.platforms).length + 2}
                          row={
                            <tr className="cursor-pointer" onClick={() => setExpanded(open ? null : p.id)}>
                              <td className="max-w-[320px]">
                                <span className="flex items-start gap-2">
                                  {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />}
                                  <span className="text-ink">{p.prompt}</span>
                                </span>
                              </td>
                              {Object.keys(data.platforms).map((pl) => (
                                <td key={pl}>
                                  <StatusPill check={latest(p, pl)} />
                                </td>
                              ))}
                              <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  title="Comprobar esta pregunta"
                                  disabled={checking !== null || platforms.length === 0}
                                  onClick={() => check([p.id], p.id)}
                                  className="rounded-lg p-1.5 text-ink-soft hover:bg-background hover:text-ink disabled:opacity-40"
                                >
                                  {checking === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                                </button>
                                <button type="button" title="Dejar de seguir" onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-ink-soft hover:bg-background hover:text-alert-ink">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          }
                          detail={
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              {Object.entries(data.platforms).map(([pl, meta]) => {
                                const c = latest(p, pl);
                                return (
                                  <div key={pl} className="space-y-2">
                                    <p className="text-xs font-semibold text-ink-soft">
                                      {meta.label}
                                      {c && <span className="font-normal text-ink-faint"> · {new Date(c.checkedAt).toLocaleDateString("es-ES")}</span>}
                                    </p>
                                    {!c ? (
                                      <p className="text-xs text-ink-faint">Sin comprobar todavía.</p>
                                    ) : (
                                      <>
                                        <p className="max-h-40 overflow-y-auto whitespace-pre-line text-xs text-ink-soft">{c.answer || "Sin texto en la respuesta."}</p>
                                        {c.fanOutQueries && c.fanOutQueries.length > 0 && (
                                          <div className="text-xs">
                                            <p className="mb-1 font-semibold text-ink-soft">Lo que buscó la IA para responder</p>
                                            <div className="flex flex-wrap gap-1">
                                              {c.fanOutQueries.map((q) => (
                                                <span key={q} className="rounded-full bg-surface-muted px-2 py-0.5 text-ink-soft">{q}</span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {c.sources.length > 0 ? (
                                          <ul className="space-y-1">
                                            {c.sources.slice(0, 8).map((s) => (
                                              <li key={s.url} className="flex items-center gap-2 text-xs">
                                                <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-medium", isOwn(s.domain) ? "bg-brand-50 text-brand" : isComp(s.domain) ? "bg-accent-tint text-accent-ink" : "bg-surface-muted text-ink-soft")}>
                                                  {isOwn(s.domain) ? "Tú" : isComp(s.domain) ? "Competidor" : s.domain}
                                                </span>
                                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-ink-soft hover:text-ink">
                                                  {s.title ?? s.url}
                                                </a>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-xs text-ink-faint">La respuesta no citó ninguna fuente.</p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          }
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Quién se cita" description="Webs que más aparecen como fuente en las respuestas.">
              {ranking.length === 0 ? (
                <p className="text-sm text-ink-soft">Aún no hay fuentes: comprueba alguna pregunta.</p>
              ) : (
                <BarList
                  items={ranking.map(([domain, n]) => ({
                    label: domain,
                    value: n,
                    display: `${n}`,
                    tag: isOwn(domain) ? "Tú" : isComp(domain) ? "Competidor" : undefined,
                  }))}
                />
              )}
              <p className="mt-4 text-xs text-ink-faint">
                Si una respuesta no cita fuentes, no significa que no existas: significa que el asistente no te ha citado.
              </p>
            </Section>
          </div>
        </>
      )}

      <Modal open={addOpen} title="Añadir preguntas" onClose={() => setAddOpen(false)}>
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">Una pregunta por línea, tal como la escribiría un cliente (máx. 200 caracteres cada una).</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={"¿Cuál es el mejor despacho de auditoría en Oviedo?\n¿Qué empresa de auditoría de cuentas me recomiendas en Asturias?"}
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {notice?.tone === "danger" && <Pill tone="danger">{notice.text}</Pill>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-background">
              Cancelar
            </button>
            <button
              type="button"
              disabled={adding || text.trim() === ""}
              onClick={addPrompts}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {adding ? "Añadiendo…" : "Añadir"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Fila de tabla con detalle desplegable debajo.
function FragmentRow({ row, detail, open, colSpan }: { row: React.ReactNode; detail: React.ReactNode; open: boolean; colSpan: number }) {
  return (
    <>
      {row}
      {open && (
        <tr>
          <td colSpan={colSpan} className="bg-surface-muted/40">
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}
