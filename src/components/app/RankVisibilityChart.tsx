"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Eye, BarChart3, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

type VisibilityPoint = {
  date: string;
  index: number;
  keywordsWithData: number;
  top3: number;
  top10: number;
  top20: number;
  top30: number;
  avgPosition: number | null;
};

type SeriesKey = "avgPosition" | "top3" | "top10" | "top20" | "top30";

// Rampa índigo de la guía: mejor tramo = más intenso. La posición media
// (más bajo = mejor) va en su propio eje, invertido.
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "avgPosition", label: "Posición media", color: "#3238ad" },
  { key: "top3", label: "Top 3", color: "#4f5cf5" },
  { key: "top10", label: "Top 10", color: "#7381ff" },
  { key: "top20", label: "Top 20", color: "#9da8ff" },
  { key: "top30", label: "Top 30", color: "#c3caff" },
];

const PERIODS = [
  { key: "7d", label: "7 días", days: 7 },
  { key: "30d", label: "30 días", days: 30 },
  { key: "3m", label: "3 meses", days: 91 },
  { key: "6m", label: "6 meses", days: 182 },
  { key: "1y", label: "1 año", days: 365 },
  { key: "all", label: "Todo", days: null },
  { key: "custom", label: "Fechas", days: null },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

type Granularity = "day" | "week" | "month";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Agrupa por día/semana/mes quedándose con el ÚLTIMO dato real de cada tramo
// (es una foto del estado, no una suma: no se inventa ningún valor intermedio).
function bucketize(points: VisibilityPoint[], g: Granularity): VisibilityPoint[] {
  if (g === "day") return points;
  const map = new Map<string, VisibilityPoint>();
  for (const p of points) {
    const d = new Date(p.date);
    let key: string;
    if (g === "month") key = `${d.getFullYear()}-${d.getMonth()}`;
    else {
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = isoDay(monday);
    }
    map.set(key, p); // los puntos llegan ordenados: el último del tramo gana
  }
  return [...map.values()];
}

function fmtLabel(iso: string, g: Granularity): string {
  const d = new Date(iso);
  if (g === "month") return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function RankVisibilityChart({ projectId, group }: { projectId: string; group?: string }) {
  const [raw, setRaw] = useState<VisibilityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [active, setActive] = useState<SeriesKey[]>(["top10", "avgPosition"]);
  const [kind, setKind] = useState<"line" | "bar">("line");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [gran, setGran] = useState<Granularity>("day");
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = group ? `?group=${encodeURIComponent(group)}` : "";
    fetch(`/api/proyectos/${projectId}/rank/visibilidad${qs}`)
      .then((r) => r.json())
      .then((d: VisibilityPoint[]) => {
        if (!cancelled) setRaw(Array.isArray(d) ? d : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, group]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => {
    let list = [...raw].sort((a, b) => a.date.localeCompare(b.date));
    const p = PERIODS.find((x) => x.key === period);
    if (period === "custom") {
      if (from) list = list.filter((pt) => pt.date.slice(0, 10) >= from);
      if (to) list = list.filter((pt) => pt.date.slice(0, 10) <= to);
    } else if (p?.days) {
      const since = isoDay(new Date(Date.now() - p.days * 86400000));
      list = list.filter((pt) => pt.date.slice(0, 10) >= since);
    }
    return bucketize(list, gran);
  }, [raw, period, from, to, gran]);

  function toggle(k: SeriesKey) {
    setActive((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k]));
  }

  const H = 260;
  const PAD_L = 36;
  const PAD_R = active.includes("avgPosition") ? 40 : 12;
  const PAD_T = 14;
  const PAD_B = 28;
  const plotW = Math.max(10, w - PAD_L - PAD_R);
  const plotH = H - PAD_T - PAD_B;
  const n = points.length;

  const countKeys = active.filter((k) => k !== "avgPosition") as Exclude<SeriesKey, "avgPosition">[];
  const leftMax = Math.max(1, ...points.flatMap((p) => countKeys.map((k) => p[k])));
  const posVals = points.map((p) => p.avgPosition).filter((v): v is number => v !== null);
  const posMax = Math.max(10, ...(posVals.length ? posVals : [50]));

  const slot = n > 0 ? plotW / n : plotW;
  const x = (i: number) => (kind === "bar" ? PAD_L + slot * i + slot / 2 : PAD_L + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW));
  const yLeft = (v: number) => PAD_T + (1 - v / leftMax) * plotH;
  const yRight = (pos: number) => PAD_T + ((pos - 1) / (posMax - 1)) * plotH;
  const labelStep = Math.max(1, Math.ceil(n / 8));

  const last = points[n - 1];
  const first = points[0];

  return (
    <div ref={wrapRef} className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
      {/* Cabecera: título, resumen y controles */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand">
            <Eye className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-bold tracking-tight text-ink">Evolución del posicionamiento{group ? ` · ${group}` : ""}</h3>
            {last && first && n >= 2 && (
              <p className="text-xs text-ink-faint">
                Top 10: {first.top10} → <strong className="text-ink">{last.top10}</strong>
                {last.avgPosition !== null && first.avgPosition !== null && (
                  <> · posición media {first.avgPosition.toFixed(1)} → <strong className="text-ink">{last.avgPosition.toFixed(1)}</strong></>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-surface-muted p-1">
            {(["line", "bar"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", kind === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft")}
                title={k === "line" ? "Líneas" : "Barras"}
              >
                {k === "line" ? <LineChart className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
                {k === "line" ? "Líneas" : "Barras"}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full bg-surface-muted p-1">
            {([["day", "Días"], ["week", "Semanas"], ["month", "Meses"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setGran(k)}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold", gran === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Periodo */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              period === p.key ? "border-brand bg-brand text-white" : "border-line text-ink-soft hover:bg-surface-muted"
            )}
          >
            {p.label}
          </button>
        ))}
        {period === "custom" && (
          <span className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs outline-none focus:border-brand" />
            a
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs outline-none focus:border-brand" />
          </span>
        )}
      </div>

      {/* Series seleccionables */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {SERIES.map((s) => {
          const on = active.includes(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                on ? "border-line bg-surface text-ink" : "border-dashed border-line text-ink-faint"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? s.color : "transparent", border: `2px solid ${s.color}` }} />
              {s.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-faint">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : n === 0 ? (
        <p className="py-14 text-center text-sm text-ink-soft">
          {raw.length === 0 ? "Sin datos todavía: comprueba alguna keyword para empezar el histórico." : "No hay datos en este periodo."}
        </p>
      ) : (
        <div className="relative mt-4">
          <svg
            width={w}
            height={H}
            viewBox={`0 0 ${w} ${H}`}
            className="max-w-full overflow-visible"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const mx = e.clientX - rect.left;
              let best = 0;
              let bestD = Infinity;
              for (let i = 0; i < n; i++) {
                const d = Math.abs(x(i) - mx);
                if (d < bestD) {
                  bestD = d;
                  best = i;
                }
              }
              setHover(best);
            }}
          >
            {/* Rejilla y eje izquierdo (nº de keywords) */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const yy = PAD_T + f * plotH;
              return (
                <g key={f}>
                  <line x1={PAD_L} x2={PAD_L + plotW} y1={yy} y2={yy} className="stroke-line" strokeWidth={1} />
                  {countKeys.length > 0 && (
                    <text x={PAD_L - 6} y={yy + 3} textAnchor="end" className="fill-ink-faint text-[10px]">
                      {Math.round(leftMax * (1 - f))}
                    </text>
                  )}
                  {active.includes("avgPosition") && (
                    <text x={PAD_L + plotW + 6} y={yy + 3} className="fill-ink-faint text-[10px]">
                      {Math.round(1 + f * (posMax - 1))}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Barras (series de recuento agrupadas) */}
            {kind === "bar" &&
              points.map((p, i) => {
                const groupW = Math.min(36, slot * 0.7);
                const bw = groupW / Math.max(1, countKeys.length);
                return countKeys.map((k, j) => {
                  const s = SERIES.find((x) => x.key === k)!;
                  const top = yLeft(p[k]);
                  return (
                    <rect
                      key={`${i}-${k}`}
                      x={x(i) - groupW / 2 + j * bw}
                      y={top}
                      width={Math.max(2, bw - 2)}
                      height={Math.max(0, PAD_T + plotH - top)}
                      rx={3}
                      fill={s.color}
                    />
                  );
                });
              })}

            {/* Líneas de recuento */}
            {kind === "line" &&
              countKeys.map((k) => {
                const s = SERIES.find((x) => x.key === k)!;
                const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yLeft(p[k]).toFixed(1)}`).join(" ");
                return (
                  <g key={k}>
                    <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                    {n <= 40 && points.map((p, i) => <circle key={i} cx={x(i)} cy={yLeft(p[k])} r={2.5} fill={s.color} />)}
                  </g>
                );
              })}

            {/* Posición media (eje derecho, invertido), siempre en línea discontinua */}
            {active.includes("avgPosition") && (
              <path
                d={points
                  .map((p, i) =>
                    p.avgPosition !== null ? `${i === 0 || points[i - 1].avgPosition === null ? "M" : "L"}${x(i).toFixed(1)},${yRight(p.avgPosition).toFixed(1)}` : ""
                  )
                  .filter(Boolean)
                  .join(" ")}
                fill="none"
                stroke="#3238ad"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}

            {/* Eje X */}
            {points.map((p, i) =>
              i % labelStep === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-faint text-[10px]">
                  {fmtLabel(p.date, gran)}
                </text>
              ) : null
            )}

            {/* Guía al pasar el ratón */}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + plotH} className="stroke-brand-200" strokeWidth={1} />}
          </svg>

          {hover !== null && points[hover] && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-xl bg-brand-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: Math.min(Math.max(0, x(hover) - 70), w - 200) }}
            >
              <p className="font-semibold">{fmtLabel(points[hover].date, "day")}</p>
              {active.map((k) => {
                const s = SERIES.find((x) => x.key === k)!;
                const v = points[hover][k];
                return (
                  <p key={k} className="flex items-center gap-1.5 text-white/85">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.label}: <strong className="text-white tabular-nums">{v === null ? "—" : k === "avgPosition" ? (v as number).toFixed(1) : v}</strong>
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
