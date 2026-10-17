"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Loader2, Plus, Trash2, Target, TrendingUp, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, ArrowDownToLine, Crosshair, FileSearch,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import ImportSuccessNotice from "@/components/app/ImportSuccessNotice";
import LocationPicker, { type LocationValue } from "@/components/app/LocationPicker";
import PositionDistribution, { type PositionBuckets } from "@/components/app/PositionDistribution";
import {
  competitorAnalysisCostUsd,
  contentGapCostUsd,
  onPageAnalysisCostUsd,
  backlinkAnalysisCostUsd,
} from "@/lib/dataforseo/pricing";
import Link from "next/link";
import { fmtCredits } from "@/lib/credits";
import { importKeywordsToDefaultStudy } from "@/lib/keywords/client-import";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";
import Toolbar from "@/components/ui/Toolbar";
import Modal from "@/components/app/Modal";
import { AreaSpark, BarList, RadialGauge } from "@/components/ui/charts";
import type { RankedKeyword, DomainMovement, PaidMetrics } from "@/lib/competitors/types";
import { serpFeatureLabel, interestingSerpFeatures } from "@/lib/serp/features";

// Item enriquecido de keyword (visibilidad o content gap). Todos los campos
// extra llegan GRATIS en la misma respuesta Labs que ya pagábamos — antes se
// descartaban. CPC y dificultad sirven para priorizar; la URL y el snippet
// (description) son "cómo posiciona el competidor", el ejemplo de copy más
// accionable de todo el módulo.
type TopKeyword = RankedKeyword;

// Análisis on-page de una URL suelta (Screaming Frog-like), vía DataForSEO
// On-Page API — ver src/lib/onpage/. Los campos boolean/issues reflejan
// exactamente lo que da la API real: no hay recuento de enlaces rotos (solo
// "¿tiene alguno?"), ni de imágenes sin alt (solo el mismo tipo de flag,
// dentro de `issues`).
type OnPageAnalysisData = {
  id: string;
  onPageScore: number | null;
  wordCount: number | null;
  characterCount: number | null;
  sentenceCount: number | null;
  titleLength: number | null;
  descriptionLength: number | null;
  htags: Record<string, string[]> | null;
  issues: string[] | null;
  readability: {
    automatedReadabilityIndex: number | null;
    colemanLiauReadabilityIndex: number | null;
    daleChallReadabilityIndex: number | null;
    fleschKincaidReadabilityIndex: number | null;
    smogReadabilityIndex: number | null;
  } | null;
  imagesCount: number | null;
  internalLinksCount: number | null;
  externalLinksCount: number | null;
  hasBrokenLinks: boolean | null;
  extras?: {
    timing: {
      timeToInteractive: number | null;
      domComplete: number | null;
      largestContentfulPaint: number | null;
      firstInputDelay: number | null;
      waiting: number | null;
      duration: number | null;
    } | null;
    cumulativeLayoutShift: number | null;
    scripts: { count: number | null; size: number | null };
    stylesheets: { count: number | null; size: number | null };
    renderBlockingScripts: number | null;
    renderBlockingStylesheets: number | null;
    size: number | null;
    encodedSize: number | null;
    contentEncoding: string | null;
    server: string | null;
    cacheable: boolean | null;
    consistency: { description: number | null; title: number | null; keywords: number | null };
    canonical: string | null;
    generator: string | null;
    clickDepth: number | null;
    duplicates: { title: boolean | null; description: boolean | null; content: boolean | null; metaTags: string[] | null };
    resourceErrors: number | null;
    resourceWarnings: number | null;
    brokenResources: boolean | null;
    social: Record<string, string> | null;
  } | null;
  fetchedAt: string;
};

