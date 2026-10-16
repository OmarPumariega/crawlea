"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, XCircle, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";
import { RadialGauge } from "@/components/ui/charts";
import AuditTrendChart from "@/components/app/AuditTrendChart";
import AuditIssuesTrendChart from "@/components/app/AuditIssuesTrendChart";
import AuditTechnicalDetails from "@/components/app/AuditTechnicalDetails";
import AuditIssuesList from "@/components/app/AuditIssuesList";
import PositionDistribution, { type PositionBuckets } from "@/components/app/PositionDistribution";
import { TECNICA_ISSUES, ONPAGE_ISSUES } from "@/lib/audit/issue-meta";

type CategoryScore = { score: number; max: number; detail: Record<string, number> };
type CategoryScores = {
  indexabilidad: CategoryScore;
  enlaces: CategoryScore;
  onpage: CategoryScore;
  rendimiento: CategoryScore | null;
  accesibilidadImagenes: CategoryScore;
};

type AuditPage = {
  id: string;
  url: string;
  statusCode: number | null;
  isHttps: boolean;
  isRedirect: boolean;
  canonicalUrl: string | null;
  metaRobots: string | null;
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaLength: number | null;
  h1Count: number | null;
  h1Text: string | null;
  imagesTotal: number;
  imagesMissingAlt: number;
  brokenLinksCount: number;
  inSearchConsole: boolean | null;
  issues: string[] | null;
  wordCount: number | null;
};

// Shape de src/lib/audit/psi.ts#PsiResult — duplicado aquí (no server-only)
// porque psiData llega tal cual en AuditRun.psiData (Json), sin transformar.
type PsiFieldMetric = { percentile: number | null; category: string | null };
type PsiFieldData = {
  overallCategory: string | null;
  lcp: PsiFieldMetric | null;
  cls: PsiFieldMetric | null;
  inp: PsiFieldMetric | null;
  ttfb: PsiFieldMetric | null;
  source: "page" | "origin";
};
type PsiOpportunity = {
  id: string;
  title: string;
  description: string;
  displayValue: string | null;
  score: number | null;
};
type PsiData = {
  scores: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
  opportunities: PsiOpportunity[];
  fieldData: PsiFieldData | null;
};

type AuditRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  startUrl: string;
  triggeredAt: string;
  pagesCrawled: number;
  truncated: boolean;
  sitemapFound: boolean | null;
  robotsBlocked: boolean;
  overallScore: number | null;
  categoryScores: CategoryScores | null;
  gscChecked: boolean;
  errorMessage: string | null;
  pages?: AuditPage[];
  psiData?: PsiData | null;
};

type Tab = "resumen" | "tecnica" | "onpage";

const TABS: { key: Tab; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "tecnica", label: "Auditoría Técnica" },
  { key: "onpage", label: "Elementos SEO" },
];

const CATEGORY_LABELS: Record<string, string> = {
  indexabilidad: "Indexabilidad",
  enlaces: "Enlaces",
  onpage: "On-page (títulos/metas/H1)",
  rendimiento: "Rendimiento",
  accesibilidadImagenes: "Accesibilidad",
};

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 flex flex-col">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <p className="text-3xl font-bold tracking-tight text-ink tabular-nums mt-2">{value}</p>
      {sub && <p className="text-xs text-ink-faint mt-1.5">{sub}</p>}
    </div>
  );
}

// Core Web Vitals (PageSpeed Insights). detail viene de scoring.ts:
// { performanceScorePct, lcpMs, clsX1000, inpMs } (-1 = sin dato).
const CWV_TONE: Record<string, string> = { good: "text-accent-ink", warn: "text-accent-ink", bad: "text-alert-ink" };
const CWV_DOT: Record<string, string> = { good: "bg-brand-500", warn: "bg-brand-300", bad: "bg-alert" };
const CWV_LABEL: Record<string, string> = { good: "Bueno", warn: "Mejorable", bad: "Lento" };

function CwvTile({ label, value, status }: { label: string; value: string; status: string | null }) {
  return (
    <div className="bg-background rounded-lg p-3">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={cn("text-xl font-semibold tabular-nums", status ? CWV_TONE[status] : "text-ink-faint")}>
        {value}
      </div>
      {status && (
        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-ink-soft">
          <span className={cn("h-1.5 w-1.5 rounded-full", CWV_DOT[status])} />
          {CWV_LABEL[status]}
        </div>
      )}
    </div>
  );
}

