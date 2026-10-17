"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ListPlus, Check, ExternalLink, AlertTriangle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";

type Kind = "pagina2" | "top3" | "ctr";
type QuickWin = {
  kind: Kind;
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  potentialClicks: number | null;
  targetPosition: number | null;
  cannibalized: boolean;
  tracked: boolean;
};
type QuickWinsPayload = {
  items: QuickWin[];
  siteCtrAvailable: boolean;
  skippedBrand: number;
  days: number;
  truncated: boolean;
};
type DecayPage = {
  page: string;
  prevClicks: number;
  clicks: number;
  delta: number;
  deltaPct: number;
  prevImpressions: number;
  impressions: number;
  prevPosition: number | null;
  position: number | null;
  topQueries: { query: string; prevClicks: number; clicks: number }[];
};
type DecayPayload = { items: DecayPage[]; days: number; truncated: boolean };
type Payload = { needsGsc?: true; error?: string } & Partial<QuickWinsPayload> & Partial<DecayPayload>;

const KIND_INFO: Record<Kind, { label: string; tone: "brand" | "warning" | "neutral"; what: string; fix: string; href: string; cta: string }> = {
  ctr: {
    label: "Título poco atractivo",
    tone: "warning",
    what: "Sales bien colocado pero casi nadie hace clic.",
    fix: "Reescribe el título y la meta descripción.",
    href: "titulos-meta",
    cta: "Reescribir título",
  },
  pagina2: {
    label: "Cerca de la primera página",
    tone: "brand",
    what: "Estás en la página 2 de Google.",
    fix: "Amplía y mejora el contenido y refuérzalo con enlaces internos.",
    href: "contenido",
    cta: "Optimizar la página",
  },
  top3: {
    label: "Cerca del top 3",
    tone: "neutral",
    what: "Estás en primera página pero lejos de los primeros puestos.",
    fix: "Refuerza el contenido y los enlaces internos hacia esta página.",
    href: "contenido",
    cta: "Optimizar la página",
  },
};

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const num = (v: number) => Math.round(v).toLocaleString("es-ES");
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "");

function GscGate({ projectId }: { projectId: string }) {
  return (
    <Section>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" />
        <p className="text-sm text-ink-soft">
          Para ver oportunidades hay que conectar Search Console. Conéctalo en la Ficha →{" "}
          <Link href={`/app/proyectos/${projectId}/google`} className="font-medium text-ink underline">
            Google
          </Link>{" "}
          y elige la propiedad del proyecto. Es gratis y no gasta créditos.
        </p>
      </div>
    </Section>
  );
}

