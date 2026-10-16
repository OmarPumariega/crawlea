"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Eye, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

// Rampa índigo de la guía: mejor tramo = más intenso. La serie de posición
// media (más bajo = mejor) va aparte en brand-700.
const SERIES = [
  { key: "top3" as const, label: "Top 3", color: "#4f5cf5" },
  { key: "top10" as const, label: "Top 10", color: "#7381ff" },
  { key: "top20" as const, label: "Top 20", color: "#9da8ff" },
  { key: "top30" as const, label: "Top 30", color: "#c3caff" },
];
const POS_COLOR = "#3238ad";

function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function RankVisibilityChart({ projectId, group }: { projectId: string; group?: string }) {
  const [points, setPoints] = useState<VisibilityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    let cancelled = false;
    const qs = group ? `?group=${encodeURIComponent(group)}` : "";
    fetch(`/api/proyectos/${projectId}/rank/visibilidad${qs}`)
      .then((r) => r.json())
      .then((d: VisibilityPoint[]) => {
        if (!cancelled) setPoints(Array.isArray(d) ? d : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, group]);

  // ResizeObserver sobre el contenedor exterior (siempre presente) — arregla el
  // bug que dejaba el ancho fijo en 600.
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

  const H = 180;
  const PAD_L = 32;
  const PAD_R = 36;
  const PAD_T = 14;
  const PAD_B = 26;
  const plotW = Math.max(10, w - PAD_L - PAD_R);
  const plotH = H - PAD_T - PAD_B;
  const n = points.length;

  // Escala izquierda (nº keywords): 0 a max(top30).
  const leftMax = Math.max(1, ...points.map((p) => p.top30));
  // Escala derecha (posición media): invertida (1 arriba = mejor).
  const posPoints = points.map((p) => p.avgPosition).filter((v): v is number => v !== null);
  const posMax = Math.max(10, ...(posPoints.length > 0 ? posPoints : [50]));

  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yLeft = (v: number) => PAD_T + (1 - v / leftMax) * plotH;
  const yRight = (pos: number) => PAD_T + ((pos - 1) / (posMax - 1)) * plotH;

  const lineFor = (key: keyof Pick<VisibilityPoint, "top3" | "top10" | "top20" | "top30">) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yLeft(p[key]).toFixed(1)}`).join(" ");

  const posLine =
    n >= 2
      ? points
          .map((p, i) =>
            p.avgPosition !== null
              ? `${i === 0 || points[i - 1].avgPosition === null ? "M" : "L"}${x(i).toFixed(1)},${yRight(p.avgPosition).toFixed(1)}`
              : ""
          )
          .filter(Boolean)
          .join(" ")
      : "";

  const current = points[n - 1];
  const previous = points[n - 2];
  const delta = current && previous ? Math.round((current.index - previous.index) * 10) / 10 : null;
  const labelStep = Math.max(1, Math.ceil(n / 7));

  return (
    <div ref={wrapRef} className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-ink-faint">
            <Eye className="h-4 w-4" />
          </span>
          <h3 className="text-lg font-bold tracking-tight text-ink">Evolución del posicionamiento{group ? ` — ${group}` : ""}</h3>
        </div>
        {current && (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{current.index}</span>
            <span className="text-sm text-ink-soft">índice</span>
            {delta !== null && delta !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? "text-accent-ink" : "text-alert-ink"}`}>
                {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
            {delta === 0 && <Minus className="h-3 w-3 text-ink-faint" />}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-ink-faint">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : n === 0 ? (
        <div className="py-12 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink-faint">
            <Eye className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-soft">
            Sin datos suficientes todavía — comprueba alguna keyword para empezar el histórico.
          </p>
        </div>
      ) : (
        <>
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label="Evolución del posicionamiento">
            {/* Rejilla horizontal (escala izquierda: nº keywords) */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const yy = PAD_T + f * plotH;
              const val = Math.round(leftMax * (1 - f));
              return (
                <g key={f}>
                  <line x1={PAD_L} x2={w - PAD_R} y1={yy} y2={yy} className="stroke-line" strokeWidth={1} />
                  <text x={PAD_L - 6} y={yy + 3} textAnchor="end" className="fill-ink-faint" fontSize={9}>
                    {val}
                  </text>
                </g>
              );
            })}
            {/* Etiquetas eje derecho (posición media) */}
            {[1, posMax / 2, posMax].map((pos) => (
              <text key={pos} x={w - PAD_R + 6} y={yRight(pos) + 3} textAnchor="start" className="fill-ink-faint" fontSize={9}>
                {Math.round(pos)}
              </text>
            ))}

            {/* Líneas de distribución */}
            {SERIES.map((s) =>
              n >= 2 ? (
                <path
                  key={s.key}
                  d={lineFor(s.key)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null
            )}

            {/* Línea de posición media (dashed, eje derecho) */}
            {posLine && (
              <path
                d={posLine}
                fill="none"
                stroke={POS_COLOR}
                strokeWidth={1.75}
                strokeDasharray="4 3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Puntos en el último dato */}
            {current && (
              <>
                {SERIES.map((s) => (
                  <circle key={s.key} cx={x(n - 1)} cy={yLeft(current[s.key])} r={3} fill={s.color} stroke="#fff" strokeWidth={1.5}>
                    <title>{`${s.label}: ${current[s.key]} keywords`}</title>
                  </circle>
                ))}
                {current.avgPosition !== null && (
                  <circle cx={x(n - 1)} cy={yRight(current.avgPosition)} r={3} fill={POS_COLOR} stroke="#fff" strokeWidth={1.5}>
                    <title>{`Posición media: ${current.avgPosition}`}</title>
                  </circle>
                )}
              </>
            )}

            {/* Etiquetas eje X */}
            {points.map((p, i) =>
              i % labelStep === 0 || i === n - 1 ? (
                <text key={`l-${p.date}`} x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-faint" fontSize={9}>
                  {fmtShort(new Date(p.date))}
                </text>
              ) : null
            )}
          </svg>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-ink-soft">
            {SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 border-t border-dashed" style={{ borderColor: POS_COLOR }} />
              Posición media
            </span>
            <span className="text-xs font-semibold text-ink-faint">· eje izq: nº keywords · eje der: posición</span>
          </div>
        </>
      )}
      {n === 1 && <p className="mt-1 text-xs text-ink-faint">Necesita al menos 2 días con chequeos para ver la evolución.</p>}
    </div>
  );
}
