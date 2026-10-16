"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Panel de GA4 ampliado — mismo criterio que GscPanel.tsx (Search Console):
// antes GA4 solo aportaba 2 números totales al dashboard general
// (sessions/conversions, sin ninguna dimensión); aquí se explota a fondo
// runReport con canal de tráfico, páginas de aterrizaje, dispositivo y
// evolución mensual. Periodo configurable (28d/3m/6m/12m). Cada apertura
// persiste un Ga4Snapshot (dedupe por mes) que lee también el Copilot.

type Ga4Totals = { sessions: number; conversions: number; engagementRate: number; averageSessionDuration: number };
type Ga4ChannelRow = { channel: string; sessions: number; conversions: number };
type Ga4LandingPageRow = { landingPage: string; sessions: number; conversions: number; engagementRate: number };
type Ga4DeviceRow = { device: string; sessions: number };
type Ga4MonthPoint = { month: string; sessions: number; conversions: number };
type Ga4Detail = {
  rangeKey: string;
  rangeDays: number;
  totals: Ga4Totals;
  byChannel: Ga4ChannelRow[];
  topLandingPages: Ga4LandingPageRow[];
  byDevice: Ga4DeviceRow[];
  monthly: Ga4MonthPoint[];
};

const RANGE_OPTIONS: { key: string; label: string }[] = [
  { key: "28d", label: "28 días" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
];

const DEVICE_LABEL: Record<string, string> = { mobile: "Móvil", desktop: "Escritorio", tablet: "Tablet" };
const PAGES_INITIAL = 10;

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("es-ES");
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
function monthLabel(ym: string): string {
  const [, m] = ym.split("-");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return months[Number(m) - 1] ?? m;
}
function shortPath(path: string): string {
  return path === "/" || !path ? "/ (home)" : path;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-4 flex flex-col">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-ink tabular-nums mt-1.5 leading-none">{value}</p>
    </div>
  );
}

function MonthlyChart({ points }: { points: Ga4MonthPoint[] }) {
  const [metric, setMetric] = useState<"sessions" | "conversions">("sessions");
  if (points.length === 0) {
    return <p className="text-sm text-ink-soft">Sin datos suficientes para la evolución.</p>;
  }
  const max = Math.max(...points.map((p) => p[metric]), 1);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["sessions", "conversions"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium border",
              metric === m ? "bg-brand-500 text-white border-brand-500" : "border-line text-ink-soft hover:bg-background"
            )}
          >
            {m === "sessions" ? "Sesiones" : "Conversiones"}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-1.5 h-36">
        {points.map((p) => {
          const h = Math.max(2, Math.round((p[metric] / max) * 116));
          return (
            <div key={p.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                    className={cn("w-full rounded-t", metric === "sessions" ? "bg-brand-500" : "bg-brand-100")}
                style={{ height: `${h}px` }}
                title={`${monthLabel(p.month)}: ${fmtInt(p[metric])} ${metric === "sessions" ? "sesiones" : "conversiones"}`}
              />
              <span className="text-[9px] text-ink-faint truncate w-full text-center">{monthLabel(p.month)}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-faint">Evolución de los últimos 12 meses (independiente del periodo seleccionado).</p>
    </div>
  );
}

export default function Ga4Panel({ projectId }: { projectId: string }) {
  const [range, setRange] = useState("3m");
  const [data, setData] = useState<Ga4Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllPages, setShowAllPages] = useState(false);

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/google/analytics?range=${range}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? "Error al cargar los datos de GA4");
        }
        return r.json();
      })
      .then((d: Ga4Detail) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, range]);

  function changeRange(key: string) {
    setRange(key);
    setLoading(true);
    setError("");
    setShowAllPages(false);
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />;
  if (error) return <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>;
  if (!data) return null;

  const t = data.totals;
  const pagesShown = showAllPages ? data.topLandingPages.length : Math.min(PAGES_INITIAL, data.topLandingPages.length);
  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === data.rangeKey)?.label ?? data.rangeKey;
  const maxChannelSessions = Math.max(...data.byChannel.map((c) => c.sessions), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-ink">Comportamiento en Google Analytics</h3>
          <p className="text-xs text-ink-soft">Datos reales de Google · periodo: {rangeLabel}</p>
        </div>
        <div className="flex items-center gap-1 bg-surface-muted rounded-lg p-0.5">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => changeRange(r.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                range === r.key ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="Sesiones" value={fmtInt(t.sessions)} />
        <Kpi label="Conversiones" value={fmtInt(t.conversions)} />
        <Kpi label="Engagement rate" value={fmtPct(t.engagementRate)} />
        <Kpi label="Duración media" value={fmtDuration(t.averageSessionDuration)} />
      </div>

      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-3">Evolución (12 meses)</h4>
        <MonthlyChart points={data.monthly} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {data.byChannel.length > 0 && (
          <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Por canal de tráfico</h4>
            <div className="space-y-2">
              {data.byChannel.map((c) => (
                <div key={c.channel} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink-soft">{c.channel}</span>
                    <span className="text-ink-soft tabular-nums">{fmtInt(c.sessions)} sesiones · {fmtInt(c.conversions)} conv.</span>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand-700 rounded-full" style={{ width: `${(c.sessions / maxChannelSessions) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.byDevice.length > 0 && (
          <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Por dispositivo</h4>
            <div className="space-y-1.5">
              {data.byDevice.map((d) => (
                <div key={d.device} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-soft">{DEVICE_LABEL[d.device] ?? d.device}</span>
                  <span className="text-ink-soft tabular-nums">{fmtInt(d.sessions)} sesiones</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Páginas de aterrizaje ({data.topLandingPages.length})
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wide bg-brand-900 text-white/80">
                <th className="py-1.5 pr-3 font-medium">Página</th>
                <th className="py-1.5 pr-3 font-medium text-right">Sesiones</th>
                <th className="py-1.5 pr-3 font-medium text-right">Conv.</th>
                <th className="py-1.5 font-medium text-right">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {data.topLandingPages.slice(0, pagesShown).map((p) => (
                <tr key={p.landingPage} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-3 text-ink truncate max-w-[220px]" title={p.landingPage}>
                    {shortPath(p.landingPage)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-ink-soft">{fmtInt(p.sessions)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-ink-soft">{fmtInt(p.conversions)}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink-soft">{fmtPct(p.engagementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.topLandingPages.length > PAGES_INITIAL && (
          <button
            type="button"
            onClick={() => setShowAllPages((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAllPages ? "rotate-180" : "")} />
            {showAllPages ? "Ver menos" : `Ver las ${data.topLandingPages.length} páginas`}
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink-faint">
        <Link href={`/app/proyectos/${projectId}/google`} className="hover:underline">
          Cambiar propiedad de GA4 →
        </Link>
      </p>
    </div>
  );
}