function AddTaskButton({ projectId, title, detail }: { projectId: string; title: string; detail: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  async function add() {
    setState("saving");
    const res = await fetch(`/api/proyectos/${projectId}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, detail, priority: "media" }),
    });
    setState(res.ok ? "done" : "idle");
  }
  return (
    <button
      onClick={add}
      disabled={state !== "idle"}
      className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-60"
    >
      {state === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : state === "done" ? <Check className="h-3 w-3 text-accent-ink" /> : <ListPlus className="h-3 w-3" />}
      {state === "done" ? "En Tareas" : "Crear tarea"}
    </button>
  );
}

function QuickWins({ projectId, data }: { projectId: string; data: QuickWinsPayload }) {
  const [filter, setFilter] = useState<Kind | "all">("all");
  const items = data.items;
  const shown = useMemo(() => (filter === "all" ? items : items.filter((i) => i.kind === filter)), [items, filter]);
  const counts = useMemo(() => ({ ctr: items.filter((i) => i.kind === "ctr").length, pagina2: items.filter((i) => i.kind === "pagina2").length, top3: items.filter((i) => i.kind === "top3").length }), [items]);
  const totalPotential = items.reduce((s, i) => s + (i.potentialClicks ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Oportunidades" value={items.length} hint={`últimos ${data.days} días`} highlight />
        <StatTile label="Títulos poco atractivos" value={counts.ctr} hint="posicionas pero no hacen clic" />
        <StatTile label="En la página 2" value={counts.pagina2} hint="a un paso de la primera" />
        <StatTile label="Clics extra posibles" value={data.siteCtrAvailable ? `+${num(totalPotential)}` : "—"} hint={data.siteCtrAvailable ? "en 90 días, con tu propio CTR" : "faltan datos para estimar"} />
      </div>

      <Section
        title="Qué tocar primero"
        description="Ordenado por clics que podrías ganar. Los clics extra se calculan con el CTR real de tu web por posición, no con una media genérica."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {(["all", "ctr", "pagina2", "top3"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold", filter === k ? "bg-brand text-white" : "bg-surface-muted text-ink-soft hover:text-ink")}
              >
                {k === "all" ? "Todas" : KIND_INFO[k].label}
              </button>
            ))}
          </div>
        }
        flush
      >
        {shown.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-ink-soft">No hay oportunidades de este tipo en el periodo.</p>
        ) : (
          <table className="data-table data-table-compact w-full">
            <thead>
              <tr>
                <th>Búsqueda</th>
                <th className="num">Posición</th>
                <th className="num">Impresiones</th>
                <th className="num">CTR</th>
                <th className="num">Clics extra</th>
                <th>Qué hacer</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const info = KIND_INFO[i.kind];
                return (
                  <tr key={`${i.query}|${i.page}`} className="align-top">
                    <td className="max-w-[280px]">
                      <p className="font-medium text-ink">{i.query}</p>
                      <a href={i.page} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-ink-faint hover:text-ink">
                        <span className="truncate">{shortUrl(i.page)}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Pill tone={info.tone} className="px-2 text-[11px]">{info.label}</Pill>
                        {i.cannibalized && <Pill tone="danger" className="px-2 text-[11px]">Varias URLs compiten</Pill>}
                        {i.tracked && <Pill tone="neutral" className="px-2 text-[11px]">En Rank Tracking</Pill>}
                      </div>
                    </td>
                    <td className="num tabular-nums">{i.position.toFixed(1).replace(".", ",")}</td>
                    <td className="num tabular-nums text-ink-soft">{num(i.impressions)}</td>
                    <td className="num tabular-nums text-ink-soft">{pct(i.ctr)}</td>
                    <td className="num tabular-nums font-semibold text-ink">{i.potentialClicks != null ? `+${num(i.potentialClicks)}` : "—"}</td>
                    <td className="max-w-[300px] text-xs text-ink-soft">
                      <p>{info.what} {info.fix}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Link href={`/app/proyectos/${projectId}/${info.href}`} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-100/60">
                          {info.cta}
                        </Link>
                        {i.cannibalized && (
                          <Link href={`/app/proyectos/${projectId}/auditoria/canibalizaciones`} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink">
                            Ver canibalización
                          </Link>
                        )}
                        <AddTaskButton
                          projectId={projectId}
                          title={`${info.cta}: «${i.query}»`}
                          detail={`${shortUrl(i.page)} · posición ${i.position.toFixed(1)} · ${num(i.impressions)} impresiones · CTR ${pct(i.ctr)}. ${info.fix}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <p className="text-xs text-ink-faint">
        Datos reales de Search Console de los últimos {data.days} días.
        {data.skippedBrand > 0 && ` Se han excluido ${data.skippedBrand} búsquedas de tu marca.`}
        {data.truncated && " Search Console devuelve como máximo 5.000 filas: en webs muy grandes la lista puede estar incompleta."}
      </p>
    </div>
  );
}

function Decay({ projectId, data }: { projectId: string; data: DecayPayload }) {
  const lost = data.items.reduce((s, i) => s - i.delta, 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Páginas que bajan" value={data.items.length} hint={`últimos ${data.days} días vs. los ${data.days} anteriores`} highlight />
        <StatTile label="Clics perdidos" value={`−${num(lost)}`} hint="suma de esas páginas" />
        <StatTile label="Criterio" value="−30 %" hint="y al menos 10 clics menos" />
      </div>
      <Section title="Páginas que pierden tráfico" description="Comparado con el periodo anterior de la misma duración. Mira primero las que más clics han perdido." flush>
        {data.items.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-ink-soft">Ninguna página ha perdido tráfico de forma relevante. Buena señal.</p>
        ) : (
          <table className="data-table data-table-compact w-full">
            <thead>
              <tr>
                <th>Página</th>
                <th className="num">Clics</th>
                <th className="num">Cambio</th>
                <th className="num">Posición</th>
                <th>Qué ha perdido</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.page} className="align-top">
                  <td className="max-w-[280px]">
                    <a href={p.page} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-ink hover:underline">
                      <TrendingDown className="h-3.5 w-3.5 shrink-0 text-alert-ink" />
                      <span className="truncate">{shortUrl(p.page)}</span>
                    </a>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Link href={`/app/proyectos/${projectId}/contenido`} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-100/60">
                        Optimizar la página
                      </Link>
                      <AddTaskButton
                        projectId={projectId}
                        title={`Recuperar tráfico: ${shortUrl(p.page)}`}
                        detail={`Ha pasado de ${num(p.prevClicks)} a ${num(p.clicks)} clics (${num(p.deltaPct * 100)} %). Revisar contenido, título y posiciones.`}
                      />
                    </div>
                  </td>
                  <td className="num tabular-nums text-ink-soft">{num(p.prevClicks)} → {num(p.clicks)}</td>
                  <td className="num tabular-nums font-semibold text-alert-ink">{num(p.deltaPct * 100)} %</td>
                  <td className="num tabular-nums text-ink-soft">
                    {p.prevPosition != null && p.position != null ? `${p.prevPosition.toFixed(1).replace(".", ",")} → ${p.position.toFixed(1).replace(".", ",")}` : "—"}
                  </td>
                  <td className="max-w-[260px] text-xs text-ink-soft">
                    {p.topQueries.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="space-y-0.5">
                        {p.topQueries.map((q) => (
                          <li key={q.query}>
                            <span className="text-ink">{q.query}</span> <span className="text-ink-faint">{q.prevClicks} → {q.clicks}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <p className="text-xs text-ink-faint">
        Una bajada puede ser estacional: compara con el mismo periodo del año pasado en el módulo Google antes de actuar.
        {data.truncated && " Search Console devuelve como máximo 5.000 filas: en webs muy grandes la lista puede estar incompleta."}
      </p>
    </div>
  );
}

export default function OportunidadesView({ projectId, vista }: { projectId: string; vista: "quickwins" | "perdidas" }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/proyectos/${projectId}/oportunidades?vista=${vista}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "Error al cargar las oportunidades");
        return body as Payload;
      })
      .then(setData)
      .catch((e) => setData({ error: e.message }))
      .finally(() => setLoading(false));
  }, [projectId, vista]);

  const header =
    vista === "quickwins" ? (
      <PageHeader
        eyebrow="Oportunidades · Mejoras rápidas"
        title="Mejoras rápidas"
        description="Qué cambios pequeños te traerían más visitas, sacados de lo que Google ya te muestra. Sin gastar créditos."
      />
    ) : (
      <PageHeader
        eyebrow="Oportunidades · Páginas que bajan"
        title="Páginas que bajan"
        description="Páginas que han perdido tráfico respecto al periodo anterior, y las búsquedas que ya no te traen visitas."
      />
    );

  return (
    <div className="space-y-6">
      {header}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
        </div>
      ) : data?.needsGsc ? (
        <GscGate projectId={projectId} />
      ) : data?.error ? (
        <p className="rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert-ink">{data.error}</p>
      ) : vista === "quickwins" ? (
        <QuickWins projectId={projectId} data={data as QuickWinsPayload} />
      ) : (
        <Decay projectId={projectId} data={data as DecayPayload} />
      )}
    </div>
  );
}
