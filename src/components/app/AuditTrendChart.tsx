"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, TrendingUp } from "lucide-react";

type CategoryScore = { score: number; max: number; detail?: Record<string, number> };
type CategoryScores = {
  indexabilidad: CategoryScore;
  enlaces: CategoryScore;
  onpage: CategoryScore;
  rendimiento: CategoryScore | null;
  accesibilidadImagenes: CategoryScore;
};

type AuditRun = {
  id: string;
  status: string;
  overallScore: number | null;
  categoryScores: CategoryScores | null;
  triggeredAt: string;
};

type Point = {
  id: string;
  date: Date;
  overall: number;
  categories: Record<string, number | null>;
};

// Serie general en brand-500; las categorías en la rampa índigo de la guía,
// distinguibles por trazo (continua/discontinua/punteada) antes que por color
// cuando hay más de 3 series.
const OVERALL_COLOR = "#4f5cf5";
const CATEGORIES: { key: keyof CategoryScores; label: string; color: string; dash?: string }[] = [
  { key: "indexabilidad", label: "Indexabilidad", color: "#3238ad" },
  { key: "enlaces", label: "Enlaces", color: "#7381ff", dash: "4 3" },
  { key: "onpage", label: "On-page", color: "#9da8ff", dash: "2 3" },
  { key: "rendimiento", label: "Rendimiento", color: "#c3caff", dash: "1 3" },
  { key: "accesibilidadImagenes", label: "Accesibilidad", color: "#9da8ff", dash: "6 3" },
];

function normalize(c: CategoryScore | null | undefined): number | null {
  if (!c || !c.max) return null;
  return Math.round((c.score / c.max) * 100);
}

function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtLong(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AuditTrendChart({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [w, setW] = useState(640);
  const roRef = useRef<ResizeObserver | null>(null);

  // Ref callback en vez de useRef + effect separado: el div del gráfico solo
  // existe en el DOM cuando loading/error/vacío ya se resolvieron (está
  // detrás de un ternario), así que un effect con deps [] se ejecutaba ANTES
  // de que el nodo montara, encontraba wrapRef.current===null y no volvía a
  // engancharse — el ancho se quedaba en el default (640) para siempre y el
  // SVG desbordaba la tarjeta. El ref callback se dispara exactamente cuando
  // React monta/desmonta el nodo real, sin depender de ningún effect.
  const wrapRef = (el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setW(el.getBoundingClientRect().width || 640);
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(cw);
    });
    ro.observe(el);
    roRef.current = ro;
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proyectos/${projectId}/auditorias`)
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar las auditorías");
        return r.json();
      })
      .then((data: AuditRun[]) => {
        if (cancelled) return;
        setRuns(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error desconocido");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const points: Point[] = runs
    .filter((r) => r.status === "completed" && r.overallScore !== null)
    .map((r) => {
      const cs = r.categoryScores;
      const categories: Record<string, number | null> = {};
      for (const c of CATEGORIES) categories[c.key] = cs ? normalize(cs[c.key]) : null;
      return { id: r.id, date: new Date(r.triggeredAt), overall: r.overallScore as number, categories };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const H = 160;
  const PAD_L = 30;
  const PAD_R = 14;
  const PAD_T = 12;
  const PAD_B = 26;
  const plotW = Math.max(10, w - PAD_L - PAD_R);
  const plotH = H - PAD_T - PAD_B;
  const n = points.length;

  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_T + (1 - v / 100) * plotH;

  function pathFor(getVal: (p: Point) => number | null): string {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      const v = getVal(p);
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  }

  const overallPath = pathFor((p) => p.overall);
  const yTicks = [0, 25, 50, 75, 100];
  const labelStep = Math.max(1, Math.ceil(n / 7));

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-4 w-4 text-ink-faint" />
        <h3 className="text-sm font-semibold text-ink">Evolución de la puntuación global</h3>
      </div>
      <p className="text-xs text-ink-faint mb-3">Puntuación global 0-100 por auditoría completada. Las líneas finas son las 5 categorías.</p>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-ink-faint">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-8 text-sm text-alert-ink">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : n === 0 ? (
        <p className="py-12 text-center text-sm text-ink-faint">Aún no hay auditorías completadas</p>
      ) : (
        <>
          <div ref={wrapRef} className="w-full overflow-hidden">
            <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label="Evolución del score de auditoría">
              {/* Rejilla horizontal + etiquetas eje Y (0-100) */}
              {yTicks.map((v) => (
                <g key={v}>
                  <line
                    x1={PAD_L}
                    x2={w - PAD_R}
                    y1={y(v)}
                    y2={y(v)}
                    className="stroke-line"
                    strokeWidth={1}
                  />
                  <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" className="fill-ink-faint" fontSize={9}>
                    {v}
                  </text>
                </g>
              ))}

              {/* Etiquetas eje X (fecha corta, subconjunto para no amontonar) */}
              {points.map((p, i) =>
                i % labelStep === 0 || i === n - 1 ? (
                  <text key={p.id} x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-faint" fontSize={9}>
                    {fmtShort(p.date)}
                  </text>
                ) : null
              )}

              {/* Líneas finas por categoría (normalizadas a 0-100) */}
              {CATEGORIES.map((c) => (
                <path
                  key={c.key}
                  d={pathFor((p) => p.categories[c.key])}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={1.25}
                  strokeDasharray={c.dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.75}
                />
              ))}

              {/* Línea principal del score global */}
              {n >= 2 && (
                <path
                  d={overallPath}
                  fill="none"
                  stroke={OVERALL_COLOR}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Marcadores del global con tooltip nativo (fecha + score) */}
              {points.map((p, i) => {
                const parts = [fmtLong(p.date), `Global: ${p.overall}/100`];
                for (const c of CATEGORIES) {
                  const v = p.categories[c.key];
                  if (v !== null) parts.push(`${c.label}: ${v}/100`);
                }
                return (
                  <circle
                    key={p.id}
                    cx={x(i)}
                    cy={y(p.overall)}
                    r={3.5}
                    fill={OVERALL_COLOR}
                    stroke="#fff"
                    strokeWidth={1.5}
                  >
                    <title>{parts.join("\n")}</title>
                  </circle>
                );
              })}
            </svg>
          </div>

          {n === 1 && (
            <p className="mt-1 text-xs text-ink-faint">
              Necesita al menos 2 auditorías para ver la evolución
            </p>
          )}

          {/* Leyenda */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: OVERALL_COLOR }} />
              <span className="font-medium text-ink-soft">Global (0-100)</span>
            </span>
            {CATEGORIES.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: c.color }} />
                {c.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