// Categoría 0-100 (accessibility/best-practices/seo, 0-1 → 0-100) con el
// mismo semáforo de status que ya usan las CWV tiles.
function scoreStatus(pct: number): string {
  return pct >= 90 ? "good" : pct >= 50 ? "warn" : "bad";
}

// LCP/CLS/INP reales (CrUX), no simulados — Google los etiqueta directamente
// como GOOD/NEEDS_IMPROVEMENT/POOR, no hace falta recalcular umbrales.
function fieldStatus(category: string | null): string | null {
  if (category === "FAST" || category === "GOOD") return "good";
  if (category === "AVERAGE" || category === "NEEDS_IMPROVEMENT") return "warn";
  if (category === "SLOW" || category === "POOR") return "bad";
  return null;
}

function CwvPanel({ detail, psiData }: { detail: Record<string, number>; psiData?: PsiData | null }) {
  const perf = detail.performanceScorePct;
  const lcp = detail.lcpMs;
  const clsX = detail.clsX1000;
  const inp = detail.inpMs;
  const perfStatus = perf >= 90 ? "good" : perf >= 50 ? "warn" : "bad";
  const lcpStatus = lcp < 0 ? null : lcp <= 2500 ? "good" : lcp <= 4000 ? "warn" : "bad";
  const clsStatus = clsX < 0 ? null : clsX <= 100 ? "good" : clsX <= 250 ? "warn" : "bad";
  const inpStatus = inp < 0 ? null : inp <= 200 ? "good" : inp <= 500 ? "warn" : "bad";

  const extraScores = [
    { label: "Accesibilidad", value: psiData?.scores?.accessibility },
    { label: "Best Practices", value: psiData?.scores?.bestPractices },
    { label: "SEO (Lighthouse)", value: psiData?.scores?.seo },
  ].filter((s) => s.value != null) as { label: string; value: number }[];

  const field = psiData?.fieldData;
  // Las auditorías antiguas guardaban psiData con otra forma: sin estas listas.
  const opportunities = Array.isArray(psiData?.opportunities) ? psiData.opportunities : [];

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-ink">Core Web Vitals (PageSpeed)</h3>
        <span className="text-[10px] uppercase tracking-wide text-ink-faint">Home · móvil</span>
      </div>
      <div>
        <p className="text-xs text-ink-faint mb-2">
          Datos de laboratorio (Lighthouse) — simulación, no visitantes reales.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CwvTile label="Performance" value={perf >= 0 ? String(perf) : "—"} status={String(perfStatus)} />
          <CwvTile label="LCP" value={lcp >= 0 ? `${(lcp / 1000).toFixed(1)}s` : "—"} status={lcpStatus} />
          <CwvTile label="CLS" value={clsX >= 0 ? (clsX / 1000).toFixed(2) : "—"} status={clsStatus} />
          <CwvTile label="INP" value={inp >= 0 ? `${inp}ms` : "—"} status={inpStatus} />
        </div>
      </div>

      {extraScores.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {extraScores.map((s) => (
            <CwvTile key={s.label} label={s.label} value={String(Math.round(s.value * 100))} status={scoreStatus(Math.round(s.value * 100))} />
          ))}
        </div>
      )}

      <div>
        <p className="text-xs text-ink-faint mb-2">
          Datos reales de usuarios (Chrome UX Report) — la señal que Google usa como ranking factor.
        </p>
        {!field ? (
          <p className="text-xs text-ink-faint">Sin cobertura de CrUX suficiente para esta URL/dominio (tráfico bajo).</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CwvTile
              label="LCP real"
              value={field.lcp?.percentile != null ? `${(field.lcp.percentile / 1000).toFixed(1)}s` : "—"}
              status={fieldStatus(field.lcp?.category ?? null)}
            />
            <CwvTile
              label="CLS real"
              value={field.cls?.percentile != null ? (field.cls.percentile / 1000).toFixed(2) : "—"}
              status={fieldStatus(field.cls?.category ?? null)}
            />
            <CwvTile
              label="INP real"
              value={field.inp?.percentile != null ? `${field.inp.percentile}ms` : "—"}
              status={fieldStatus(field.inp?.category ?? null)}
            />
            <CwvTile
              label="TTFB real"
              value={field.ttfb?.percentile != null ? `${field.ttfb.percentile}ms` : "—"}
              status={fieldStatus(field.ttfb?.category ?? null)}
            />
          </div>
        )}
        {field && (
          <p className="text-[10px] text-ink-faint mt-1">
            {field.source === "page" ? "De esta URL exacta" : "Del dominio completo (sin datos suficientes de esta URL)"}
          </p>
        )}
      </div>

      {opportunities.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink-soft mb-2">Oportunidades de mejora detectadas</p>
          <ul className="space-y-2">
            {opportunities.slice(0, 6).map((o) => (
              <li key={o.id} className="bg-background rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink font-medium">{o.title}</span>
                  {o.displayValue && <span className="text-xs text-ink-soft shrink-0">{o.displayValue}</span>}
                </div>
                {o.description && (
                  <p className="text-[11px] text-ink-soft mt-0.5 line-clamp-2">{o.description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmtTraffic(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v).toLocaleString("es-ES");
}

// Visibilidad del dominio en Google según Search Console (gratis, real). Es la
// alternativa sin coste a una métrica de "autoridad" de pago (Moz/Ahrefs/DataForSEO).
function VisibilityPanel({
  visibility,
  projectId,
}: {
  visibility: { impressions: number; clicks: number; queries: number; position: number; month: string } | null;
  projectId: string;
}) {
  const hasData = visibility && (visibility.impressions > 0 || visibility.queries > 0);
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-ink-faint" />
          <h3 className="text-sm font-semibold text-ink">Visibilidad en Google</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-ink-faint">
          {hasData ? `Search Console · ${visibility!.month}` : "Search Console"}
        </span>
      </div>
      {!hasData ? (
        <p className="text-sm text-ink-soft">
          Sin datos de Search Console todavía.{" "}
          <Link href={`/app/proyectos/${projectId}/google`} className="text-brand font-medium underline">
            Conéctalo en el módulo Google →
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiTile label="Impresiones (mes)" value={fmtTraffic(visibility!.impressions)} />
          <KpiTile label="Clics (mes)" value={fmtTraffic(visibility!.clicks)} />
          <KpiTile label="Queries con datos" value={visibility!.queries.toLocaleString("es-ES")} />
          <KpiTile label="Posición media" value={visibility!.position.toFixed(1)} />
        </div>
      )}
    </div>
  );
}

type TopKeyword = { keyword: string; position: number | null; volume: number | null };

// Visibilidad orgánica estimada (DataForSEO Labs) del propio dominio, mismo dato
// que el módulo Competidores — leer el último análisis es gratis, no dispara
// ninguna llamada nueva. Complementa la visibilidad de Search Console (real,
// pero solo cubre lo que Google ya te enseña) con una estimación de mercado que
// también compara contra los competidores trackeados.
function LabsVisibilityPanel({
  snapshot,
  projectId,
}: {
  snapshot: {
    organicTraffic: number | null;
    organicKeywords: number | null;
    positionBuckets: PositionBuckets | null;
    avgPosition: number | null;
    topKeywords: TopKeyword[] | null;
    fetchedAt: string;
  } | null;
  projectId: string;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">

          <h3 className="text-sm font-semibold text-ink">Visibilidad orgánica estimada</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-ink-faint">
          {snapshot ? `Datos de mercado · ${new Date(snapshot.fetchedAt).toLocaleDateString("es-ES")}` : "Datos de mercado"}
        </span>
      </div>
      {!snapshot ? (
        <p className="text-sm text-ink-soft">
          Sin análisis todavía.{" "}
          <Link href={`/app/proyectos/${projectId}/competidores`} className="text-brand font-medium underline">
            Analiza tu dominio en Competidores →
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiTile label="Tráfico orgánico (est. mensual)" value={fmtTraffic(snapshot.organicTraffic)} />
            <KpiTile label="Keywords orgánicas" value={snapshot.organicKeywords?.toLocaleString("es-ES") ?? "—"} />
            {snapshot.positionBuckets && (
              <div className="sm:col-span-2 space-y-1">
                <div className="text-sm text-ink-soft">Fuerza del dominio</div>
                <PositionDistribution buckets={snapshot.positionBuckets} avgPosition={snapshot.avgPosition} />
              </div>
            )}
          </div>
          {snapshot.topKeywords && snapshot.topKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {snapshot.topKeywords.slice(0, 10).map((k, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-background text-ink-soft">
                  {k.keyword}
                  {k.position !== null && <span className="text-ink-faint">· #{k.position}</span>}
                </span>
              ))}
            </div>
          )}
          <Link href={`/app/proyectos/${projectId}/competidores`} className="text-xs text-brand font-medium underline">
            Ver todas las keywords y competidores →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function AuditoriaView({ projectId }: { projectId: string }) {
  const [history, setHistory] = useState<AuditRun[]>([]);
  const [current, setCurrent] = useState<AuditRun | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [auditFrequency, setAuditFrequency] = useState("manual");
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("resumen");
  // Visibilidad del dominio en Google (Search Console). Gratis: lee el último
  // snapshot persistido por el panel de GSC, sin llamar a la API ni gastar.
  const [visibility, setVisibility] = useState<{
    impressions: number;
    clicks: number;
    queries: number;
    position: number;
    month: string;
  } | null>(null);
  // Visibilidad orgánica estimada (DataForSEO Labs, módulo Competidores).
  // Gratis: lee el último VisibilitySnapshot del dominio del proyecto.
  const [labsSnapshot, setLabsSnapshot] = useState<{
    organicTraffic: number | null;
    organicKeywords: number | null;
    positionBuckets: PositionBuckets | null;
    avgPosition: number | null;
    topKeywords: TopKeyword[] | null;
    fetchedAt: string;
  } | null>(null);
  // Páginas huérfanas del último AuditRun completado — cálculo gratis a partir
  // del linkGraph ya persistido (mismo dato que usa el módulo Enlaces). Solo
  // un indicador aquí, con enlace al detalle completo en Enlaces.
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function pollRun(auditId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/proyectos/${projectId}/auditorias/${auditId}`);
      if (!res.ok) return;
      const data: AuditRun = await res.json();
      setCurrent(data);
      setHistory((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      if (data.status === "completed" || data.status === "failed") stopPolling();
    }, 3000);
  }

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/auditorias`)
      .then((r) => r.json())
      .then((data: AuditRun[]) => {
        if (Array.isArray(data)) {
          setHistory(data);
          const latest = data[0];
          if (latest) {
            setCurrent(latest);
            if (latest.status === "pending" || latest.status === "running") {
              pollRun(latest.id);
            } else if (latest.status === "completed") {
              // El listado no incluye `pages` — sin este fetch, las tarjetas
              // KPI y las listas de incidencias se quedarían a 0 hasta que el
              // usuario hiciera clic en el histórico.
              loadDetail(latest.id);
            }
          }
        }
        setLoadingHistory(false);
      });

    // El listado de auditorías no devuelve el proyecto; hacemos un fetch
    // adicional para leer auditFrequency y saber el estado inicial del toggle.
    fetch(`/api/proyectos/${projectId}`)
      .then((r) => r.json())
      .then((p) => {
        if (p && typeof p.auditFrequency === "string") setAuditFrequency(p.auditFrequency);
      })
      .catch(() => {});

    // Visibilidad del dominio (Search Console): lee el último snapshot
    // persistido. Gratis, sin llamadas a la API.
    fetch(`/api/proyectos/${projectId}/google/gsc-snapshot`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.snapshot) {
          setVisibility({
            impressions: d.snapshot.impressions ?? 0,
            clicks: d.snapshot.clicks ?? 0,
            queries: d.snapshot.queries ?? 0,
            position: d.snapshot.position ?? 0,
            month: d.snapshot.month ?? "",
          });
        }
      })
      .catch(() => {});

    // Visibilidad orgánica estimada (DataForSEO Labs): mismo endpoint que lee
    // el módulo Competidores, gratis (solo lee el último snapshot guardado).
    fetch(`/api/proyectos/${projectId}/competidores`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.projectSnapshot) {
          setLabsSnapshot({
            organicTraffic: d.projectSnapshot.organicTraffic ?? null,
            organicKeywords: d.projectSnapshot.organicKeywords ?? null,
            positionBuckets: d.projectSnapshot.positionBuckets ?? null,
            avgPosition: d.projectSnapshot.avgPosition ?? null,
            topKeywords: d.projectSnapshot.topKeywords ?? null,
            fetchedAt: d.projectSnapshot.fetchedAt,
          });
        }
      })
      .catch(() => {});

    // Huérfanas: mismo cálculo (gratis) que el módulo Enlaces sobre el
    // linkGraph del último AuditRun completado.
    fetch(`/api/proyectos/${projectId}/enlaces`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.orphans)) setOrphanCount(d.orphans.length);
      })
      .catch(() => {});

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadDetail(auditId: string) {
    const res = await fetch(`/api/proyectos/${projectId}/auditorias/${auditId}`);
    if (res.ok) setCurrent(await res.json());
  }

  async function handleTrigger() {
    setError("");
    setTriggering(true);
    const res = await fetch(`/api/proyectos/${projectId}/auditorias`, { method: "POST" });
    const data = await res.json();
    setTriggering(false);

    if (!res.ok) {
      setError(data.error ?? "Error al iniciar la auditoría");
      return;
    }

    setHistory((prev) => [data, ...prev]);
    setCurrent(data);
    setTab("resumen");
    pollRun(data.id);
  }

  async function toggleSchedule() {
    const next = auditFrequency === "monthly" ? "manual" : "monthly";
    setScheduleBusy(true);
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/auditoria/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency: next }),
    });
    setScheduleBusy(false);
    if (res.ok) {
      const data = await res.json();
      setAuditFrequency(data.auditFrequency ?? next);
    } else {
      setError("No se pudo actualizar la programación");
    }
  }

  const pages = current?.pages ?? [];
  const pagesWithIssuesCount = pages.filter((p) => (p.issues?.length ?? 0) > 0).length;
  const totalIssueInstances = pages.reduce((sum, p) => sum + (p.issues?.length ?? 0), 0);
  const totalBrokenLinks = pages.reduce((sum, p) => sum + p.brokenLinksCount, 0);

  const showContent =
    current?.status === "completed" && !current.robotsBlocked && current.categoryScores;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Auditoría Técnica</h2>
          <p className="text-sm text-ink-soft mt-1">
            Rastreo del sitio, Core Web Vitals de la home y cruce con Search Console.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <label
            className="flex items-center gap-2 text-xs text-ink-soft"
            title="El cron creará una auditoría automáticamente cada ~30 días"
          >
            <span>Auditoría mensual automática</span>
            <button
              type="button"
              role="switch"
              aria-checked={auditFrequency === "monthly"}
              onClick={toggleSchedule}
              disabled={scheduleBusy}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                auditFrequency === "monthly" ? "bg-brand" : "bg-surface-muted"
              )}
            >
              {scheduleBusy ? (
                <Loader2 className="h-3.5 w-3.5 absolute left-1/2 -translate-x-1/2 text-ink-soft animate-spin" />
              ) : (
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform",
                    auditFrequency === "monthly" ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              )}
            </button>
          </label>
          <button
            onClick={handleTrigger}
            disabled={triggering || current?.status === "pending" || current?.status === "running"}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-full hover:bg-brand-strong disabled:opacity-50 shrink-0"
          >
            {triggering && <Loader2 className="h-4 w-4 animate-spin" />}
            Ejecutar auditoría ahora
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>}

      {current && (current.status === "pending" || current.status === "running") && (
        <div className="bg-background text-ink-soft px-4 py-3 rounded-lg space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            {current.status === "pending"
              ? "En cola — el procesador revisa cada ~60s, empezará en breve."
              : "Rastreando el sitio y consultando PageSpeed..."}
          </div>
          {current.status === "pending" && (
            <p className="text-xs text-ink-soft pl-6">
              Las auditorías se procesan en segundo plano. Espera hasta un minuto
              antes de que cambie a &quot;en curso&quot;.
            </p>
          )}
          {current.status === "running" && (
            <p className="text-xs text-ink-soft pl-6">
              Rastrea el sitio entero (hasta 5000 páginas) + PageSpeed de la home —
              puede tardar varios minutos, o más en sitios grandes. No cierres la
              página — los resultados aparecerán aquí automáticamente.
            </p>
          )}
        </div>
      )}

      {current?.status === "failed" && (
        <div className="flex items-center gap-2 text-sm bg-alert-tint text-alert-ink px-3 py-2 rounded-lg">
          <XCircle className="h-4 w-4 shrink-0" />
          {current.errorMessage ?? "La auditoría ha fallado."}
        </div>
      )}

      {current?.status === "completed" && current.robotsBlocked && (
        <div className="flex items-center gap-2 text-sm bg-accent-tint text-accent-ink px-3 py-2 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          El robots.txt de este sitio bloquea el rastreo — no se ha podido calcular una
          puntuación.
        </div>
      )}

      {current?.status === "completed" && current.truncated && (
        <div className="flex items-center gap-2 text-sm bg-accent-tint text-accent-ink px-3 py-2 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          El rastreo alcanzó el límite de seguridad ({current.pagesCrawled.toLocaleString("es-ES")}{" "}
          páginas) — puede haber más páginas del sitio sin analizar.
        </div>
      )}

      {showContent && current && current.categoryScores && (
        <>
          <div className="inline-flex items-center gap-1 bg-black/[0.05] rounded-xl p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  tab === t.key
                    ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]"
                    : "text-ink-soft hover:text-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "resumen" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Nota global: medidor sobre la tarjeta destacada */}
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-brand p-5 text-white shadow-[0_10px_30px_-12px_rgba(79,92,245,0.6)]">
                  <div>
                    <p className="text-[13px] font-semibold text-white/75">Optimización del sitio</p>
                    <p className="mt-2 text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                      {current.overallScore ?? "—"}
                      {current.overallScore != null && <span className="text-xl font-bold text-white/60">/100</span>}
                    </p>
                    <p className="mt-2 text-xs text-white/70">
                      {current.overallScore == null ? "sin puntuación" : current.overallScore >= 80 ? "buen estado" : current.overallScore >= 50 ? "mejorable" : "necesita trabajo"}
                    </p>
                  </div>
                  <div className="relative h-20 w-20 shrink-0">
                    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                      <circle cx="40" cy="40" r="34" fill="none" strokeWidth="10" className="stroke-white/20" />
                      <circle
                        cx="40" cy="40" r="34" fill="none" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 34}
                        strokeDashoffset={2 * Math.PI * 34 * (1 - (current.overallScore ?? 0) / 100)}
                        className={current.overallScore != null && current.overallScore < 50 ? "stroke-alert" : "stroke-white"}
                      />
                    </svg>
                  </div>
                </div>
                <StatTile label="Páginas rastreadas" value={current.pagesCrawled.toLocaleString("es-ES")} hint={current.truncated ? "límite de seguridad alcanzado" : "todo el sitio"} />
                <div className="flex items-center justify-between gap-3 rounded-[20px] border border-line bg-surface p-5 shadow-card">
                  <div>
                    <p className="text-[13px] font-semibold text-ink-soft">Páginas con incidencias</p>
                    <p className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">{pagesWithIssuesCount.toLocaleString("es-ES")}</p>
                    <p className="mt-2 text-xs text-ink-faint">{totalIssueInstances.toLocaleString("es-ES")} incidencias en total</p>
                  </div>
                  <RadialGauge value={(pagesWithIssuesCount / Math.max(1, current.pagesCrawled)) * 100} size={72} label="del sitio" />
                </div>
                <StatTile
                  label="Enlaces rotos"
                  value={<span className={totalBrokenLinks > 0 ? "text-alert-ink" : ""}>{totalBrokenLinks.toLocaleString("es-ES")}</span>}
                  hint={totalBrokenLinks > 0 ? "revísalos en la pestaña Técnica" : "ninguno encontrado"}
                />
              </div>

              {orphanCount !== null && orphanCount > 0 && (
                <p className="text-xs text-accent-ink bg-accent-tint border border-brand-100 rounded-xl px-3 py-2">
                  {orphanCount} página{orphanCount === 1 ? "" : "s"} huérfana{orphanCount === 1 ? "" : "s"} (sin
                  enlaces internos entrantes) detectada{orphanCount === 1 ? "" : "s"} en el último rastreo —{" "}
                  <Link href={`/app/proyectos/${projectId}/auditoria/enlaces`} className="underline font-medium">
                    ver detalle en Enlaces
                  </Link>
                  .
                </p>
              )}

              <Section title="Puntuación por categoría" description="Cada categoría suma a la nota global; sin cajas negras.">
                <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
                  {(Object.keys(CATEGORY_LABELS) as (keyof CategoryScores)[]).map((key) => {
                    const cat = current.categoryScores?.[key];
                    const pct = cat && cat.max > 0 ? (cat.score / cat.max) * 100 : null;
                    return (
                      <li key={key}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold text-ink">{CATEGORY_LABELS[key]}</span>
                          <span className="tabular-nums text-ink-soft">
                            {cat ? <><strong className="text-ink">{cat.score}</strong> / {cat.max}</> : "sin datos"}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50">
                          <div
                            className={cn("h-full rounded-full", pct == null ? "" : pct >= 80 ? "bg-brand-500" : pct >= 50 ? "bg-brand-300" : "bg-alert")}
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
              {!current.categoryScores.rendimiento && (
                <p className="text-xs text-ink-faint">
                  Rendimiento sin datos (falta configurar PAGESPEED_API_KEY).
                </p>
              )}
              <p className="text-xs text-ink-faint">
                Rendimiento medido sobre la página de inicio, no sobre todo el sitio
                {current.gscChecked
                  ? ""
                  : " · sin cruce con Search Console (proyecto sin propiedad GSC o sin conexión de Google)"}
              </p>

              {/* Core Web Vitals (PageSpeed Insights) — los datos ya los captura el
                  crawl en categoryScores.rendimiento.detail; aquí se muestran. */}
              {current.categoryScores?.rendimiento?.detail && (
                <CwvPanel detail={current.categoryScores.rendimiento.detail} psiData={current.psiData} />
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <AuditTrendChart projectId={projectId} />
                <AuditIssuesTrendChart runs={history} />
              </div>

              {/* Visibilidad en Google (Search Console) + visibilidad orgánica
                  estimada (DataForSEO Labs, módulo Competidores) — real vs.
                  estimación de mercado, ambas gratis de ver aquí. */}
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <VisibilityPanel visibility={visibility} projectId={projectId} />
                <LabsVisibilityPanel snapshot={labsSnapshot} projectId={projectId} />
              </div>
            </div>
          )}

          {tab === "tecnica" && (
            <div className="space-y-6">
              <AuditIssuesList pages={pages} issueCodes={TECNICA_ISSUES} gscChecked={current.gscChecked} />
              <AuditTechnicalDetails projectId={projectId} auditRunId={current.id} />
            </div>
          )}

          {tab === "onpage" && (
            <AuditIssuesList pages={pages} issueCodes={ONPAGE_ISSUES} gscChecked={current.gscChecked} />
          )}
        </>
      )}

      <Section title="Histórico" description="Pulsa una auditoría para ver sus resultados.">
        {loadingHistory ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
        ) : history.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no se ha ejecutado ninguna auditoría.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {history.map((run) => {
              const score = run.status === "completed" && !run.robotsBlocked ? run.overallScore : null;
              return (
                <button
                  key={run.id}
                  onClick={() => loadDetail(run.id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors hover:bg-surface-muted",
                    current?.id === run.id ? "border-brand bg-brand-50/50" : "border-line"
                  )}
                >
                  <p className="text-xs text-ink-faint">
                    {new Date(run.triggeredAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums text-ink">
                    {run.status === "completed" ? (run.robotsBlocked ? "Bloqueada" : `${run.overallScore}/100`) : run.status === "failed" ? "Error" : "En curso"}
                  </p>
                  {score != null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50">
                      <div className={cn("h-full rounded-full", score >= 80 ? "bg-brand-500" : score >= 50 ? "bg-brand-300" : "bg-alert")} style={{ width: `${score}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
