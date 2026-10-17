"use client";

import { usdToCredits } from "@/lib/credits";
import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, FileText, Gauge, Target, Search,
  MapPin, Wallet, Quote, ClipboardCheck, Network, Type, Code2, PenLine, Globe, GitBranch, Hash, Anchor,
} from "lucide-react";
import GeogridMap from "@/components/app/GeogridMap";
import PositionDistribution, { type PositionBuckets } from "@/components/app/PositionDistribution";
import SectionOrderList from "@/components/app/SectionOrderList";
import Pill from "@/components/app/Pill";
import { cn } from "@/lib/utils";
import PrintButton from "./PrintButton";
import SharePanel, { type ShareState } from "./SharePanel";
import { splitManualTask } from "@/lib/tasks";
import { ISSUE_META } from "@/lib/audit/issue-meta";
import {
  type ReportSections, type SectionKey,
} from "@/lib/informe/sections";
import type { StructureTreeNode } from "@/lib/keywords/structure-tree";

export type { ReportSections, SectionKey } from "@/lib/informe/sections";

// categoryScores tal cual lo genera src/lib/audit/scoring.ts (Json en BD).
type CategoryScore = { score: number; max: number; detail: Record<string, number> };
export type CategoryScores = {
  indexabilidad: CategoryScore;
  enlaces: CategoryScore;
  onpage: CategoryScore;
  rendimiento: CategoryScore | null;
  accesibilidadImagenes: CategoryScore;
};

// Item enriquecido de keyword (visibilidad o content gap). Los campos extra
// llegan gratis en el mismo SERP/Labs que ya se pagó; vienen de snapshots
// nuevos. Los opcionales (? ) cubren los snapshots/items viejos que solo
// tenían {keyword, position, volume}.
export type TopKeyword = {
  keyword: string;
  position: number | null;
  volume: number | null;
  competition?: string | null; // HIGH | MEDIUM | LOW
  competitionIndex?: number | null; // 0-100
  cpc?: number | null;
  monthlySearches?: number[] | null;
  title?: string | null;
  url?: string | null;
  description?: string | null;
};

export type ReportData = {
  project: { name: string; domain: string | null; isLocalBusiness: boolean };
  monthLabel: string;
  generationDate: string;
  isCurrentMonth: boolean;
  prevHref: string;
  nextHref: string | null;
  tasks: { id: string; text: string; issueType: string | null; affectedUrls: string[]; completedAt: Date | null }[];
  audit: { overallScore: number | null; categoryScores: CategoryScores | null; pagesCrawled: number; completedAt: Date | null } | null;
  authority: { impressions: number; clicks: number; queries: number; position: number; month: string } | null;
  rank: {
    keywords: { keyword: string; device: string; lastPosition: number | null; bestPosition: number | null; lastCheckedAt: Date | null; trend: "up" | "down" | "same" | null }[];
    topRank: { keyword: string; device: string; lastPosition: number | null; bestPosition: number | null; lastCheckedAt: Date | null; trend: "up" | "down" | "same" | null }[];
    rankedCount: number;
  };
  keywords: {
    studyCount: number;
    keywordTotal: number;
    // Top N del estudio "General" (Punto 4) por prioridad — antes esta
    // sección solo mostraba totales, ni una keyword listada.
    top: { keyword: string; searchVolume: number | null; difficulty: number | null; priority: number }[];
  };
  arquitectura: { tree: StructureTreeNode; pageCount: number; updatedAt: Date } | null;
  "titulos-meta": { url: string; variants: { title: string; description: string }[]; createdAt: Date }[];
  schema: { url: string; selectedType: string; valid: boolean; createdAt: Date }[];
  contenido: { topic: string; model: string | null; createdAt: Date }[];
  google: {
    month: string; rangeDays: number;
    totals: { clicks: number; impressions: number; ctr: number; position: number };
    topQueries: { query: string; clicks: number; position: number }[];
    // GA4 — antes ausente por completo del informe pese a estar ya
    // persistido por el panel de Analytics (Ga4Snapshot).
    ga4: { sessions: number; conversions: number; topChannels: { channel: string; sessions: number }[] } | null;
  } | null;
  canibalizaciones: { count: number; top: { query: string; urls: number; clicks: number }[] } | null;
  geogrid: {
    keyword: string; gridSize: number; radiusKm: number; centerLat: number; centerLng: number;
    foundCount: number | null; averagePosition: number | null;
    points: { row: number; col: number; lat: number; lng: number; position: number | null }[] | null;
    completedAt: Date | null;
  } | null;
  costs: { monthCost: number };
  links: { pages: { url: string; pagerank: number; incoming: number; outgoing: number }[]; orphans: string[]; topHubs: string[]; auditDate: Date | null } | null;
  competitors: {
    own: { organicTraffic: number | null; organicKeywords: number | null; positionBuckets: PositionBuckets | null; avgPosition: number | null; topKeywords: TopKeyword[] | null; fetchedAt: Date | null } | null;
    items: {
      domain: string;
      organicTraffic: number | null;
      organicKeywords: number | null;
      positionBuckets: PositionBuckets | null;
      avgPosition: number | null;
      topKeywords: TopKeyword[] | null;
      contentGap: TopKeyword[] | null;
      contentGapAt: Date | null;
      fetchedAt: Date | null;
    }[];
  };
  // Antes ausente por completo del informe — el módulo entero (autoridad,
  // backlinks totales, rotos) no llegaba pese a existir BacklinkSnapshot.
  backlinks: {
    own: { rank: number | null; backlinksTotal: number | null; referringDomains: number | null; brokenBacklinks: number | null; fetchedAt: Date | null } | null;
    competitors: { domain: string; rank: number | null; backlinksTotal: number | null; referringDomains: number | null }[];
  } | null;
  // Visibilidad en IA: última comprobación de cada pregunta seguida por asistente.
  ia: {
    total: number; cited: number; seen: number;
    prompts: { prompt: string; chatgpt: "cited" | "mentioned" | "none" | null; perplexity: "cited" | "mentioned" | "none" | null }[];
    topDomains: { domain: string; count: number }[];
  } | null;
  tfidf: {
    keyword: string;
    terms: { term: string; tfidf: number; docs: number }[];
    topics: { text: string; coverage: number; urls: string[] }[];
    headingTerms: { term: string; count: number }[];
    sources: string[];
    // top-10 orgánico tal cual lo muestra Google (título + snippet). Llega
    // gratis con el SERP ya pagado; clave para mostrar "cómo posicionan".
    competitors: { url: string; title: string; position: number | null; description: string | null }[];
    updatedAt: Date;
  }[];
};

