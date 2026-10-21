"use client";

import { useEffect, useState } from "react";
import { Loader2, Gauge, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import SimpleHistory from "@/components/app/SimpleHistory";
import Section from "@/components/ui/Section";
import Pill from "@/components/app/Pill";

type Metric = { percentile: number | null; category: string | null } | null;
type Field = { overallCategory: string | null; lcp: Metric; cls: Metric; inp: Metric; ttfb: Metric; source: "page" | "origin" } | null;
type Opp = { id: string; title: string; displayValue: string | null; score: number | null };
type Check = {
  id: string;
  url: string;
  strategy: "mobile" | "desktop";
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  fieldData: Field;
  opportunities: Opp[] | null;
  prevPerformance: number | null;
  fetchedAt: string;
};
type Payload = { configured: boolean; domain: string | null; suggestions: string[]; checks: Check[] };

const short = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "") || u;
const tone = (v: number | null) => (v == null ? "text-ink-faint" : v >= 90 ? "text-accent-ink" : v >= 50 ? "text-ink" : "text-alert-ink");
const fieldTone = (c: string | null): "success" | "warning" | "danger" | "neutral" => (c === "FAST" ? "success" : c === "AVERAGE" ? "warning" : c === "SLOW" ? "danger" : "neutral");
const fieldLabel = (c: string | null) => (c === "FAST" ? "Bien" : c === "AVERAGE" ? "Mejorable" : c === "SLOW" ? "Lento" : "—");
const secs = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);

export default function VelocidadView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    return fetch(`/api/proyectos/${projectId}/velocidad`).then((r) => r.json()).then(setData);
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function measure(url: string) {
    setBusy(url);
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/velocidad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, strategy: "mobile" }),
    });
    const body = await res.json();
    if (!res.ok) setError(body.error ?? "No se pudo medir");
    else await load();
    setBusy(null);
  }

  const checked = new Map((data?.checks ?? []).map((c) => [c.url, c]));
  const urls = [...new Set([...(data?.suggestions ?? []), ...(data?.checks ?? []).map((c) => c.url)])];

  return (
    <div className="space-y-6">
      <SimpleHistory url={`/api/proyectos/${projectId}/velocidad/historial`} refreshKey={data} empty="Aún no has medido ninguna página. Cada medición quedará aquí." />
      <PageHeader
        eyebrow="Auditoría · Velocidad"
        title="Velocidad por página"
        description="Core Web Vitals y puntuación de Google PageSpeed (móvil) de tus páginas clave. Gratis, no gasta créditos."
      />
      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-ink-faint" /></div>
      ) : !data?.configured ? (
        <Section><p className="text-sm text-ink-soft">La medición de velocidad necesita la clave de PageSpeed Insights de Google, que se configura en Configuración.</p></Section>
      ) : (
        <>
          <Section
            title="Páginas"
            description="Tu home y las páginas con más clics en Search Console. Cada medición tarda unos segundos."
            actions={
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom.trim()) measure(custom.trim()).then(() => setCustom(""));
                }}
                className="flex items-center gap-2"
              >
                <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="https://tuweb.com/pagina" className="w-64 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs outline-none focus:border-brand" />
                <button disabled={!!busy} className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">Medir</button>
              </form>
            }
            flush
          >
            {error && <p className="mx-6 mb-3 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert-ink">{error}</p>}
            {urls.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-ink-soft">Define el dominio del proyecto o pega una URL de arriba.</p>
            ) : (
              <table className="data-table data-table-compact w-full">
                <thead>
                  <tr>
                    <th>Página</th>
                    <th className="num">Rendimiento</th>
                    <th>LCP</th>
                    <th>CLS</th>
                    <th>INP</th>
                    <th>Datos reales</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {urls.map((u) => {
                    const c = checked.get(u);
                    const diff = c && c.performance != null && c.prevPerformance != null ? c.performance - c.prevPerformance : null;
                    return (
                      <>
                        <tr key={u} className="align-top">
                          <td className="max-w-[260px] truncate font-medium text-ink">
                            {c ? (
                              <button onClick={() => setOpen(open === u ? null : u)} className="inline-flex items-center gap-1 hover:text-brand">
                                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open === u && "rotate-180")} />
                                {short(u)}
                              </button>
                            ) : (
                              short(u)
                            )}
                          </td>
                          <td className={cn("num tabular-nums font-semibold", tone(c?.performance ?? null))}>
                            {c?.performance ?? "—"}
                            {diff !== null && diff !== 0 && <span className={cn("ml-1 text-xs font-medium", diff > 0 ? "text-accent-ink" : "text-alert-ink")}>{diff > 0 ? "+" : ""}{diff}</span>}
                          </td>
                          <td className="tabular-nums text-ink-soft">{secs(c?.lcpMs ?? null)}</td>
                          <td className="tabular-nums text-ink-soft">{c?.cls != null ? c.cls.toFixed(2).replace(".", ",") : "—"}</td>
                          <td className="tabular-nums text-ink-soft">{c?.inpMs != null ? `${Math.round(c.inpMs)} ms` : "—"}</td>
                          <td>
                            {c?.fieldData ? (
                              <Pill tone={fieldTone(c.fieldData.overallCategory)} className="px-2 text-[11px]">
                                {fieldLabel(c.fieldData.overallCategory)}{c.fieldData.source === "origin" ? " · toda la web" : ""}
                              </Pill>
                            ) : c ? (
                              <span className="text-xs text-ink-faint">Sin tráfico suficiente</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-right">
                            <button onClick={() => measure(u)} disabled={!!busy} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-50">
                              {busy === u ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gauge className="h-3 w-3" />}
                              {c ? "Repetir" : "Medir"}
                            </button>
                          </td>
                        </tr>
                        {c && open === u && (
                          <tr key={u + "-d"}>
                            <td colSpan={7} className="bg-surface-muted/60">
                              <div className="grid gap-4 py-2 text-xs sm:grid-cols-2">
                                <div>
                                  <p className="mb-1 font-semibold text-ink-soft">Otras puntuaciones de Google</p>
                                  <p className="text-ink-soft">Accesibilidad {c.accessibility ?? "—"} · Buenas prácticas {c.bestPractices ?? "—"} · SEO {c.seo ?? "—"}</p>
                                  {c.fieldData && (
                                    <p className="mt-2 text-ink-soft">
                                      Datos reales de usuarios (percentil 75): LCP {secs(c.fieldData.lcp?.percentile ?? null)} · CLS {c.fieldData.cls?.percentile != null ? (c.fieldData.cls.percentile / 100).toFixed(2).replace(".", ",") : "—"} · INP {c.fieldData.inp?.percentile != null ? `${Math.round(c.fieldData.inp.percentile)} ms` : "—"}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="mb-1 font-semibold text-ink-soft">Qué mejorar</p>
                                  {c.opportunities && c.opportunities.length > 0 ? (
                                    <ul className="space-y-0.5 text-ink-soft">
                                      {c.opportunities.slice(0, 6).map((o) => (
                                        <li key={o.id}>{o.title}{o.displayValue ? <span className="text-ink-faint"> — {o.displayValue}</span> : null}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-ink-soft">Google no ve mejoras importantes.</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
          <p className="text-xs text-ink-faint">LCP, CLS e INP son medidas de laboratorio (simuladas, móvil). «Datos reales» son las de usuarios de Chrome, y solo aparecen si la página tiene tráfico suficiente.</p>
        </>
      )}
    </div>
  );
}