const fmtMs = (v: number | null | undefined) => (v == null || v === 0 ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const fmtKb = (v: number | null | undefined) => (v == null ? "—" : v >= 1048576 ? `${(v / 1048576).toFixed(1)} MB` : `${Math.round(v / 1024)} KB`);
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

// Etiquetas en español para las incidencias más relevantes — el resto (hay
// ~45 posibles) se muestra con el nombre crudo formateado, sin necesidad de
// mantener una lista exhaustiva.
const ONPAGE_ISSUE_LABELS: Record<string, string> = {
  no_title: "Sin título",
  no_description: "Sin meta descripción",
  no_h1_tag: "Sin H1",
  title_too_long: "Título demasiado largo",
  title_too_short: "Título demasiado corto",
  duplicate_title_tag: "Título duplicado en la página",
  duplicate_meta_tags: "Meta tags duplicados",
  no_image_alt: "Imágenes sin alt",
  no_image_title: "Imágenes sin title",
  low_readability_rate: "Legibilidad baja",
  low_content_rate: "Poco texto respecto al peso de la página",
  is_broken: "Página caída (4xx/5xx)",
  is_4xx_code: "Error 4xx",
  is_5xx_code: "Error 5xx",
  is_redirect: "Redirección",
  no_favicon: "Sin favicon",
  irrelevant_title: "Título poco relevante para el contenido",
  irrelevant_description: "Meta descripción poco relevante",
  has_render_blocking_resources: "Recursos que bloquean el renderizado",
  high_loading_time: "Tiempo de carga alto",
  deprecated_html_tags: "Etiquetas HTML obsoletas",
  lorem_ipsum: "Contenido de relleno (lorem ipsum)",
};

function onPageIssueLabel(key: string): string {
  return ONPAGE_ISSUE_LABELS[key] ?? key.replace(/_/g, " ");
}

function OnPageExtrasBlock({ x }: { x: NonNullable<OnPageAnalysisData["extras"]> }) {
  const cell = (label: string, value: string, bad?: boolean) => (
    <div className="bg-background rounded-lg p-2">
      <p className="text-ink-faint">{label}</p>
      <p className={cn("font-semibold", bad ? "text-alert-ink" : "text-ink")}>{value}</p>
    </div>
  );
  const dupes = [x.duplicates.title && "título", x.duplicates.description && "meta descripción", x.duplicates.content && "contenido"].filter(Boolean) as string[];
  const social = x.social ? Object.entries(x.social) : [];
  return (
    <div className="space-y-2">
      <p className="text-ink-soft font-medium">Rendimiento y peso</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cell("Interactiva a los", fmtMs(x.timing?.timeToInteractive), (x.timing?.timeToInteractive ?? 0) > 3800)}
        {cell("Respuesta del servidor", fmtMs(x.timing?.waiting), (x.timing?.waiting ?? 0) > 800)}
        {cell("Carga completa", fmtMs(x.timing?.domComplete))}
        {cell("Desplazamiento (CLS)", x.cumulativeLayoutShift == null ? "—" : x.cumulativeLayoutShift.toFixed(2), (x.cumulativeLayoutShift ?? 0) > 0.1)}
        {cell("Peso HTML", `${fmtKb(x.size)}${x.encodedSize != null ? ` → ${fmtKb(x.encodedSize)}` : ""}`)}
        {cell("Scripts", `${x.scripts.count ?? "—"}${x.scripts.size ? ` · ${fmtKb(x.scripts.size)}` : ""}`)}
        {cell("Hojas de estilo", `${x.stylesheets.count ?? "—"}${x.stylesheets.size ? ` · ${fmtKb(x.stylesheets.size)}` : ""}`)}
        {cell("Bloquean el pintado", `${(x.renderBlockingScripts ?? 0) + (x.renderBlockingStylesheets ?? 0)}`, (x.renderBlockingScripts ?? 0) + (x.renderBlockingStylesheets ?? 0) > 5)}
      </div>
      <div className="flex flex-wrap gap-3 text-ink-soft">
        {x.server && <span>Servidor: <strong className="text-ink">{x.server}</strong></span>}
        {x.contentEncoding && <span>Compresión: <strong className="text-ink">{x.contentEncoding}</strong></span>}
        {x.cacheable != null && <span>Caché del navegador: <strong className="text-ink">{x.cacheable ? "sí" : "no"}</strong></span>}
        {x.clickDepth != null && <span>Clics desde la home: <strong className="text-ink">{x.clickDepth}</strong></span>}
        {x.generator && <span className="truncate max-w-[260px]">Generado con: <strong className="text-ink">{x.generator}</strong></span>}
        {(x.resourceErrors ?? 0) > 0 && <span className="text-alert-ink font-medium">{x.resourceErrors} errores de recursos</span>}
        {(x.resourceWarnings ?? 0) > 0 && <span>{x.resourceWarnings} avisos de recursos</span>}
      </div>
      <div className="flex flex-wrap gap-3 text-ink-soft">
        <span>Título ↔ contenido: <strong className="text-ink">{fmtPct(x.consistency.title)}</strong></span>
        <span>Meta ↔ contenido: <strong className="text-ink">{fmtPct(x.consistency.description)}</strong></span>
        {x.canonical && <span className="truncate max-w-[320px]">Canonical: <strong className="text-ink">{x.canonical}</strong></span>}
        {dupes.length > 0 && <span className="text-alert-ink font-medium">Duplicado: {dupes.join(", ")}</span>}
        {x.duplicates.metaTags && x.duplicates.metaTags.length > 0 && <span className="text-alert-ink">Etiquetas meta repetidas: {x.duplicates.metaTags.join(", ")}</span>}
      </div>
      {social.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-ink-soft font-medium">Redes sociales (Open Graph / Twitter)</p>
          <ul className="text-ink-soft">
            {social.slice(0, 10).map(([k, v]) => (
              <li key={k} className="truncate"><span className="text-ink-faint">{k}:</span> {v}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OnPageReportDetail({ analysis }: { analysis: OnPageAnalysisData }) {
  const htags: Record<string, string[]> = analysis.htags ?? {};
  const htagLevels = Object.keys(htags).sort();
  return (
    <div className="mt-2 space-y-2 text-xs">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-background rounded-lg p-2">
          <p className="text-ink-faint">Palabras</p>
          <p className="font-semibold text-ink">{analysis.wordCount ?? "—"}</p>
        </div>
        <div className="bg-background rounded-lg p-2">
          <p className="text-ink-faint">Caracteres</p>
          <p className="font-semibold text-ink">{analysis.characterCount ?? "—"}</p>
        </div>
        <div className="bg-background rounded-lg p-2" title="No hay recuento exacto de frases; se estima sobre un fragmento del texto (primeros ~3000 caracteres), no la página completa — por eso puede parecer bajo frente al recuento de palabras.">
          <p className="text-ink-faint">Frases (muestra)</p>
          <p className="font-semibold text-ink">{analysis.sentenceCount ?? "—"}</p>
        </div>
        <div className="bg-background rounded-lg p-2">
          <p className="text-ink-faint">Puntuación on-page</p>
          <p className="font-semibold text-ink">{analysis.onPageScore != null ? `${Math.round(analysis.onPageScore)}/100` : "—"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-ink-soft">
        <span>Título: <strong className="text-ink">{analysis.titleLength ?? "—"}</strong> car.</span>
        <span>Meta descripción: <strong className="text-ink">{analysis.descriptionLength ?? "—"}</strong> car.</span>
        <span>Imágenes: <strong className="text-ink">{analysis.imagesCount ?? "—"}</strong></span>
        <span>Enlaces internos: <strong className="text-ink">{analysis.internalLinksCount ?? "—"}</strong></span>
        <span>Enlaces externos: <strong className="text-ink">{analysis.externalLinksCount ?? "—"}</strong></span>
        {analysis.hasBrokenLinks === true && (
          <span className="text-alert-ink font-medium">Tiene enlaces rotos</span>
        )}
      </div>

      {analysis.extras ? <OnPageExtrasBlock x={analysis.extras} /> : (
        <p className="rounded-lg bg-surface-muted px-2 py-1.5 text-ink-faint">Este análisis es anterior a los datos de rendimiento y redes. Vuelve a analizar para verlos.</p>
      )}

      {htagLevels.length > 0 && (
        <div className="space-y-1">
          <p className="text-ink-soft font-medium">Jerarquía de encabezados</p>
          <ul className="space-y-0.5">
            {htagLevels.map((level) => (
              <li key={level} className="flex items-start gap-1.5">
                <span className="text-[10px] px-1 rounded bg-surface-muted text-ink-soft shrink-0 mt-0.5 uppercase">{level}</span>
                <span className="text-ink-soft">
                  {(htags[level] ?? []).join("  ·  ") || <span className="text-ink-faint">—</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.issues && analysis.issues.length > 0 && (
        <div className="space-y-1">
          <p className="text-ink-soft font-medium">Incidencias detectadas ({analysis.issues.length})</p>
          <div className="flex flex-wrap gap-1">
            {analysis.issues.map((issue) => (
              <span key={issue} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-tint text-accent-ink">
                {onPageIssueLabel(issue)}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.readability?.fleschKincaidReadabilityIndex != null && (
        <p className="text-ink-soft">
          Índice de legibilidad (Flesch-Kincaid): <strong className="text-ink">{analysis.readability.fleschKincaidReadabilityIndex.toFixed(1)}</strong>
        </p>
      )}
    </div>
  );
}

// Botón "Analizar página" por URL — al montar comprueba gratis si ya hay un
// análisis reciente (GET); si no, "Analizar" paga (DataForSEO On-Page API,
// guard de frescura de 7 días en el backend, ver src/lib/onpage/analyze.ts).
function OnPageButton({ projectId, url }: { projectId: string; url: string }) {
  const [analysis, setAnalysis] = useState<OnPageAnalysisData | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proyectos/${projectId}/competidores/onpage?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d: OnPageAnalysisData | null) => {
        if (!cancelled && d && d.id) setAnalysis(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, url]);

  async function handleAnalyze() {
    setError("");
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/proyectos/${projectId}/competidores/onpage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al analizar la página");
        return;
      }
      setAnalysis(data);
      setExpanded(true);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mt-1.5 pt-1.5 border-t border-line">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (analysis ? setExpanded((v) => !v) : handleAnalyze())}
          disabled={analyzing || checkingExisting}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-surface-muted text-ink-soft hover:bg-surface-muted disabled:opacity-50"
          title={analysis ? "Ver informe on-page" : `Analizar página (${fmtCredits(onPageAnalysisCostUsd())}, gratis si ya se analizó hace menos de 7 días)`}
        >
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSearch className="h-3 w-3" />}
          {analysis ? (expanded ? "Ocultar informe on-page" : "Ver informe on-page") : "Analizar página"}
        </button>
        {analysis && (
          <span className="text-[10px] text-ink-faint">
            {new Date(analysis.fetchedAt).toLocaleDateString("es-ES")}
          </span>
        )}
      </div>
      {error && <p className="text-[11px] text-alert-ink mt-1">{error}</p>}
      {expanded && analysis && <OnPageReportDetail analysis={analysis} />}
    </div>
  );
}

type Snapshot = {
  id: string;
  domain: string;
  organicTraffic: number | null;
  organicKeywords: number | null;
  positionBuckets: PositionBuckets | null;
  avgPosition: number | null; // obsoleto: Labs no lo devuelve
  trafficValue?: number | null;
  movement?: DomainMovement | null;
  paid?: PaidMetrics | null;
  topKeywords: TopKeyword[] | null;
  fetchedAt: string;
} | null;

type Competitor = {
  id: string;
  domain: string;
  contentGap: TopKeyword[] | null;
  contentGapAt: string | null;
  snapshot: Snapshot;
};

type Data = {
  projectDomain: string | null;
  projectSnapshot: Snapshot;
  competitors: Competitor[];
};

// Estimaciones orientativas (como en geogrid/rank tracking).
// "Analizar" de un competidor hace dos cosas: visibilidad (Labs) y perfil de
// backlinks (API de Backlinks, otro producto de DataForSEO). El segundo se
// pide con 50 backlinks por defecto; el detalle y más cantidad, en la pestaña Backlinks.
const BACKLINKS_PER_ANALYSIS = 50;
const visibilityCost = competitorAnalysisCostUsd();
const backlinksCost = backlinkAnalysisCostUsd(BACKLINKS_PER_ANALYSIS);
const analyzeCost = visibilityCost + backlinksCost;
const gapCost = contentGapCostUsd();

// Autoridad y enlazado externo de un dominio (último BacklinkSnapshot).
type BlSnap = {
  rank: number | null;
  backlinksTotal: number | null;
  referringDomains: number | null;
  brokenBacklinks: number | null;
  fetchedAt: string;
} | null;

function fmtTraffic(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
}

function fmtCpc(v: number | null | undefined): string {
  // nullish (== null): cubre null Y undefined. Los items viejos del content
  // gap/top keywords NO tienen cpc (campo ausente → undefined), no null —
  // chequear solo `=== null` dejaba pasar undefined y rompía en .toFixed().
  if (v == null) return "—";
  return `${(v as number).toFixed(2)}$`;
}

// Valor del tráfico = lo que costaría ese tráfico comprándolo en Google Ads.
function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k $`;
  return `${v.toFixed(v < 10 ? 2 : 0)} $`;
}

const INTENT_SHORT: Record<string, string> = { informacional: "Informativa", mixta: "Mixta", transaccional: "Transaccional" };

function IntentTag({ intent }: { intent: string | null | undefined }) {
  if (!intent) return <span className="text-ink-faint">—</span>;
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 font-medium", intent === "transaccional" ? "bg-brand-100 text-brand-700" : "bg-surface-muted text-ink-soft")}>
      {INTENT_SHORT[intent] ?? intent}
    </span>
  );
}

// Variación anual del volumen de búsqueda (search_volume_trend.yearly).
function TrendTag({ trend }: { trend: TopKeyword["trend"] }) {
  const y = trend?.yearly;
  if (y == null) return <span className="text-ink-faint">—</span>;
  if (y === 0) return <span className="text-ink-faint">=</span>;
  return <span className={cn("tabular-nums font-medium", y > 0 ? "text-brand" : "text-alert-ink")}>{y > 0 ? "▲" : "▼"} {Math.abs(y)}%</span>;
}

// Cómo ha cambiado la posición del dominio desde la medición anterior.
function MoveTag({ k }: { k: TopKeyword }) {
  const m = k.movement;
  if (k.isLost) return <span className="text-alert-ink" title="Ha salido de los resultados">perdida</span>;
  if (!m) return null;
  if (m.isNew) return <span className="text-brand" title="Keyword nueva">nueva</span>;
  if (m.previous != null && k.position != null && m.previous !== k.position) {
    const d = m.previous - k.position;
    return <span className={cn("tabular-nums", d > 0 ? "text-brand" : "text-alert-ink")} title={`Antes #${m.previous}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>;
  }
  return null;
}

// Altas, subidas, bajadas y pérdidas de keywords del dominio entre mediciones.
function MovementBadges({ movement }: { movement: DomainMovement | null | undefined }) {
  if (!movement) return <span className="text-ink-faint">—</span>;
  const items: [string, number, string, string][] = [
    ["+", movement.new, "text-brand", "keywords nuevas"],
    ["▲", movement.up, "text-brand", "keywords que suben"],
    ["▼", movement.down, "text-alert-ink", "keywords que bajan"],
    ["−", movement.lost, "text-alert-ink", "keywords perdidas"],
  ];
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {items.map(([sym, n, cls, title]) => (
        <span key={title} className={n > 0 ? cls : "text-ink-faint"} title={`${n} ${title}`}>
          {sym}{n}
        </span>
      ))}
    </span>
  );
}

// Mini-sparkline de estacionalidad (12 meses). El dato llega gratis en cada
// item de content gap / ranked (keyword_info.monthly_searches); antes se
// tiraba. Aquí sirve para descartar keywords que pican solo en una época o,
// al revés, para detectar oportunidades estacionales. Null → "—".
function SeasonalitySparkline({ points }: { points: number[] | null | undefined }) {
  if (!points || points.length < 2) return <span className="text-ink-faint">—</span>;
  const W = 44;
  const H = 16;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * H;
  const pts = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const title = `Estacionalidad 12m · pico ${max.toLocaleString("es-ES")} · actual ${points[points.length - 1].toLocaleString("es-ES")}`;
  return (
    <svg width={W} height={H} className="text-ink-faint" role="img" aria-label={title}>
      <title>{title}</title>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </svg>
  );
}

// Dificultad SEO real (keyword_properties.keyword_difficulty, 0-100) — NO se
// deriva de `competition`/`competitionIndex` (eso es densidad de pujas de
// Google Ads, una señal distinta que antes se usaba como proxy y por eso
// casi siempre salía "Media" o "?"). Sin dato → "?".
function difficulty(score: number | null | undefined): { label: string; cls: string } {
  // == null (no ===): cubre null Y undefined. Los content gap/top keywords
  // guardados antes de que este campo existiera no tienen `difficulty` en su
  // JSON (ausente → undefined, no null) — chequear solo `=== null` dejaba
  // pasar undefined y caía siempre en la rama "Baja", igual que el bug ya
  // corregido en fmtCpc.
  if (score == null) return { label: "?", cls: "bg-surface-muted text-ink-faint" };
  if (score >= 67) return { label: `${score} · Alta`, cls: "bg-alert-tint text-alert-ink" };
  if (score >= 34) return { label: `${score} · Media`, cls: "bg-brand-100 text-brand-700" };
  return { label: `${score} · Baja`, cls: "bg-surface-muted text-ink-soft" };
}

// Un snapshot puede existir en BD (el "Analizar" se pidió y respondió con
// éxito) pero venir vacío de señal real — dominios muy pequeños/nuevos sin
// presencia orgánica medible en DataForSEO. Sin esto, "Analizar todos" nunca
// volvía a incluirlos (contaba como "ya analizado" para siempre) y la
// tarjeta no mostraba ningún aviso, indistinguible a simple vista de "nunca
// se ha tocado".
function hasUsefulSnapshot(snapshot: Snapshot): boolean {
  if (!snapshot) return false;
  return (
    snapshot.organicTraffic != null ||
    snapshot.organicKeywords != null ||
    (snapshot.topKeywords != null && snapshot.topKeywords.length > 0)
  );
}

function TrafficSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const W = 200;
  const H = 48;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * H;
  const pts = points.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={W} height={H} className="text-ink-faint">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

// Vista de visibilidad de un dominio (KPIs + distribución + tendencia).
function VisibilityKpis({ snapshot, trend }: { snapshot: Snapshot; trend?: number[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <p className="text-[13px] font-medium text-ink-soft">Tráfico orgánico (est. mensual)</p>
        <p className="text-[28px] font-bold tracking-tight text-ink tabular-nums mt-1 leading-none">{fmtTraffic(snapshot?.organicTraffic ?? null)}</p>
      </div>
      <div>
        <p className="text-[13px] font-medium text-ink-soft">Keywords orgánicas</p>
        <p className="text-[28px] font-bold tracking-tight text-ink tabular-nums mt-1 leading-none">{snapshot?.organicKeywords?.toLocaleString("es-ES") ?? "—"}</p>
      </div>
      {snapshot?.positionBuckets ? (
        <div className="space-y-1">
          <div className="text-sm text-ink-soft">Fuerza del dominio</div>
          <PositionDistribution buckets={snapshot.positionBuckets} avgPosition={snapshot.avgPosition} />
        </div>
      ) : trend && trend.length >= 2 ? (
        <div className="flex flex-col items-start">
          <TrafficSparkline points={trend} />
          <span className="text-[11px] text-ink-faint flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" /> {trend.length} análisis
          </span>
        </div>
      ) : (
        <div className="flex items-center text-xs text-ink-faint">Sin tendencia todavía</div>
      )}
    </div>
  );
}

// Chips compactos para las top keywords de un dominio (propio o competidor):
// keyword · volumen · #posición, más badge de dificultad cuando se conoce.
function KeywordChips({ keywords, colorClass }: { keywords: TopKeyword[]; colorClass: string }) {
  return (
    <div className="max-h-64 overflow-y-auto flex flex-wrap content-start gap-1.5">
      {keywords.map((k, i) => {
        const dif = difficulty(k.difficulty);
        return (
          <span key={i} className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded", colorClass)}>
            {k.keyword}
            {k.volume != null && <span className="opacity-70">· {k.volume.toLocaleString("es-ES")}</span>}
            {k.position != null && <span className="opacity-70">· #{k.position}</span>}
            {k.cpc != null && <span className="opacity-70">· {fmtCpc(k.cpc)}</span>}
            {k.difficulty != null && (
              <span className={cn("px-1 rounded font-medium", dif.cls)} title={`Dificultad ${dif.label}`}>
                {dif.label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function TopKeywords({ keywords, title }: { keywords: TopKeyword[] | null; title: string }) {
  const [search, setSearch] = useState("");
  if (!keywords || keywords.length === 0) {
    return <p className="text-xs text-ink-faint">{title}: sin datos aún.</p>;
  }
  const q = search.trim().toLowerCase();
  const filtered = q ? keywords.filter((k) => k.keyword.toLowerCase().includes(q)) : keywords;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-ink-soft">{title} ({keywords.length})</p>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar keyword..."
          className="px-3 py-1.5 border border-line rounded-full text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 w-44 bg-surface transition-colors"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-ink-faint">Sin resultados para &laquo;{search}&raquo;.</p>
      ) : (
        <KeywordChips keywords={filtered} colorClass="bg-background text-ink-soft" />
      )}
    </div>
  );
}

// Todo lo que sabemos de una keyword de un dominio: cómo lo posiciona (copy),
// cuánto tráfico y valor aporta, hacia dónde va la demanda, lo que cuesta
// competir (enlaces, autoridad, pujas) y cómo es el SERP.
function KeywordDetail({ k, projectId }: { k: TopKeyword; projectId: string }) {
  const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v}%`);
  const bn = k.backlinksNeeded;
  const features = interestingSerpFeatures(k.serpFeatures);
  const rows: [string, React.ReactNode][] = [
    ["Tráfico estimado", k.etv != null ? `${k.etv.toFixed(k.etv < 10 ? 1 : 0)} visitas/mes${k.trafficValue != null ? ` · valen ${fmtMoney(k.trafficValue)}` : ""}` : "—"],
    ["Demanda", `mensual ${fmtPct(k.trend?.monthly)} · trimestral ${fmtPct(k.trend?.quarterly)} · anual ${fmtPct(k.trend?.yearly)}`],
    ["Pujas Google Ads", k.bidLow != null || k.bidHigh != null ? `${fmtCpc(k.bidLow)} – ${fmtCpc(k.bidHigh)} (parte superior)` : `CPC ${fmtCpc(k.cpc)}${k.competitionIndex != null ? ` · competición ${k.competitionIndex}/100` : ""}`],
    [
      "Para competir",
      bn
        ? `unos ${bn.referringDomains != null ? Math.round(bn.referringDomains) : "?"} dominios y ${bn.backlinks != null ? Math.round(bn.backlinks) : "?"} backlinks de media${bn.dofollow != null ? ` (${Math.round(bn.dofollow)} dofollow)` : ""}${bn.mainDomainRank != null ? ` · autoridad media ${Math.round(bn.mainDomainRank)}` : ""}`
        : "—",
    ],
    [
      "Su página",
      k.pageLinks || k.pageRank != null
        ? `${k.pageLinks?.referringDomains ?? "?"} dominios · ${k.pageLinks?.backlinks ?? "?"} backlinks · autoridad de página ${k.pageRank ?? "?"} / dominio ${k.domainRank ?? "?"}`
        : "—",
    ],
    ["Movimiento", k.isLost ? "ha salido de los resultados" : k.movement ? (k.movement.isNew ? "keyword nueva" : k.movement.previous != null ? `antes #${k.movement.previous}, ahora ${k.position != null ? `#${k.position}` : "—"}` : "sin cambios") : "—"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-1.5">
        {k.title && <p className="text-xs font-medium text-ink">{k.title}</p>}
        {k.description && <p className="text-xs leading-relaxed text-ink-soft">{k.description}</p>}
        {k.url && (
          <a href={k.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent-ink hover:underline">
            <span className="max-w-md truncate">{k.url}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        )}
        {k.url && <OnPageButton projectId={projectId} url={k.url} />}
      </div>
      <div className="space-y-2">
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-ink-faint">{label}</dt>
              <dd className="text-ink-soft">{value}</dd>
            </Fragment>
          ))}
        </dl>
        {(features.length > 0 || k.serpResults != null) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
            <span className="text-[11px] text-ink-faint">SERP{k.serpResults != null ? ` · ${k.serpResults.toLocaleString("es-ES")} resultados` : ""}:</span>
            {features.map((f) => (
              <span key={f} className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-ink-soft">{serpFeatureLabel(f)}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Content gap como TABLA rica: cada fila es accionable — volumen, CPC y
// dificultad para priorizar, y al expandir, el snippet + título + URL con la
// que el competidor posiciona esa keyword (ejemplo de copy). Antes solo se veían
// 3 campos de los 10 que ya pagábamos.
function ContentGapList({
  items,
  contentGapAt,
  projectId,
  title,
  tall = false,
}: {
  items: TopKeyword[];
  contentGapAt: string | null;
  projectId: string;
  title?: string;
  tall?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const q = search.trim().toLowerCase();
  const filtered = q ? items.filter((k) => k.keyword.toLowerCase().includes(q)) : items;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-ink">
          {title ?? "Content gap — posiciona por estas y tú no"} <span className="font-medium text-ink-faint">({items.length})</span>
          {contentGapAt ? ` · ${new Date(contentGapAt).toLocaleDateString("es-ES")}` : ""}
        </p>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar keyword..."
          className="px-3 py-1.5 border border-line rounded-full text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 w-44 bg-surface transition-colors"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-ink-faint">Sin resultados para &laquo;{search}&raquo;.</p>
      ) : (
        <div className={cn("overflow-y-auto border border-line rounded-xl", tall ? "max-h-[420px]" : "max-h-80")}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-background text-left text-ink-faint">
              <tr>
                <th className="py-1.5 pl-2 pr-2 font-medium">Keyword</th>
                <th className="py-1.5 px-2 font-medium text-right" title="Búsquedas al mes">Vol.</th>
                <th className="py-1.5 px-2 font-medium text-right" title="Visitas al mes que recibe el dominio por esta keyword (estimación)">Tráfico</th>
                <th className="py-1.5 px-2 font-medium">Intención</th>
                <th className="py-1.5 px-2 font-medium text-center" title="Estacionalidad de los últimos 12 meses">Estac.</th>
                <th className="py-1.5 px-2 font-medium text-right" title="Variación anual del volumen de búsqueda">Año</th>
                <th className="py-1.5 px-2 font-medium text-right" title="Dificultad SEO real (0-100)">Dif.</th>
                <th className="py-1.5 px-2 font-medium text-right" title="Dominios de referencia que tienen de media las páginas que ya posicionan: lo que hace falta para competir">Enlaces</th>
                <th className="py-1.5 px-2 font-medium text-right">CPC</th>
                <th className="py-1.5 px-2 font-medium text-right">Pos.</th>
                <th className="py-1.5 pr-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => {
                const dif = difficulty(k.difficulty);
                const isOpen = expanded === `${i}-${k.keyword}`;
                return (
                  <Fragment key={i}>
                    <tr className="cursor-pointer border-t border-line hover:bg-background/60" onClick={() => setExpanded(isOpen ? null : `${i}-${k.keyword}`)}>
                      <td className="py-1.5 pl-2 pr-2 font-medium text-ink">{k.keyword}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-ink-soft">{k.volume != null ? k.volume.toLocaleString("es-ES") : "—"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-ink-soft">{k.etv != null ? fmtTraffic(k.etv) : "—"}</td>
                      <td className="py-1.5 px-2"><IntentTag intent={k.intent} /></td>
                      <td className="py-1.5 px-2 text-center"><SeasonalitySparkline points={k.monthlySearches} /></td>
                      <td className="py-1.5 px-2 text-right"><TrendTag trend={k.trend} /></td>
                      <td className="py-1.5 px-2 text-right">
                        <span className={cn("inline-block rounded px-1.5 py-0.5 font-medium", dif.cls)}>{dif.label}</span>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-ink-soft" title="Dominios de referencia medios de las páginas que posicionan">
                        {k.backlinksNeeded?.referringDomains != null ? `~${Math.round(k.backlinksNeeded.referringDomains)}` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-ink-soft">{fmtCpc(k.cpc)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-ink-soft">
                        {k.position != null ? `#${k.position}` : "—"} <MoveTag k={k} />
                      </td>
                      <td className="py-1.5 pl-2 pr-2 text-right text-ink-faint">
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-line bg-accent-tint/40">
                        <td colSpan={11} className="px-3 py-3">
                          <KeywordDetail k={k} projectId={projectId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// % de keywords del dominio que están en top 10 (top 3 + posiciones 4-10).
function top10Share(snapshot: Snapshot): number | null {
  const b = snapshot?.positionBuckets;
  if (!b) return null;
  const total = b.top3 + b.top10 + b.top100;
  return total > 0 ? ((b.top3 + b.top10) / total) * 100 : null;
}

// Variación entre los dos últimos análisis (tráfico), para la pastilla de tendencia.
function trendDelta(points: number[] | undefined): { pct: number; up: boolean } | null {
  if (!points || points.length < 2) return null;
  const prev = points[points.length - 2];
  const last = points[points.length - 1];
  if (prev <= 0) return null;
  const pct = ((last - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return null; // sin cambio real, no se muestra pastilla
  return { pct: Math.abs(pct), up: pct >= 0 };
}

// Top keywords como lista de barras (volumen) con la posición como etiqueta.
function topKeywordBars(keywords: TopKeyword[] | null | undefined, n = 5) {
  return (keywords ?? [])
    .filter((k) => k.keyword)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, n)
    .map((k) => ({
      label: k.keyword,
      value: k.volume ?? 0,
      display: k.volume != null ? k.volume.toLocaleString("es-ES") : "—",
      tag: k.position != null ? `#${k.position}` : undefined,
    }));
}

export default function CompetidoresView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addDomain, setAddDomain] = useState("");
  const [analyzingDomain, setAnalyzingDomain] = useState<string | null>(null);
  const [gapId, setGapId] = useState<string | null>(null);
  // "Analizar todos" / "Gap todos" — procesa en bucle SECUENCIAL (nunca en
  // paralelo: assertWithinSpendLimit es check-then-act, un Promise.all podría
  // saltarse el tope de gasto viendo el mismo acumulado desactualizado) solo
  // los competidores que aún no tengan análisis/gap hecho. Los botones
  // individuales de cada fila no cambian.
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkAnalyzeProgress, setBulkAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkGapping, setBulkGapping] = useState(false);
  const [bulkGapProgress, setBulkGapProgress] = useState<{ done: number; total: number } | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [importNotice, setImportNotice] = useState<{ message: string; studyId: string } | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  // Detalle completo de un dominio: id de competidor o "__own" para el propio.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Al añadir un competidor, analizarlo en el acto (con el coste a la vista).
  const [analyzeOnAdd, setAnalyzeOnAdd] = useState(true);
  // Autoridad/backlinks por dominio (propio + competidores), del módulo Backlinks.
  const [bl, setBl] = useState<Record<string, BlSnap>>({});
  const [removing, setRemoving] = useState(false);
  // Series de tendencia agrupadas por dominio (proyecto + competidores). Una
  // sola llamada a /tendencia (sin ?domain) alimenta TODOS los sparklines en
  // vez de pedir uno por competidor. Antes solo tenía tendencia el dominio
  // propio; ahora cada tarjeta de competidor muestra su evolución.
  const [trendsByDomain, setTrendsByDomain] = useState<Record<string, number[]>>({});
  // Ubicación usada por TODOS los análisis (propio + competidores) y el
  // content gap de esta sesión — DataForSEO Labs también resuelve tráfico y
  // keywords por punto geográfico, no solo a nivel país.
  const [location, setLocation] = useState<LocationValue>(null);

  function load() {
    // Backlinks va en paralelo y sin bloquear: si falla o no hay plan, la
    // comparativa sencillamente no muestra esas columnas.
    fetch(`/api/proyectos/${projectId}/backlinks`)
      .then((r) => r.json())
      .then((d: { projectDomain: string | null; projectSnapshot: BlSnap; competitors: { domain: string; snapshot: BlSnap }[] }) => {
        if (!d || !Array.isArray(d.competitors)) return;
        const m: Record<string, BlSnap> = {};
        if (d.projectDomain) m[d.projectDomain] = d.projectSnapshot ?? null;
        for (const c of d.competitors) m[c.domain] = c.snapshot ?? null;
        setBl(m);
      })
      .catch(() => {});
    return fetch(`/api/proyectos/${projectId}/competidores`)
      .then((r) => r.json())
      .then((d: Data) => {
        if (d && d.competitors) setData(d);
      });
  }

  // Perfil de backlinks de un dominio. Devuelve el mensaje de error (o null) y
  // si se frenó por el tope de gasto, para que los bucles masivos paren.
  async function analyzeBacklinksFor(domain: string): Promise<{ error: string | null; spend: boolean }> {
    try {
      const res = await fetch(`/api/proyectos/${projectId}/backlinks/analizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, limit: BACKLINKS_PER_ANALYSIS }),
      });
      if (res.ok) return { error: null, spend: false };
      const d = await res.json().catch(() => ({}));
      return { error: d.error ?? "No se pudieron analizar los backlinks", spend: res.status === 422 };
    } catch {
      return { error: "No se pudieron analizar los backlinks", spend: false };
    }
  }

  // Recarga las series de tendencia. Sin `domain` → trae TODOS los dominios
  // del proyecto en una sola respuesta y se agrupan aquí en el cliente.
  async function loadTrends(domain?: string) {
    const url = domain
      ? `/api/proyectos/${projectId}/competidores/tendencia?domain=${encodeURIComponent(domain)}`
      : `/api/proyectos/${projectId}/competidores/tendencia`;
    const t = await fetch(url).then((r) => r.json());
    if (!Array.isArray(t)) return;
    const byDomain: Record<string, number[]> = {};
    for (const s of t as { domain: string; organicTraffic: number | null }[]) {
      if (!byDomain[s.domain]) byDomain[s.domain] = [];
      byDomain[s.domain].push(s.organicTraffic ?? 0);
    }
    setTrendsByDomain((prev) => (domain ? { ...prev, ...byDomain } : byDomain));
  }

  useEffect(() => {
    // Carga inicial: visibilidad + TODAS las series de tendencia agrupadas por
    // dominio (proyecto + competidores) en una sola respuesta. El agrupado y
    // el setState viven dentro del .then (patrón async, no marca la regla
    // set-state-in-effect); loadTrends() nominado se reserva para el refresco
    // tras "Analizar", que cuelga de un handler (no de un effect).
    Promise.all([
      load(),
      fetch(`/api/proyectos/${projectId}/competidores/tendencia`).then((r) => r.json()),
    ]).then(([, t]) => {
      if (Array.isArray(t)) {
        const byDomain: Record<string, number[]> = {};
        for (const s of t as { domain: string; organicTraffic: number | null }[]) {
          if (!byDomain[s.domain]) byDomain[s.domain] = [];
          byDomain[s.domain].push(s.organicTraffic ?? 0);
        }
        setTrendsByDomain(byDomain);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/competidores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: addDomain }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "Error al añadir");
      return;
    }
    const added: string = d.domain ?? addDomain;
    setAddDomain("");
    setAddOpen(false);
    await load();
    // Análisis completo en el acto (visibilidad + backlinks), con el coste que
    // se mostró en el propio modal.
    if (analyzeOnAdd) await handleAnalyze(added);
  }

  async function handleAnalyze(domain: string) {
    setError("");
    setAnalyzingDomain(domain);
    const res = await fetch(`/api/proyectos/${projectId}/competidores/analizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, locationCode: location?.code }),
    });
    const d = await res.json();
    if (!res.ok) {
      setAnalyzingDomain(null);
      setError(d.error ?? "Error al analizar");
      return;
    }
    // Mismo botón, segunda mitad: autoridad y backlinks del dominio.
    const blResult = await analyzeBacklinksFor(domain);
    setAnalyzingDomain(null);
    if (blResult.error) setError(`Visibilidad analizada, pero los backlinks no: ${blResult.error}`);
    await load();
    // refresca la tendencia del dominio recién analizado (el propio o un
    // competidor) para que su sparkline se actualice al momento.
    await loadTrends(domain);
  }

  async function handleGap(competitorId: string) {
    setError("");
    setGapId(competitorId);
    const res = await fetch(`/api/proyectos/${projectId}/competidores/${competitorId}/content-gap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationCode: location?.code }),
    });
    const d = await res.json();
    setGapId(null);
    if (!res.ok) {
      setError(d.error ?? "Error al calcular content gap");
      return;
    }
    load();
  }

  async function handleAnalyzeAll() {
    const pending = (data?.competitors ?? []).filter((c) => !hasUsefulSnapshot(c.snapshot) || !bl[c.domain]);
    if (pending.length === 0 || bulkAnalyzing) return;
    setError("");
    setBulkAnalyzing(true);
    setBulkAnalyzeProgress({ done: 0, total: pending.length });

    let failures = 0;
    let stoppedForSpend = false;
    for (const c of pending) {
      setAnalyzingDomain(c.domain);
      try {
        // Solo se paga lo que falta de cada competidor: visibilidad y/o backlinks.
        if (!hasUsefulSnapshot(c.snapshot)) {
          const res = await fetch(`/api/proyectos/${projectId}/competidores/analizar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: c.domain, locationCode: location?.code }),
          });
          if (!res.ok) {
            if (res.status === 422) {
              stoppedForSpend = true;
              break; // tope de gasto — seguir repetiría el mismo fallo en los demás
            }
            failures++;
            setBulkAnalyzeProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
            continue;
          }
        }
        if (!bl[c.domain]) {
          const r = await analyzeBacklinksFor(c.domain);
          if (r.spend) {
            stoppedForSpend = true;
            break;
          }
          if (r.error) failures++;
        }
      } catch {
        // Fallo de red: no dejamos el botón bloqueado, se cuenta como error
        // y se sigue con el siguiente competidor.
        failures++;
      }
      setBulkAnalyzeProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (stoppedForSpend) {
      setError("Tope de gasto alcanzado — se detiene «Analizar todos». Lo ya completado se ha guardado.");
    } else if (failures > 0) {
      setError(`${failures} competidor(es) fallaron al analizar — puedes reintentar con «Analizar todos» o su botón individual.`);
    }

    setAnalyzingDomain(null);
    setBulkAnalyzing(false);
    setBulkAnalyzeProgress(null);
    await load();
    await loadTrends();
  }

  async function handleGapAll() {
    const pending = (data?.competitors ?? []).filter((c) => !c.contentGap || c.contentGap.length === 0);
    if (pending.length === 0 || bulkGapping) return;
    setError("");
    setBulkGapping(true);
    setBulkGapProgress({ done: 0, total: pending.length });

    let failures = 0;
    let stoppedForSpend = false;
    for (const c of pending) {
      setGapId(c.id);
      try {
        const res = await fetch(`/api/proyectos/${projectId}/competidores/${c.id}/content-gap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationCode: location?.code }),
        });
        if (!res.ok) {
          if (res.status === 422) {
            stoppedForSpend = true;
            break;
          }
          failures++;
        }
      } catch {
        failures++;
      }
      setBulkGapProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (stoppedForSpend) {
      setError("Tope de gasto alcanzado — se detiene «Gap todos». Lo ya completado se ha guardado.");
    } else if (failures > 0) {
      setError(`${failures} competidor(es) fallaron al calcular el gap — puedes reintentar con «Gap todos» o su botón individual.`);
    }

    setGapId(null);
    setBulkGapping(false);
    setBulkGapProgress(null);
    await load();
  }

  async function handleRemove(competitorId: string) {
    setRemoving(true);
    await fetch(`/api/proyectos/${projectId}/competidores/${competitorId}`, { method: "DELETE" });
    setRemoving(false);
    setConfirmRemoveId(null);
    load();
  }

  // Recoge las keywords únicas de un competidor (content gap優先, complementado
  // con sus top keywords), con todas sus métricas ya resueltas — no solo el
  // texto. Es la materia prima para "importar a estudio" (gratis, ver abajo)
  // o "añadir a seguimiento": fricción cero para llevar la inteligencia del
  // competidor a los módulos donde se trabaja, sin copiar a mano.
  type CollectedKeyword = {
    keyword: string;
    volume: number | null;
    competition: string | null;
    cpc: number | null;
    monthlySearches: number[] | null;
    difficulty: number | null;
  };
  function collectKeywords(c: Competitor): CollectedKeyword[] {
    const seen = new Set<string>();
    const out: CollectedKeyword[] = [];
    const sources = [c.contentGap ?? [], c.snapshot?.topKeywords ?? []];
    for (const arr of sources) {
      for (const k of arr) {
        const kw = k.keyword?.trim();
        if (kw && !seen.has(kw)) {
          seen.add(kw);
          out.push({
            keyword: kw,
            volume: k.volume,
            competition: k.competition,
            cpc: k.cpc,
            monthlySearches: k.monthlySearches,
            difficulty: k.difficulty,
          });
        }
      }
    }
    return out;
  }

  function showNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 5000);
  }

  // Lleva las keywords del competidor (content gap + top) al estudio
  // "General" único del proyecto, con las métricas YA resueltas
  // (volumen/competencia/CPC/estacionalidad, pagadas por el análisis de
  // competidores) — a diferencia de antes, no se vuelve a consultar
  // DataForSEO: coste cero.
  async function handleImportToStudy(c: Competitor) {
    const keywords = collectKeywords(c);
    if (keywords.length === 0) {
      showNotice("Este competidor no tiene keywords todavía.");
      return;
    }
    setImportingId(c.id);
    // Propaga la ubicación real con la que se analizó (el LocationPicker de
    // arriba) — si no, el endpoint cachearía este volumen bajo la ubicación
    // del estudio "General" (siempre es/2724), mezclando datos de una
    // ubicación local con la clave nacional del caché compartido.
    const result = await importKeywordsToDefaultStudy(projectId, `Competidor ${c.domain}`, keywords, {
      locationCode: location?.code ?? 2724,
      languageCode: "es",
    });
    setImportingId(null);
    if (!result.ok) {
      showNotice(result.error);
      return;
    }
    setImportNotice({
      message: `${result.added} keywords de ${c.domain} añadidas al estudio General (sin coste adicional).`,
      studyId: result.studyId,
    });
  }

  // Añade las keywords del competidor a Rank Tracking (frecuencia manual, no
  // gasta solo). Reutiliza POST /rank/keywords (bulk).
  async function handleAddToTracking(c: Competitor) {
    const keywords = collectKeywords(c);
    if (keywords.length === 0) {
      showNotice("Este competidor no tiene keywords todavía.");
      return;
    }
    setTrackingId(c.id);
    const res = await fetch(`/api/proyectos/${projectId}/rank/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: keywords.map((k) => k.keyword).join("\n"),
        device: "desktop",
        frequency: "manual",
        depth: 10,
        locationCode: location?.code,
        group: `Competidores (${c.domain})`,
      }),
    });
    const d = await res.json();
    setTrackingId(null);
    if (!res.ok) {
      showNotice(d.error ?? "Error al añadir a seguimiento");
      return;
    }
    showNotice(`${d.added ?? 0} añadidas a seguimiento${d.skipped ? ` · ${d.skipped} ya seguidas` : ""} (manual — pulsa «Comprobar» para ver posición).`);
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />;

  // Comparativa arriba del todo (mismo patrón que Backlinks): proyecto +
  // todos los competidores trackeados, analizados o no, para ver de un
  // vistazo cómo se está frente a la competencia sin abrir cada tarjeta.
  const comparisonRows = [
    ...(data?.projectDomain ? [{ domain: data.projectDomain, snapshot: data.projectSnapshot, isOwn: true }] : []),
    ...(data?.competitors.map((c) => ({ domain: c.domain, snapshot: c.snapshot, isOwn: false })) ?? []),
  ].sort((a, b) => (b.snapshot?.organicTraffic ?? -1) - (a.snapshot?.organicTraffic ?? -1));
  // Resumen de cabecera: lo primero que se lee es dónde estás frente a la competencia.
  const competitorsTotal = data?.competitors.length ?? 0;
  const competitorsAnalyzed = data?.competitors.filter((c) => hasUsefulSnapshot(c.snapshot)).length ?? 0;
  const maxTraffic = Math.max(1, ...comparisonRows.map((r) => (hasUsefulSnapshot(r.snapshot) ? r.snapshot?.organicTraffic ?? 0 : 0)));
  const leader = comparisonRows.find((r) => !r.isOwn && hasUsefulSnapshot(r.snapshot)) ?? null;


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Módulo · Competidores"
        title="Competidores"
        description="Todo lo de un competidor en un sitio: tráfico y keywords estimados, autoridad y backlinks, y el content gap con CPC, dificultad y el snippet con el que posicionan."
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            <Plus className="h-4 w-4" /> Añadir competidor
          </button>
        }
      />

      {/* Ajustes de la sesión en una sola barra: la ubicación se aplica a
          Analizar y Gap (un negocio local no compite igual a nivel nacional
          que en su ciudad) y a la derecha, lo que cuesta cada acción. */}
      <Toolbar
        aside={
          <>
            <span>Cada acción gasta:</span>
            <span className="inline-flex items-center gap-1.5" title={`Visibilidad ${fmtCredits(visibilityCost)} + backlinks ${fmtCredits(backlinksCost)}`}>Analizar (visibilidad + backlinks) <strong className="text-ink">{fmtCredits(analyzeCost)}</strong></span>
            <span className="inline-flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-ink-faint" /> Content gap <strong className="text-ink">{fmtCredits(gapCost)}</strong></span>
          </>
        }
      >
        <span className="text-sm font-semibold text-ink-soft">Ubicación</span>
        <div className="w-72">
          <LocationPicker value={location} onChange={setLocation} />
        </div>
        <span className="text-xs text-ink-faint">Sin elegir nada, España (nacional).</span>
      </Toolbar>

      {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>}
      {notice && <p className="text-sm text-accent-ink bg-accent-tint px-3 py-2 rounded-lg">{notice}</p>}
      {importNotice && (
        <ImportSuccessNotice
          message={importNotice.message}
          projectId={projectId}
          studyId={importNotice.studyId}
          onDismiss={() => setImportNotice(null)}
        />
      )}

      {/* Resumen: tu posición de un vistazo */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          highlight
          label="Tu tráfico orgánico"
          icon={<Target className="h-4 w-4" />}
          value={data?.projectSnapshot && hasUsefulSnapshot(data.projectSnapshot) ? fmtTraffic(data.projectSnapshot.organicTraffic) : "—"}
          hint="visitas al mes (estimación)"
        />
        <StatTile
          label="Tus keywords orgánicas"
          value={data?.projectSnapshot && hasUsefulSnapshot(data.projectSnapshot) ? data.projectSnapshot.organicKeywords?.toLocaleString("es-ES") ?? "—" : "—"}
          hint="posicionadas en Google"
        />
        <StatTile
          label="Competidores analizados"
          value={<>{competitorsAnalyzed}<span className="text-xl font-bold text-ink-faint"> / {competitorsTotal}</span></>}
          hint={competitorsTotal === 0 ? "añade tu primer competidor" : competitorsTotal - competitorsAnalyzed > 0 ? `${competitorsTotal - competitorsAnalyzed} pendientes de analizar` : "todos al día"}
        />
        <StatTile
          label="Líder entre tus competidores"
          value={leader ? fmtTraffic(leader.snapshot?.organicTraffic) : "—"}
          hint={leader ? leader.domain : "analiza alguno para compararte"}
        />
      </div>

      {comparisonRows.length > 1 && (
        <Section
          title="Comparativa frente a la competencia"
          description="Tráfico orgánico estimado y fuerza de cada dominio."
          flush
          actions={
            <>
          {data && data.competitors.length > 0 && (() => {
              const pendingAnalyze = data.competitors.filter((c) => !hasUsefulSnapshot(c.snapshot) || !bl[c.domain]).length;
              const pendingGap = data.competitors.filter((c) => !c.contentGap || c.contentGap.length === 0).length;
              return (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleAnalyzeAll}
                    disabled={pendingAnalyze === 0 || bulkAnalyzing}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                  >
                    {bulkAnalyzing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {bulkAnalyzeProgress ? `Analizando ${bulkAnalyzeProgress.done}/${bulkAnalyzeProgress.total}…` : `Analizar todos${pendingAnalyze > 0 ? ` (${pendingAnalyze})` : ""}`}
                  </button>
                  <button
                    onClick={handleGapAll}
                    disabled={pendingGap === 0 || bulkGapping}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                  >
                    {bulkGapping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                    {bulkGapProgress ? `Content gap ${bulkGapProgress.done}/${bulkGapProgress.total}…` : `Gap todos${pendingGap > 0 ? ` (${pendingGap})` : ""}`}
                  </button>
                </div>
              );
            })()}
              </>
          }
        >
          <div>
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Dominio</th>
                  <th className="w-[20%]">Tráfico estimado</th>
                  <th className="num">Keywords</th>
                  <th className="num" title="Lo que costaría ese tráfico comprándolo en Google Ads">Valor del tráfico</th>
                  <th title="Keywords nuevas (+), que suben (▲), que bajan (▼) y perdidas (−) desde la medición anterior">Movimiento</th>
                  <th>Fuerza del dominio</th>
                  <th className="num" title="Autoridad del dominio (0-1000), del análisis de backlinks">Autoridad</th>
                  <th className="num">Backlinks</th>
                  <th className="num">Dom. ref.</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((r, i) => {
                  const useful = hasUsefulSnapshot(r.snapshot);
                  const traffic = r.snapshot?.organicTraffic ?? 0;
                  return (
                    <tr key={i}>
                      <td className="font-semibold">
                        {r.domain} {r.isOwn && <Pill tone="brand" className="ml-1.5">Tú</Pill>}
                      </td>
                      {useful ? (
                        <>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="w-14 shrink-0 font-semibold tabular-nums">{fmtTraffic(r.snapshot?.organicTraffic)}</span>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-50">
                                <div
                                  className={cn("h-full rounded-full", r.isOwn ? "bg-brand-500" : "bg-brand-200")}
                                  style={{ width: `${Math.max(3, (traffic / maxTraffic) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="num text-ink-soft">{r.snapshot?.organicKeywords?.toLocaleString("es-ES") ?? "—"}</td>
                          <td className="num text-ink-soft">{fmtMoney(r.snapshot?.trafficValue)}</td>
                          <td><MovementBadges movement={r.snapshot?.movement} /></td>
                          <td>
                            {r.snapshot?.positionBuckets ? (
                              <PositionDistribution buckets={r.snapshot.positionBuckets} avgPosition={r.snapshot.avgPosition} />
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td colSpan={5}>
                          <Pill tone="neutral">Sin analizar</Pill>
                        </td>
                      )}
                      <td className="num font-semibold">{bl[r.domain]?.rank ?? <span className="font-normal text-ink-faint">—</span>}</td>
                      <td className="num text-ink-soft">{bl[r.domain]?.backlinksTotal?.toLocaleString("es-ES") ?? "—"}</td>
                      <td className="num text-ink-soft">{bl[r.domain]?.referringDomains?.toLocaleString("es-ES") ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Tu visibilidad + alta de competidores, lado a lado */}
      <div className="grid gap-4">
        <Section
          title={`Tu visibilidad${data?.projectDomain ? ` · ${data.projectDomain}` : ""}`}
          actions={
            <>
            {data?.projectSnapshot && (
              <button onClick={() => setDetailId("__own")} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-50">
                Ver todo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => data?.projectDomain && handleAnalyze(data.projectDomain)}
              disabled={!data?.projectDomain || analyzingDomain === data?.projectDomain}
              className="flex items-center gap-2 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
              title={`Coste estimado ${fmtCredits(analyzeCost)}`}
            >
              {analyzingDomain === data?.projectDomain && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Analizar <span className="font-normal text-white/70">{fmtCredits(analyzeCost)}</span>
            </button>
            </>
          }
        >
          {!data?.projectDomain ? (
            <p className="flex items-center gap-1.5 text-sm text-accent-ink">
              <AlertTriangle className="h-4 w-4" /> Define el dominio del proyecto en su ficha para analizar su visibilidad.
            </p>
          ) : !data?.projectSnapshot || !hasUsefulSnapshot(data.projectSnapshot) ? (
            <p className="text-sm text-ink-soft">Aún no hay datos de tu dominio. Pulsa <strong>Analizar</strong> para ver tu tráfico y tus keywords.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-[13px] font-semibold text-ink-soft">Evolución del tráfico</p>
                <div className="mt-3">
                  {(trendsByDomain[data.projectDomain]?.length ?? 0) >= 2 ? (
                    <>
                      <AreaSpark points={trendsByDomain[data.projectDomain]} />
                      <p className="mt-1 text-[11px] text-ink-faint">{trendsByDomain[data.projectDomain].length} análisis</p>
                    </>
                  ) : (
                    <p className="text-xs text-ink-faint">La tendencia aparece con el segundo análisis.</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-start gap-3">
                <p className="text-[13px] font-semibold text-ink-soft">Fuerza del dominio</p>
                {top10Share(data.projectSnapshot) !== null ? (
                  <div className="flex items-center gap-4">
                    <RadialGauge value={top10Share(data.projectSnapshot) as number} label="en top 10" />
                    <div className="w-full min-w-[120px]">
                      <PositionDistribution buckets={data.projectSnapshot.positionBuckets} avgPosition={data.projectSnapshot.avgPosition} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint">Sin distribución de posiciones todavía.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink-soft">Tus keywords principales</p>
                {topKeywordBars(data.projectSnapshot.topKeywords).length > 0 ? (
                  <BarList items={topKeywordBars(data.projectSnapshot.topKeywords)} />
                ) : (
                  <p className="text-xs text-ink-faint">Sin keywords todavía.</p>
                )}
              </div>
            </div>
          )}
        </Section>

      </div>

      {/* Competidores: tarjetas compactas en rejilla */}
      {data?.competitors.length === 0 && <p className="text-sm text-ink-soft">Aún no hay competidores. Añade uno para espiar su visibilidad.</p>}
      <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {data?.competitors.map((c) => {
          const useful = hasUsefulSnapshot(c.snapshot);
          const trend = trendsByDomain[c.domain];
          const delta = trendDelta(trend);
          const share = top10Share(c.snapshot);
          const bars = topKeywordBars(c.snapshot?.topKeywords, 4);
          const gapCount = c.contentGap?.length ?? 0;
          return (
            <section key={c.id} className="flex flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => setDetailId(c.id)} className="block max-w-full truncate text-left text-[15px] font-bold text-ink hover:text-brand">
                    {c.domain}
                  </button>
                  <p className="text-xs text-ink-faint">
                    {c.snapshot ? `Analizado el ${new Date(c.snapshot.fetchedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}` : "Sin analizar"}
                  </p>
                </div>
                <button onClick={() => setConfirmRemoveId(c.id)} className="shrink-0 rounded-full p-1.5 text-ink-faint hover:bg-alert-tint hover:text-alert-ink" title="Dejar de seguir">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {useful ? (
                <>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">{fmtTraffic(c.snapshot?.organicTraffic)}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
                        visitas/mes
                        {delta && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", delta.up ? "bg-accent-tint text-accent-ink" : "bg-surface-muted text-ink-soft")}>
                            {delta.up ? "▲" : "▼"} {delta.pct.toFixed(0)} %
                          </span>
                        )}
                      </p>
                    </div>
                    {share !== null && <RadialGauge value={share} size={72} label="en top 10" />}
                  </div>

                  {trend && trend.length >= 2 && Math.max(...trend) > Math.min(...trend) && <AreaSpark points={trend} height={44} className="mt-3" />}

                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                    <div>
                      <dt className="text-xs text-ink-faint">Keywords</dt>
                      <dd className="font-bold tabular-nums text-ink">{c.snapshot?.organicKeywords?.toLocaleString("es-ES") ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Valor del tráfico</dt>
                      <dd className="font-bold tabular-nums text-ink">{fmtMoney(c.snapshot?.trafficValue)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-ink-faint">Movimiento de keywords</dt>
                      <dd className="text-sm font-semibold"><MovementBadges movement={c.snapshot?.movement} /></dd>
                    </div>
                  </dl>

                  {c.snapshot?.positionBuckets && (
                    <div className="mt-4">
                      <PositionDistribution buckets={c.snapshot.positionBuckets} avgPosition={null} />
                    </div>
                  )}

                  {bars.length > 0 && (
                    <div className="mt-4 border-t border-line pt-4">
                      <p className="mb-2 text-xs font-semibold text-ink-soft">Sus keywords principales</p>
                      <BarList items={bars} />
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
                  {c.snapshot
                    ? "No hemos encontrado presencia orgánica medible (normal en dominios pequeños o nuevos)."
                    : "Aún no hay datos. Analízalo para ver su tráfico y sus keywords."}
                </p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                <button
                  onClick={() => handleAnalyze(c.domain)}
                  disabled={analyzingDomain === c.domain}
                  className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
                  title={`Visibilidad + backlinks · ${fmtCredits(analyzeCost)}`}
                >
                  {analyzingDomain === c.domain && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Analizar
                </button>
                {gapCount > 0 ? (
                  <button
                    onClick={() => setDetailId(c.id)}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted"
                  >
                    <Target className="h-3.5 w-3.5" /> Content gap · {gapCount}
                  </button>
                ) : (
                  <button
                    onClick={() => handleGap(c.id)}
                    disabled={gapId === c.id}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                    title={`Content gap · ${fmtCredits(gapCost)}`}
                  >
                    {gapId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                    Content gap
                  </button>
                )}
                {c.snapshot && (
                  <button
                    onClick={() => setDetailId(c.id)}
                    className="ml-auto flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-brand hover:bg-brand-50"
                  >
                    Ver detalle <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {collectKeywords(c).length > 0 && (
                  <>
                    <button
                      onClick={() => handleImportToStudy(c)}
                      disabled={importingId === c.id}
                      className="rounded-full border border-line p-1.5 text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                      title={`Importar sus ${collectKeywords(c).length} keywords a un estudio`}
                    >
                      {importingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleAddToTracking(c)}
                      disabled={trackingId === c.id}
                      className="rounded-full border border-line p-1.5 text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                      title="Añadir sus keywords a Rank Tracking"
                    >
                      {trackingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Detalle completo de un dominio: todo lo que trae el análisis (para
          informes y trabajo fino), sin cargar la vista de tarjetas. */}
      {(() => {
        const isOwn = detailId === "__own";
        const comp = isOwn ? null : data?.competitors.find((x) => x.id === detailId) ?? null;
        const domain = isOwn ? data?.projectDomain ?? "" : comp?.domain ?? "";
        const snap: Snapshot = isOwn ? data?.projectSnapshot ?? null : comp?.snapshot ?? null;
        const trend = domain ? trendsByDomain[domain] : undefined;
        const share = top10Share(snap);
        return (
          <Modal open={detailId !== null && !!domain} title={isOwn ? `Tu dominio · ${domain}` : domain} onClose={() => setDetailId(null)} wide>
            {snap ? (
              <div className="space-y-6">
                <p className="text-xs text-ink-faint">
                  Último análisis: {new Date(snap.fetchedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { l: "Tráfico orgánico", v: fmtTraffic(snap.organicTraffic), h: "visitas/mes (estimación)" },
                    { l: "Keywords orgánicas", v: snap.organicKeywords?.toLocaleString("es-ES") ?? "—", h: "posicionadas en Google" },
                    { l: "Valor del tráfico", v: fmtMoney(snap.trafficValue), h: "lo que costaría en Google Ads" },
                  ].map((k) => (
                    <div key={k.l} className="rounded-2xl border border-line p-4">
                      <p className="text-xs font-semibold text-ink-soft">{k.l}</p>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{k.v}</p>
                      <p className="text-[11px] text-ink-faint">{k.h}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-center rounded-2xl border border-line p-3">
                    {share !== null ? <RadialGauge value={share} size={76} label="keywords en top 10" /> : <span className="text-xs text-ink-faint">Sin distribución</span>}
                  </div>
                </div>

                <div className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">Autoridad y backlinks</p>
                    <Link href={`/app/proyectos/${projectId}/competidores/backlinks`} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                      Ver todos los backlinks <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {bl[domain] ? (
                    <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {[
                        { l: "Autoridad", v: bl[domain]?.rank ?? "—" },
                        { l: "Backlinks", v: bl[domain]?.backlinksTotal?.toLocaleString("es-ES") ?? "—" },
                        { l: "Dominios de referencia", v: bl[domain]?.referringDomains?.toLocaleString("es-ES") ?? "—" },
                        { l: "Backlinks rotos", v: bl[domain]?.brokenBacklinks?.toLocaleString("es-ES") ?? "—" },
                      ].map((k) => (
                        <div key={k.l}>
                          <p className="text-xs text-ink-faint">{k.l}</p>
                          <p className="text-xl font-extrabold tabular-nums text-ink">{k.v}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ink-soft">Aún sin backlinks analizados: pulsa <strong>Analizar</strong> en su ficha.</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-line p-4">
                    <p className="text-sm font-semibold text-ink">Evolución del tráfico</p>
                    {trend && trend.length >= 2 && Math.max(...trend) > Math.min(...trend) ? (
                      <>
                        <AreaSpark points={trend} height={90} className="mt-3" />
                        <p className="mt-1 text-[11px] text-ink-faint">{trend.length} análisis · de {fmtTraffic(trend[0])} a {fmtTraffic(trend[trend.length - 1])}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-ink-faint">Sin cambios entre análisis todavía.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-line p-4">
                    <p className="mb-3 text-sm font-semibold text-ink">Distribución de posiciones</p>
                    {snap.positionBuckets ? (
                      <PositionDistribution buckets={snap.positionBuckets} avgPosition={snap.avgPosition} />
                    ) : (
                      <p className="text-xs text-ink-faint">Sin distribución de posiciones.</p>
                    )}
                  </div>
                </div>

                {(snap.movement || snap.paid) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-line p-4">
                      <p className="text-sm font-semibold text-ink">Movimiento de keywords</p>
                      <p className="mt-0.5 text-xs text-ink-faint">Desde la medición anterior de Google.</p>
                      {snap.movement ? (
                        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                          {([["Nuevas", snap.movement.new, "text-brand"], ["Suben", snap.movement.up, "text-brand"], ["Bajan", snap.movement.down, "text-alert-ink"], ["Perdidas", snap.movement.lost, "text-alert-ink"]] as const).map(([l, n, cls]) => (
                            <div key={l}>
                              <p className={cn("text-2xl font-extrabold tabular-nums", n > 0 ? cls : "text-ink-faint")}>{n}</p>
                              <p className="text-[11px] text-ink-faint">{l}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-ink-faint">Sin datos de movimiento.</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-line p-4">
                      <p className="text-sm font-semibold text-ink">Anuncios de pago</p>
                      <p className="mt-0.5 text-xs text-ink-faint">Keywords por las que este dominio paga en Google Ads.</p>
                      {snap.paid ? (
                        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div><dd className="text-2xl font-extrabold tabular-nums text-ink">{snap.paid.keywords?.toLocaleString("es-ES") ?? "—"}</dd><dt className="text-[11px] text-ink-faint">keywords</dt></div>
                          <div><dd className="text-2xl font-extrabold tabular-nums text-ink">{fmtTraffic(snap.paid.traffic)}</dd><dt className="text-[11px] text-ink-faint">visitas/mes</dt></div>
                          <div><dd className="text-2xl font-extrabold tabular-nums text-ink">{fmtMoney(snap.paid.cost)}</dd><dt className="text-[11px] text-ink-faint">inversión est.</dt></div>
                        </dl>
                      ) : (
                        <p className="mt-2 text-xs text-ink-faint">No detectamos anuncios de pago.</p>
                      )}
                    </div>
                  </div>
                )}

                {snap.topKeywords && snap.topKeywords.length > 0 && (
                  <ContentGapList
                    items={snap.topKeywords}
                    contentGapAt={null}
                    projectId={projectId}
                    title={isOwn ? "Keywords por las que posicionas" : "Keywords por las que posiciona"}
                    tall
                  />
                )}

                {comp && (
                  comp.contentGap && comp.contentGap.length > 0 ? (
                    <ContentGapList items={comp.contentGap} contentGapAt={comp.contentGapAt} projectId={projectId} tall />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3">
                      <p className="text-sm text-ink-soft">Aún no has calculado el content gap con este competidor.</p>
                      <button
                        onClick={() => handleGap(comp.id)}
                        disabled={gapId === comp.id}
                        className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
                      >
                        {gapId === comp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                        Calcular content gap <span className="font-normal text-white/70">{fmtCredits(gapCost)}</span>
                      </button>
                    </div>
                  )
                )}

                {comp && collectKeywords(comp).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    <button
                      onClick={() => handleImportToStudy(comp)}
                      disabled={importingId === comp.id}
                      className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                    >
                      {importingId === comp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
                      Importar a estudio
                    </button>
                    <button
                      onClick={() => handleAddToTracking(comp)}
                      disabled={trackingId === comp.id}
                      className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                    >
                      {trackingId === comp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                      Añadir a seguimiento
                    </button>
                    <span className="text-xs text-ink-faint">{collectKeywords(comp).length} keywords</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Aún no hay análisis de este dominio.</p>
            )}
          </Modal>
        );
      })()}

      <Modal open={addOpen} title="Añadir competidor" onClose={() => setAddOpen(false)}>
        <div className="space-y-1">
          <p className="text-sm text-ink-soft">Escribe el dominio de un competidor para seguirlo y compararte con él.</p>
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              type="text"
              value={addDomain}
              onChange={(e) => setAddDomain(e.target.value)}
              placeholder="competidor.com"
              required
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            <button type="submit" className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
              <Plus className="h-4 w-4" /> Añadir
            </button>
          </form>
          <label className="flex items-start gap-2 pt-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={analyzeOnAdd}
              onChange={(e) => setAnalyzeOnAdd(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Analizarlo ahora: tráfico, keywords, autoridad y backlinks{" "}
              <strong className="text-ink">{fmtCredits(analyzeCost)}</strong>
              <span className="block text-xs text-ink-faint">El content gap se pide aparte, desde su ficha.</span>
            </span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRemoveId !== null}
        title="¿Dejar de trackear este competidor?"
        description="Se borra su histórico de visibilidad y content gap guardados. No se puede deshacer."
        busy={removing}
        onCancel={() => setConfirmRemoveId(null)}
        onConfirm={() => confirmRemoveId && handleRemove(confirmRemoveId)}
      />
    </div>
  );
}