const CATEGORY_LABELS: { key: keyof CategoryScores; label: string }[] = [
  { key: "indexabilidad", label: "Indexabilidad" },
  { key: "enlaces", label: "Enlaces" },
  { key: "onpage", label: "On-page" },
  { key: "rendimiento", label: "Rendimiento" },
  { key: "accesibilidadImagenes", label: "Accesibilidad imágenes" },
];

function scoreTone(score: number | null): string {
  if (score == null) return "text-ink-faint";
  if (score >= 80) return "text-accent-ink";
  if (score >= 50) return "text-ink-soft";
  return "text-alert-ink";
}
function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
function fmtTraffic(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
}
// nullish (== null) cubre null y undefined — los items/snapshots viejos no
// tienen estos campos (ausentes → undefined), no null.
function fmtCpc(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v as number).toFixed(2)}$`;
}
// Dificultad unificada: etiqueta legible (Alta/Media/Baja) priorizando
// competition (HIGH/MEDIUM/LOW) y cayendo al índice 0-100 si no viene.
function difficulty(
  competition: string | null | undefined,
  index: number | null | undefined
): { label: string; cls: string } {
  if (competition === "HIGH" || (competition == null && index != null && index >= 67)) {
    return { label: "Alta", cls: "bg-alert-tint text-alert-ink" };
  }
  if (competition === "LOW" || (competition == null && index != null && index < 34)) {
    return { label: "Baja", cls: "bg-accent-tint text-accent-ink" };
  }
  if (competition === "MEDIUM" || index != null) {
    return { label: "Media", cls: "bg-accent-tint text-accent-ink" };
  }
  return { label: "—", cls: "bg-surface-muted text-ink-faint" };
}
function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("es-ES");
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-ink border-b border-line pb-2 mb-4">
      <span className="text-ink-faint print:text-black">{icon}</span>
      {children}
    </h2>
  );
}
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="break-inside-avoid">
      <div className="text-xl font-semibold text-ink tabular-nums print:text-black">{value}</div>
      <div className="text-xs text-ink-soft">{label}</div>
      {sub && <div className="text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}

export type Branding = { name: string | null; logo: string | null; color: string | null } | null;

type Props = {
  projectId: string;
  data: ReportData;
  initialConfig: ReportSections;
  initialOrder: SectionKey[];
  branding: Branding;
  // Panel de compartir/marca blanca: solo en la vista del propietario. Sin él
  // (vista pública del cliente) el informe se muestra solo, sin controles.
  share?: ShareState;
};

export default function InformeBuilder({ projectId, data, initialConfig, initialOrder, branding, share }: Props) {
  const readOnly = !share;
  const brandName = branding?.name?.trim() || null;
  const brandColor = branding?.color && /^#[0-9a-fA-F]{6}$/.test(branding.color) ? branding.color : null;
  const [config, setConfig] = useState<ReportSections>(initialConfig);
  const [order, setOrder] = useState<SectionKey[]>(initialOrder);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(key: SectionKey) {
    setConfig((c) => ({ ...c, [key]: !c[key] }));
    setSaved(false);
  }
  function reorder(next: SectionKey[]) {
    setOrder(next);
    setSaved(false);
  }
  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/proyectos/${projectId}/informe/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: config, order }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  // Borra el override del proyecto (reportConfig = null) y recarga la página
  // para que la cascada caiga al default global. Solo lo mostramos si el
  // proyecto tiene override (siempre lo tiene si guardó alguna vez).
  const [resetting, setResetting] = useState(false);
  async function reset() {
    if (!window.confirm("¿Restablecer este informe al default global? Se pierde la configuración específica de este proyecto.")) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/proyectos/${projectId}/informe/config`, { method: "DELETE" });
      if (res.ok) {
        // Recarga para que el server vuelva a renderizar con la cascada nueva.
        window.location.reload();
      }
    } finally {
      setResetting(false);
    }
  }

  // --- Render de cada sección como función, despachada por orden ---
  const renderTasks = () => (
    <section className="space-y-4">
      <SectionTitle icon={<ClipboardCheck className="h-4 w-4" />}>
        Trabajos realizados <span className="text-ink-faint font-normal text-sm">({data.monthLabel})</span>
      </SectionTitle>
      {data.tasks.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin tareas completadas registradas este mes.</p>
      ) : (
        <ul className="space-y-2">
          {data.tasks.map((t) => {
            const label = t.issueType ? ISSUE_META[t.issueType]?.label ?? t.issueType : splitManualTask(t.text).title;
            const sub = t.issueType ? `${t.affectedUrls.length} página${t.affectedUrls.length === 1 ? "" : "s"} corregida${t.affectedUrls.length === 1 ? "" : "s"}` : null;
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 text-sm border-b border-line pb-2 last:border-0">
                <div className="min-w-0"><p className="text-ink">{label}</p>{sub && <p className="text-xs text-ink-faint">{sub}</p>}</div>
                <span className="text-xs text-ink-faint shrink-0 whitespace-nowrap">{fmtDate(t.completedAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const renderAudit = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Gauge className="h-4 w-4" />}>
        Salud técnica <span className="text-ink-faint font-normal text-sm">(Auditoría)</span>
      </SectionTitle>
      {!data.audit || data.audit.overallScore == null ? (
        <p className="text-sm text-ink-soft">Sin auditorías completadas hasta este mes.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div className="break-inside-avoid">
              <div className={`text-3xl font-bold tabular-nums print:text-black ${scoreTone(data.audit.overallScore)}`}>
                {data.audit.overallScore}<span className="text-base font-medium text-ink-faint">/100</span>
              </div>
              <div className="text-xs text-ink-soft">Puntuación global</div>
            </div>
            {CATEGORY_LABELS.map(({ key, label }) => {
              const cat = data.audit!.categoryScores?.[key];
              return <Stat key={key} label={label} value={cat ? `${cat.score}/${cat.max}` : "—"} sub={key === "rendimiento" && !cat ? "sin dato PSI" : undefined} />;
            })}
          </div>
          <p className="text-xs text-ink-faint">
            {data.audit.pagesCrawled} página{data.audit.pagesCrawled === 1 ? "" : "s"} rastreada{data.audit.pagesCrawled === 1 ? "" : "s"} · Auditoría completada el {fmtDate(data.audit.completedAt)}
          </p>

          {/* Core Web Vitals (PageSpeed Insights) */}
          {data.audit.categoryScores?.rendimiento?.detail && (() => {
            const d = data.audit.categoryScores!.rendimiento!.detail;
            const perf = d.performanceScorePct;
            const lcp = d.lcpMs;
            const clsX = d.clsX1000;
            const inp = d.inpMs;
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <Stat label="Performance" value={perf >= 0 ? String(perf) : "—"} />
                  <Stat label="LCP" value={lcp >= 0 ? `${(lcp / 1000).toFixed(1)}s` : "—"} />
                  <Stat label="CLS" value={clsX >= 0 ? (clsX / 1000).toFixed(2) : "—"} />
                  <Stat label="INP" value={inp >= 0 ? `${inp}ms` : "—"} />
                </div>
                <p className="text-xs text-ink-faint">Core Web Vitals sobre la home (móvil) · Google PageSpeed Insights.</p>
              </>
            );
          })()}

          {/* Visibilidad en Google (Search Console, gratis) */}
          {data.authority && (data.authority.impressions > 0 || data.authority.queries > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-line">
              <Stat label={`Impresiones (${data.authority.month})`} value={fmtTraffic(data.authority.impressions)} />
              <Stat label={`Clics (${data.authority.month})`} value={fmtTraffic(data.authority.clicks)} />
              <Stat label="Queries con datos" value={data.authority.queries.toLocaleString("es-ES")} />
              <Stat label="Posición media" value={data.authority.position.toFixed(1)} />
            </div>
          )}
        </>
      )}
    </section>
  );

  const renderRank = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Target className="h-4 w-4" />}>
        Posicionamiento <span className="text-ink-faint font-normal text-sm">(Rank tracking, estado actual)</span>
      </SectionTitle>
      {data.rank.keywords.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin keywords en seguimiento.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label="Keywords en seguimiento" value={String(data.rank.keywords.length)} />
            <Stat label="Con posición registrada" value={String(data.rank.rankedCount)} sub={`de ${data.rank.keywords.length} totales`} />
            <Stat label="Mejor posición media" value={data.rank.rankedCount > 0 ? (data.rank.keywords.filter((k) => k.bestPosition != null).reduce((s, k) => s + (k.bestPosition as number), 0) / Math.max(1, data.rank.keywords.filter((k) => k.bestPosition != null).length)).toFixed(1) : "—"} />
          </div>
          <div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-faint border-b border-line">
                <th className="py-2 pr-4 font-medium">Keyword</th><th className="py-2 pr-4 font-medium">Dispositivo</th>
                <th className="py-2 pr-4 font-medium text-right">Última</th><th className="py-2 pr-2 font-medium"></th><th className="py-2 pr-4 font-medium text-right">Mejor</th><th className="py-2 pr-4 font-medium">Chequeo</th>
              </tr></thead>
              <tbody>
                {data.rank.topRank.map((k, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-ink">{k.keyword}</td>
                    <td className="py-2 pr-4 text-ink-soft">{k.device === "mobile" ? "Móvil" : "Escritorio"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink">{k.lastPosition ?? "—"}</td>
                    <td className={cn(
                      "py-2 pr-2 text-center",
                      k.trend === "up" && "text-accent-ink",
                      k.trend === "down" && "text-alert-ink",
                      k.trend === "same" && "text-ink-faint"
                    )} title={k.trend === "up" ? "Mejora" : k.trend === "down" ? "Empeora" : k.trend === "same" ? "Sin cambios" : "Sin histórico suficiente"}>
                      {k.trend === "up" ? "↑" : k.trend === "down" ? "↓" : k.trend === "same" ? "→" : ""}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium text-ink">{k.bestPosition ?? "—"}</td>
                    <td className="py-2 pr-4 text-ink-faint">{fmtDate(k.lastCheckedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.rank.keywords.length > 10 && <p className="text-xs text-ink-faint mt-2">Mostrando las 10 mejores de {data.rank.keywords.length} keywords.</p>}
          </div>
        </>
      )}
    </section>
  );

  const renderKeywords = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Search className="h-4 w-4" />}>
        Investigación de keywords <span className="text-ink-faint font-normal text-sm">(Estudios, estado actual)</span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Estudios guardados" value={String(data.keywords.studyCount)} />
        <Stat label="Keywords investigadas" value={String(data.keywords.keywordTotal)} />
      </div>
      {data.keywords.studyCount === 0 && <p className="text-sm text-ink-soft">Aún no hay estudios de keywords para este proyecto.</p>}
      {data.keywords.top.length > 0 && (
        <div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-faint border-b border-line">
              <th className="py-2 pr-4 font-medium">Keyword</th>
              <th className="py-2 pr-4 font-medium text-right">Volumen</th>
              <th className="py-2 pr-4 font-medium text-right">Dificultad</th>
              <th className="py-2 font-medium text-right">Prioridad</th>
            </tr></thead>
            <tbody>
              {data.keywords.top.map((k, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 text-ink">{k.keyword}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{k.searchVolume ?? "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{k.difficulty ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums font-medium text-ink">{k.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-ink-faint mt-2">Top {data.keywords.top.length} del estudio &laquo;General&raquo; por prioridad.</p>
        </div>
      )}
    </section>
  );

  // Jerarquía real (padres/hijos) en vez de la lista plana anterior — mismo
  // árbol (StructureTreeNode) que ya pinta el módulo Arquitectura en vivo.
  function renderTreeNode(node: StructureTreeNode, depth: number): React.ReactNode {
    if (!node.page && node.children.length === 0) return null;
    return (
      <li key={node.path || "root"} style={{ marginLeft: depth * 16 }} className="py-0.5">
        {node.page ? (
          <>
            <span className="text-ink">{node.page.h1 || node.page.navLabel}</span>
            <span className="text-ink-faint text-xs ml-2">/{node.path}</span>
            {node.volume > 0 && <span className="text-ink-faint text-xs ml-2">· vol. {node.volume}</span>}
          </>
        ) : (
          <span className="text-ink-soft text-xs uppercase tracking-wide">{node.segment}/</span>
        )}
        {node.children.length > 0 && (
          <ul className="space-y-0.5">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  const renderArquitectura = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Network className="h-4 w-4" />}>
        Arquitectura de URLs <span className="text-ink-faint font-normal text-sm">(última estructura generada)</span>
      </SectionTitle>
      {!data.arquitectura || data.arquitectura.pageCount === 0 ? (
        <p className="text-sm text-ink-soft">Sin arquitectura de URLs generada. Créala desde Keywords → Arquitectura.</p>
      ) : (
        <div className="text-sm">
          <ul className="space-y-0.5">
            {data.arquitectura.tree.children.map((child) => renderTreeNode(child, 0))}
          </ul>
          <p className="text-xs text-ink-faint mt-2">
            {data.arquitectura.pageCount} páginas · estructura del {fmtDate(data.arquitectura.updatedAt)}.
          </p>
        </div>
      )}
    </section>
  );

  const renderTitulosMeta = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Type className="h-4 w-4" />}>Título y Meta <span className="text-ink-faint font-normal text-sm">(últimas generaciones)</span></SectionTitle>
      {data["titulos-meta"].length === 0 ? (
        <p className="text-sm text-ink-soft">Sin generaciones de título/meta todavía.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {data["titulos-meta"].map((g, i) => (
            <li key={i} className="border-b border-line pb-2 last:border-0">
              <p className="text-xs text-ink-faint">{g.url}</p>
              <p className="text-ink">{g.variants[0]?.title ?? "—"}</p>
              <p className="text-xs text-ink-soft">{g.variants[0]?.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const renderSchema = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Code2 className="h-4 w-4" />}>Schema <span className="text-ink-faint font-normal text-sm">(últimas generaciones)</span></SectionTitle>
      {data.schema.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin generaciones de schema todavía.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {data.schema.map((g, i) => (
            <li key={i} className="flex items-center justify-between gap-2 border-b border-line pb-1 last:border-0">
              <span className="text-ink truncate">{g.selectedType}</span>
              <span className="text-xs text-ink-faint truncate">{g.url}</span>
              <span className={g.valid ? "text-[10px] text-accent-ink" : "text-[10px] text-accent-ink"}>{g.valid ? "válido" : "avisos"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const renderContenido = () => (
    <section className="space-y-4">
      <SectionTitle icon={<PenLine className="h-4 w-4" />}>Contenido <span className="text-ink-faint font-normal text-sm">(últimas generaciones)</span></SectionTitle>
      {data.contenido.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin contenidos generados todavía.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {data.contenido.map((g, i) => (
            <li key={i} className="flex items-center justify-between gap-2 border-b border-line pb-1 last:border-0">
              <span className="text-ink truncate">{g.topic}</span>
              <span className="text-xs text-ink-faint">{fmtDate(g.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const renderGoogle = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Globe className="h-4 w-4" />}>
        Google (Search Console) <span className="text-ink-faint font-normal text-sm">(snapshot {data.google?.month ?? "—"}, últimos {data.google?.rangeDays ?? "—"} días)</span>
      </SectionTitle>
      {!data.google ? (
        <p className="text-sm text-ink-soft">Sin datos de Search Console. Conecta la propiedad desde el módulo Google.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Clics" value={fmtInt(data.google.totals.clicks)} />
            <Stat label="Impresiones" value={fmtInt(data.google.totals.impressions)} />
            <Stat label="CTR medio" value={`${(data.google.totals.ctr * 100).toFixed(1)}%`} />
            <Stat label="Posición media" value={data.google.totals.position.toFixed(1)} />
          </div>
          {data.google.topQueries.length > 0 && (
            <ul className="text-sm space-y-1">
              <p className="text-xs text-ink-faint">Top queries reales:</p>
              {data.google.topQueries.map((q, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-b border-line pb-1 last:border-0">
                  <span className="text-ink truncate">{q.query}</span>
                  <span className="text-xs text-ink-faint">{fmtInt(q.clicks)} clics · pos. {q.position.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          )}
          {data.google.ga4 && (
            <div className="pt-3 border-t border-line space-y-3">
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Google Analytics (GA4)</p>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Sesiones" value={fmtInt(data.google.ga4.sessions)} />
                <Stat label="Conversiones" value={fmtInt(data.google.ga4.conversions)} />
              </div>
              {data.google.ga4.topChannels.length > 0 && (
                <ul className="text-sm space-y-1">
                  <p className="text-xs text-ink-faint">Canales de tráfico principales:</p>
                  {data.google.ga4.topChannels.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 border-b border-line pb-1 last:border-0">
                      <span className="text-ink">{c.channel}</span>
                      <span className="text-xs text-ink-faint">{fmtInt(c.sessions)} sesiones</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );

  const renderCanibalizaciones = () => (
    <section className="space-y-4">
      <SectionTitle icon={<GitBranch className="h-4 w-4" />}>
        Canibalizaciones <span className="text-ink-faint font-normal text-sm">(últimos 90 días, Search Console)</span>
      </SectionTitle>
      {!data.canibalizaciones || data.canibalizaciones.count === 0 ? (
        <p className="text-sm text-ink-soft">No se detectan canibalizaciones o no hay conexión con Search Console.</p>
      ) : (
        <>
          <Stat label="Queries canibalizadas" value={String(data.canibalizaciones.count)} />
          <ul className="text-sm space-y-1">
            {data.canibalizaciones.top.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2 border-b border-line pb-1 last:border-0">
                <span className="text-ink truncate">“{c.query}”</span>
                <span className="text-xs text-ink-faint">{c.urls} URLs · {fmtInt(c.clicks)} clics</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );

  const renderGeogrid = () => {
    if (!data.project.isLocalBusiness) return null;
    return (
      <section className="space-y-4">
        <SectionTitle icon={<MapPin className="h-4 w-4" />}>SEO Local <span className="text-ink-faint font-normal text-sm">(Geogrid)</span></SectionTitle>
        {!data.geogrid || data.geogrid.foundCount == null ? (
          <p className="text-sm text-ink-soft">Sin geogrids completados hasta este mes.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <GeogridMap centerLat={data.geogrid.centerLat} centerLng={data.geogrid.centerLng} radiusKm={data.geogrid.radiusKm} points={(data.geogrid.points ?? []).map((p) => ({ row: p.row, col: p.col, lat: p.lat, lng: p.lng, position: p.position, title: null }))} keyword={data.geogrid.keyword} />
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-faint">
                <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Top 3</span>
                <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-300" /> 4–10</span>
                <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-100" /> 11–20</span>
                <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded-full bg-alert" /> +20</span>
                <span className="flex items-center gap-0.5"><span className="h-2.5 w-2.5 rounded-full bg-ink-faint" /> No aparece</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Stat label="Visibilidad" value={`${data.geogrid.foundCount}/${data.geogrid.gridSize * data.geogrid.gridSize}`} sub="puntos donde aparece el negocio" />
                <Stat label="Posición media" value={data.geogrid.averagePosition != null ? data.geogrid.averagePosition.toFixed(1) : "—"} />
                <Stat label="Rejilla" value={`${data.geogrid.gridSize}×${data.geogrid.gridSize}`} sub={`radio ${data.geogrid.radiusKm} km`} />
              </div>
              <p className="text-xs text-ink-faint">«{data.geogrid.keyword}» · Geogrid completado el {fmtDate(data.geogrid.completedAt)}</p>
            </div>
          </div>
        )}
      </section>
    );
  };

  const renderLinks = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Network className="h-4 w-4" />}>Enlaces internos <span className="text-ink-faint font-normal text-sm">(PageRank, última auditoría)</span></SectionTitle>
      {!data.links || data.links.pages.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin grafo de enlaces disponible. Ejecuta una auditoría para analizar el enlazado interno.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label="URLs analizadas" value={String(data.links.pages.length)} sub={`auditoría del ${fmtDate(data.links.auditDate)}`} />
            <Stat label="Páginas huérfanas" value={String(data.links.orphans.length)} sub="sin enlaces entrantes" />
            <Stat label="Top distribuidora" value={data.links.topHubs[0] ? (() => { try { return new URL(data.links.topHubs[0]).pathname || "/"; } catch { return data.links.topHubs[0]; } })() : "—"} />
          </div>
          <div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-faint border-b border-line">
                <th className="py-2 pr-4 font-medium">URL</th><th className="py-2 pr-4 font-medium text-right">PageRank</th>
                <th className="py-2 pr-4 font-medium text-right">Entrantes</th><th className="py-2 pr-4 font-medium text-right">Salientes</th>
              </tr></thead>
              <tbody>
                {data.links.pages.map((p) => (
                  <tr key={p.url} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-ink max-w-[320px] truncate">{p.url}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink">{(p.pagerank * 100).toFixed(2)}%</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{p.incoming}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{p.outgoing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );

  const renderCompetitors = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Target className="h-4 w-4" />}>Competidores <span className="text-ink-faint font-normal text-sm">(Visibilidad, último análisis)</span></SectionTitle>

      {data.competitors.own && (
        <div className="space-y-2 break-inside-avoid">
          <p className="text-sm font-medium text-ink-soft">
            Tu visibilidad {data.project.domain ? `· ${data.project.domain}` : ""}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label="Tráfico orgánico (est. mensual)" value={fmtTraffic(data.competitors.own.organicTraffic)} />
            <Stat
              label="Keywords orgánicas"
              value={data.competitors.own.organicKeywords?.toLocaleString("es-ES") ?? "—"}
              sub={`Análisis del ${fmtDate(data.competitors.own.fetchedAt)}`}
            />
            {data.competitors.own.positionBuckets ? (
              <div className="space-y-1">
                <div className="text-xs text-ink-soft">Fuerza del dominio</div>
                <PositionDistribution buckets={data.competitors.own.positionBuckets} avgPosition={data.competitors.own.avgPosition} />
              </div>
            ) : null}
          </div>
          {data.competitors.own.topKeywords && data.competitors.own.topKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.competitors.own.topKeywords.map((k, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-background text-ink-soft">
                  {k.keyword}
                  {k.position != null && <span className="text-ink-faint">· #{k.position}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {data.competitors.items.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin competidores trackeados.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-faint border-b border-line">
                <th className="py-2 pr-4 font-medium">Dominio</th><th className="py-2 pr-4 font-medium text-right">Tráfico orgánico</th>
                <th className="py-2 pr-4 font-medium text-right">Keywords</th><th className="py-2 pr-4 font-medium">Análisis</th>
              </tr></thead>
              <tbody>
                {data.competitors.items.map((c) => (
                  <tr key={c.domain} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-ink">{c.domain}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink">{fmtTraffic(c.organicTraffic)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{c.organicKeywords?.toLocaleString("es-ES") ?? "—"}</td>
                    <td className="py-2 pr-4 text-ink-faint">{fmtDate(c.fetchedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.competitors.items.map((c) => {
            // Content gap: top 15 por volumen. Acotado para que el PDF sea
            // legible (un dominio puede tener cientos de keywords en el gap).
            // Se muestra con CPC, dificultad y snippet (cómo lo posiciona el
            // competidor) — todo dato que ya estaba pagado en BD.
            const gap = (c.contentGap ?? [])
              .slice()
              .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1))
              .slice(0, 15);
            return (
              <div key={c.domain} className="space-y-2 break-inside-avoid">
                {c.topKeywords && c.topKeywords.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-soft mb-1.5">
                      Top keywords de {c.domain} ({c.topKeywords.length})
                      {c.fetchedAt ? ` · ${fmtDate(c.fetchedAt)}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.topKeywords.map((k, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-background text-ink-soft">
                          {k.keyword}
                          {k.position != null && <span className="text-ink-faint">· #{k.position}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {gap.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-soft mb-1.5">
                      Content gap con {c.domain} ({c.contentGap?.length ?? 0}) — ranquea por estas y tú no
                      {c.contentGapAt ? ` · ${fmtDate(c.contentGapAt)}` : ""}
                      {(c.contentGap?.length ?? 0) > 15 ? " · top 15 por volumen" : ""}
                    </p>
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-ink-faint border-b border-line">
                        <th className="py-1.5 pr-2 font-medium">Keyword</th>
                        <th className="py-1.5 px-2 font-medium text-right">Vol.</th>
                        <th className="py-1.5 px-2 font-medium text-right">CPC</th>
                        <th className="py-1.5 px-2 font-medium text-right">Dif.</th>
                        <th className="py-1.5 px-2 font-medium">Snippet con el que posiciona</th>
                      </tr></thead>
                      <tbody>
                        {gap.map((k, i) => {
                          const dif = difficulty(k.competition, k.competitionIndex);
                          return (
                            <tr key={i} className="border-b border-line align-top">
                              <td className="py-1.5 pr-2 text-ink font-medium">{k.keyword}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-ink-soft">{k.volume != null ? k.volume.toLocaleString("es-ES") : "—"}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-ink-soft">{fmtCpc(k.cpc)}</td>
                              <td className="py-1.5 px-2 text-right">
                                <span className={cn("inline-block px-1.5 py-0.5 rounded font-medium", dif.cls)}>{dif.label}</span>
                              </td>
                              <td className="py-1.5 px-2 text-ink-soft">
                                {k.description ? (
                                  <span className="line-clamp-2">{k.description}</span>
                                ) : (
                                  <span className="text-ink-faint">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  // Antes ausente por completo del informe pese a existir el módulo entero —
  // mismo criterio que Competidores: solo lectura de lo ya persistido
  // (BacklinkSnapshot), sin disparar ninguna llamada nueva a la API.
  const renderBacklinks = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Anchor className="h-4 w-4" />}>
        Backlinks <span className="text-ink-faint font-normal text-sm">(último análisis)</span>
      </SectionTitle>
      {!data.backlinks ? (
        <p className="text-sm text-ink-soft">Sin backlinks analizados todavía. Ejecuta un análisis desde el módulo Backlinks.</p>
      ) : (
        <div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-faint border-b border-line">
              <th className="py-2 pr-4 font-medium">Dominio</th>
              <th className="py-2 pr-4 font-medium text-right">Autoridad</th>
              <th className="py-2 pr-4 font-medium text-right">Backlinks</th>
              <th className="py-2 font-medium text-right">Dominios de referencia</th>
            </tr></thead>
            <tbody>
              {data.backlinks.own && (
                <tr className="border-b border-line">
                  <td className="py-2 pr-4 text-ink font-medium">
                    {data.project.domain} <span className="text-[10px] text-accent-ink font-semibold">· TÚ</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-ink">{data.backlinks.own.rank ?? "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{data.backlinks.own.backlinksTotal?.toLocaleString("es-ES") ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">{data.backlinks.own.referringDomains?.toLocaleString("es-ES") ?? "—"}</td>
                </tr>
              )}
              {data.backlinks.competitors.map((c) => (
                <tr key={c.domain} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 text-ink">{c.domain}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-ink">{c.rank ?? "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-ink-soft">{c.backlinksTotal?.toLocaleString("es-ES") ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">{c.referringDomains?.toLocaleString("es-ES") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.backlinks.own && (
            <p className="text-xs text-ink-faint mt-2">
              {data.backlinks.own.brokenBacklinks != null && <>{data.backlinks.own.brokenBacklinks} backlinks rotos · </>}
              actualizado el {fmtDate(data.backlinks.own.fetchedAt)}.
            </p>
          )}
        </div>
      )}
    </section>
  );

  const iaLabel = (v: "cited" | "mentioned" | "none" | null) =>
    v === "cited" ? "Citado" : v === "mentioned" ? "Mencionado" : v === "none" ? "No aparece" : "—";
  const renderIa = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Quote className="h-4 w-4" />}>Visibilidad en IA <span className="text-ink-faint font-normal text-sm">(ChatGPT y Perplexity, última comprobación)</span></SectionTitle>
      {!data.ia ? (
        <p className="text-sm text-ink-soft">Sin preguntas comprobadas todavía.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label="Te citan en" value={`${data.ia.cited}/${data.ia.total}`} />
            <Stat label="Te mencionan o citan" value={`${data.ia.seen}/${data.ia.total}`} />
            <Stat label="Preguntas seguidas" value={String(data.ia.prompts.length)} />
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-faint border-b border-line">
              <th className="py-2 pr-4 font-medium">Pregunta</th>
              <th className="py-2 pr-4 font-medium">ChatGPT</th>
              <th className="py-2 font-medium">Perplexity</th>
            </tr></thead>
            <tbody>
              {data.ia.prompts.map((p) => (
                <tr key={p.prompt} className="border-b border-line">
                  <td className="py-2 pr-4 text-ink">{p.prompt}</td>
                  <td className="py-2 pr-4 text-ink-soft">{iaLabel(p.chatgpt)}</td>
                  <td className="py-2 text-ink-soft">{iaLabel(p.perplexity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.ia.topDomains.length > 0 && (
            <p className="text-xs text-ink-faint">
              Webs más citadas: {data.ia.topDomains.map((d) => `${d.domain} (${d.count})`).join(" · ")}.
            </p>
          )}
        </>
      )}
    </section>
  );

  const renderTfidf = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Hash className="h-4 w-4" />}>TF-IDF <span className="text-ink-faint font-normal text-sm">(términos, temas y encabezados del top-10 orgánico)</span></SectionTitle>
      {data.tfidf.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin estudios TF-IDF todavía.</p>
      ) : (
        <div className="space-y-6">
          {data.tfidf.map((t) => (
            <div key={t.keyword} className="space-y-3 break-inside-avoid">
              <p className="text-sm font-medium text-ink-soft">
                «{t.keyword}» <span className="text-ink-faint font-normal">· {fmtDate(t.updatedAt)}</span>
              </p>

              {t.competitors.length > 0 && (
                <div>
                  <p className="text-xs text-ink-soft mb-1.5">Cómo lo muestran tus competidores en Google (top-10) — referencia de copy</p>
                  <table className="w-full text-xs">
                    <tbody>
                      {t.competitors.map((c, i) => (
                        <tr key={i} className="border-b border-line align-top">
                          <td className="py-1.5 pr-2 text-ink-faint tabular-nums w-8 shrink-0">#{c.position ?? i + 1}</td>
                          <td className="py-1.5 pr-2 space-y-0.5">
                            <p className="text-ink font-medium line-clamp-1">{c.title || c.url}</p>
                            {c.description && <p className="text-ink-soft line-clamp-2">{c.description}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {t.terms.length > 0 && (
                <div>
                  <p className="text-xs text-ink-soft mb-1.5">Términos TF-IDF ({t.terms.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.terms.map((term, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-background text-ink-soft">
                        {term.term} <span className="text-ink-faint">· {term.tfidf.toFixed(2)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {t.headingTerms.length > 0 && (
                <div>
                  <p className="text-xs text-ink-soft mb-1.5">Palabras más frecuentes en encabezados ({t.headingTerms.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.headingTerms.map((h, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-accent-tint text-accent-ink">
                        {h.term} <span className="text-accent-ink">· {h.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {t.topics.length > 0 && (
                <div>
                  <p className="text-xs text-ink-soft mb-1.5">Temas (H2/H3) del top-10 ({t.topics.length})</p>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink-faint border-b border-line">
                      <th className="py-1.5 pr-4 font-medium">Encabezado</th>
                      <th className="py-1.5 pr-4 font-medium text-right">Páginas que lo cubren</th>
                    </tr></thead>
                    <tbody>
                      {t.topics.map((topic, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="py-1.5 pr-4 text-ink">{topic.text}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-ink-soft">{topic.coverage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {t.sources.length > 0 && (
                <div>
                  <p className="text-xs text-ink-soft mb-1.5">URLs analizadas ({t.sources.length})</p>
                  <ul className="text-xs text-ink-soft space-y-0.5">
                    {t.sources.map((url) => (
                      <li key={url} className="truncate">{url}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderCosts = () => (
    <section className="space-y-4">
      <SectionTitle icon={<Wallet className="h-4 w-4" />}>Coste del mes <span className="text-ink-faint font-normal text-sm">({data.monthLabel})</span></SectionTitle>
      <div className="grid grid-cols-1 gap-4">
        <Stat label="Créditos usados este mes" value={usdToCredits(data.costs.monthCost).toLocaleString("es-ES")} sub="Consultas de pago de este proyecto" />
      </div>
    </section>
  );

  const dispatch: Record<SectionKey, () => React.ReactNode> = {
    tasks: renderTasks,
    audit: renderAudit,
    rank: renderRank,
    keywords: renderKeywords,
    arquitectura: renderArquitectura,
    "titulos-meta": renderTitulosMeta,
    schema: renderSchema,
    contenido: renderContenido,
    google: renderGoogle,
    canibalizaciones: renderCanibalizaciones,
    geogrid: renderGeogrid,
    links: renderLinks,
    competitors: renderCompetitors,
    backlinks: renderBacklinks,
    tfidf: renderTfidf,
    ia: renderIa,
    costs: renderCosts,
  };

  // El gasto en APIs es interno: el cliente final nunca lo ve en el informe público.
  const visibleSections = order.filter((k) => config[k] && !(readOnly && k === "costs"));

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[19rem_minmax(0,1fr)] gap-8 items-start print:block print:max-w-none">
      <style dangerouslySetInnerHTML={{ __html: `
        /* El informe se ajusta siempre al ancho disponible: ninguna tabla ni texto
           largo genera scroll horizontal; las celdas parten línea donde haga falta. */
        .informe-sheet table { width: 100%; max-width: 100%; }
        .informe-sheet th, .informe-sheet td { overflow-wrap: anywhere; word-break: break-word; }
        .informe-sheet td.truncate, .informe-sheet td[class*="truncate"] { white-space: normal; }
        @media print {
          @page { margin: 1.5cm; }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }

          /* AdminShell envuelve toda la app en flex + h-screen + overflow-hidden,
             y el <main> en overflow-y-auto. Al imprimir, esas propiedades fijan
             la altura a la del viewport y cortan el informe a la primera página.
             Reseteamos TODOS los overflow y las alturas fijas para que el
             navegador pueda paginar el documento completo. */
          body * { overflow: visible !important; }
          .h-screen, .overflow-hidden, .overflow-y-auto, .overflow-x-auto {
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
          }

          aside, header, nav { display: none !important; }
          main { padding: 0 !important; }
          section { break-inside: avoid; }
          tr { break-inside: avoid; }
        }
      ` }} />

      {/* Columna izquierda: navegación de mes + configuración de secciones.
          Sticky en escritorio; oculta al imprimir. */}
      {readOnly ? (
        <div className="flex items-center justify-center gap-1 print:hidden lg:col-span-2">
          <Link href={data.prevHref} className="p-1.5 text-ink-soft hover:text-ink hover:bg-background rounded-lg transition-colors" title="Mes anterior"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="text-sm font-medium text-ink px-2">{data.monthLabel}</span>
          {data.nextHref ? (
            <Link href={data.nextHref} className="p-1.5 text-ink-soft hover:text-ink hover:bg-background rounded-lg transition-colors" title="Mes siguiente"><ChevronRight className="h-4 w-4" /></Link>
          ) : <span className="w-8" />}
          <PrintButton className="ml-3" projectName={data.project.name} />
        </div>
      ) : (
      <aside className="lg:sticky lg:top-6 self-start space-y-4 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 print:hidden">
        {/* Navegación de mes a ancho completo (antes compartía fila con el
            botón de imprimir y se cortaba en el aside estrecho). */}
        <div className="flex items-center gap-1 bg-surface border border-line rounded-xl px-1 py-1 shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)]">
          <Link href={data.prevHref} className="p-1.5 text-ink-soft hover:text-ink hover:bg-background rounded-lg transition-colors" title="Mes anterior"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="flex-1 text-sm font-medium text-ink px-2 text-center">{data.monthLabel}</span>
          {data.nextHref === null ? (
            <span className="p-1.5 text-ink-faint"><ChevronRight className="h-4 w-4" /></span>
          ) : (
            <Link href={data.nextHref} className="p-1.5 text-ink-soft hover:text-ink hover:bg-background rounded-lg transition-colors" title="Mes siguiente"><ChevronRight className="h-4 w-4" /></Link>
          )}
        </div>
        <PrintButton className="w-full" projectName={data.project.name} />

        {/* Compartir y marca: acciones arriba, la lista larga de secciones debajo */}
        <SharePanel projectId={projectId} share={share!} />

        {/* Panel de control: secciones activables + reordenables */}
        <div className="bg-surface rounded-2xl border border-line p-5 shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-bold tracking-tight text-ink">Secciones del informe</h3>
            <button type="button" onClick={save} disabled={saving} className="shrink-0 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong transition-colors disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
          {saved && <Pill tone="success" className="mb-3">Configuración guardada</Pill>}
          <p className="text-xs text-ink-faint mb-3">
            Activa o desactiva cada sección y reordénala con las flechas ↑ ↓ — las activadas se
            agrupan siempre arriba.
          </p>
          <SectionOrderList
            order={order}
            enabledMap={config}
            onToggle={toggle}
            onReorder={reorder}
          />
          <button
            type="button"
            onClick={reset}
            disabled={resetting || saving}
            className="mt-3 w-full border-t border-line pt-3 text-xs text-ink-soft hover:text-ink transition-colors disabled:opacity-50"
            title="Borra el override de este proyecto y cae al default configurado en Configuración → Informe"
          >
            {resetting ? "Restableciendo…" : "Restablecer al default global"}
          </button>
        </div>
      </aside>
      )}

      {/* Hoja del informe — se renderizan las secciones activadas, en el orden elegido */}
      <div className={cn("informe-sheet min-w-0 overflow-x-clip bg-surface rounded-xl border border-line px-8 py-10 space-y-8 print:border-0 print:rounded-none print:px-0 print:py-0", readOnly && "lg:col-span-2")}>
        <div className="border-b border-line pb-5" style={brandColor ? { borderBottomColor: brandColor, borderBottomWidth: 2 } : undefined}>
          <div className="flex items-center gap-2 text-ink-faint mb-1">
            {branding?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo} alt={brandName ?? "Logo"} className="h-9 max-w-[160px] object-contain mr-1" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="text-xs uppercase tracking-wide font-medium" style={brandColor ? { color: brandColor } : undefined}>
              {brandName ? `${brandName} · Informe SEO` : "Informe SEO"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink">{data.project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            {data.project.domain && <span>{data.project.domain}</span>}
            <span>Periodo: {data.monthLabel}</span>
            <span>Generado el {data.generationDate}</span>
          </div>
        </div>

        {visibleSections.map((key) => (
          <div key={key}>{dispatch[key]()}</div>
        ))}

        <footer className="border-t border-line pt-4 text-xs text-ink-faint print:text-black">
          {brandName ? `Informe elaborado por ${brandName}` : "Informe generado por Crawlea"}
          {!data.isCurrentMonth && " · Informe de un mes anterior — los datos de estado (salud técnica, SEO local) reflejan la última medición hasta el fin de ese mes."}
        </footer>
      </div>
    </div>
  );
}
