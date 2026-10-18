"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, XCircle, GitCompareArrows, Check, MapPin, Star, MousePointerClick, Trash2, Search, Send, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import StatTile from "@/components/ui/StatTile";
import Modal from "@/components/app/Modal";
import { RadialGauge } from "@/components/ui/charts";
import { geogridCostUsd, geogridBusinessKeywordsCostUsd } from "@/lib/dataforseo/pricing";
import { fmtCredits } from "@/lib/credits";
import { importKeywordsToDefaultStudy } from "@/lib/keywords/client-import";
import GeogridMap from "@/components/app/GeogridMap";
import UrlLink from "@/components/app/UrlLink";
import GbpPicker, { type GbpCandidate } from "@/components/app/GbpPicker";
import type { MapsTopItem } from "@/lib/geogrid/maps";
import { isOwnSiteDomain } from "@/lib/geogrid/own-site";
import PageHeader from "@/components/app/PageHeader";
import HistoryDropdown from "@/components/app/HistoryDropdown";

// Item devuelto por "Ver keywords" — mismo shape que RankedKeyword de
// Competidores (mismo endpoint, incluida la dificultad real).
type BusinessKeyword = {
  keyword: string;
  position: number | null;
  volume: number | null;
  competition: string | null;
  cpc: number | null;
  monthlySearches: number[] | null;
  difficulty: number | null;
};

type GridPoint = {
  row: number;
  col: number;
  lat: number;
  lng: number;
  position: number | null;
  title: string | null;
  url?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  category?: string | null;
  address?: string | null;
  placeId?: string | null;
  domain?: string | null;
  top?: MapsTopItem[];
};

type GeogridRun = {
  id: string;
  keyword: string;
  gridSize: number;
  radiusKm: number;
  status: "pending" | "running" | "completed" | "failed";
  points: GridPoint[] | null;
  averagePosition: number | null;
  foundCount: number | null;
  errorMessage: string | null;
  triggeredAt: string;
};

// Color de cada celda por posición, en la escala índigo de la guía de estilo
// (heatmap: pálido → intenso según mejor posición) y el coral de alerta para
// las posiciones fuera de página 2. Gris azulado si el negocio no aparece.
function cellStyle(position: number | null): string {
  if (position === null) return "bg-surface-muted text-ink-faint";
  if (position <= 3) return "bg-brand-500 text-white";
  if (position <= 10) return "bg-brand-300 text-white";
  if (position <= 20) return "bg-brand-100 text-brand-700";
  return "bg-alert text-white";
}

function sortPoints(points: GridPoint[] | null): GridPoint[] {
  return (points ?? []).slice().sort((a, b) => a.row - b.row || a.col - b.col);
}

// Mismo semáforo que cellStyle pero como color plano, para la insignia
// numerada del ranking local (fondo de color + número en blanco).
function badgeColor(position: number): string {
  if (position <= 3) return "bg-brand-500";
  if (position <= 10) return "bg-brand-300";
  if (position <= 20) return "bg-brand-100 text-brand-700";
  return "bg-alert";
}

// Tabla de keywords de un negocio (mismo detalle que Competidores: volumen,
// posición, CPC, dificultad real) + botón para importarlas a un estudio de
// Keywords, sin coste adicional (los datos ya se pagaron al pedirlas aquí).
function BusinessKeywordsTable({
  projectId,
  domain,
  items,
}: {
  projectId: string;
  domain: string;
  items: BusinessKeyword[];
}) {
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleImport() {
    setImporting(true);
    const result = await importKeywordsToDefaultStudy(projectId, `Geogrid: ${domain}`, items);
    setImporting(false);
    setNotice(result.ok ? `${result.added} keywords añadidas al estudio General.` : result.error);
    setTimeout(() => setNotice(""), 5000);
  }

  if (items.length === 0) {
    return <p className="text-xs text-ink-faint py-1">Sin keywords orgánicas encontradas para este dominio.</p>;
  }

  return (
    <div className="mt-1.5 mb-1 bg-background rounded-lg p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-soft">{items.length} keywords</p>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-1 text-[11px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
        >
          {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Importar a estudio
        </button>
      </div>
      {notice && <p className="text-[11px] text-accent-ink">{notice}</p>}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {items.slice(0, 50).map((k, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-ink-soft truncate">{k.keyword}</span>
            <span className="text-ink-faint shrink-0 tabular-nums">
              {k.volume != null ? k.volume.toLocaleString("es-ES") : "—"}
              {k.position != null && ` · #${k.position}`}
              {k.difficulty != null && ` · dif. ${k.difficulty}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Panel lateral "quién gana aquí" (estilo LocalFalcon/DinoRank): el pack
// local real de un punto concreto de la rejilla, con valoración y web —
// mismos datos que ya trae la llamada pagada de ese punto, no cuesta nada
// nuevo mostrarlos. "Ver keywords" es la única acción de este panel que
// gasta (bajo demanda, por negocio con dominio resuelto).
function PointRankingPanel({
  point,
  projectId,
  runId,
}: {
  point: GridPoint | null;
  projectId: string;
  runId: string | null;
}) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [keywordsByDomain, setKeywordsByDomain] = useState<Record<string, BusinessKeyword[]>>({});
  const [freeDomains, setFreeDomains] = useState<Set<string>>(new Set());
  const [loadingDomain, setLoadingDomain] = useState<string | null>(null);
  const [kwError, setKwError] = useState("");

  // Al seleccionar un punto, precarga en segundo plano (sin coste, nunca
  // paga) las keywords de los negocios del pack que YA tienen un análisis
  // reciente en Competidores — así se pintan solas al expandir, sin que el
  // usuario tenga que pulsar "Ver keywords" para descubrir que era gratis.
  useEffect(() => {
    const domains = (point?.top ?? [])
      .map((item) => item.domain)
      .filter((d): d is string => Boolean(d) && isOwnSiteDomain(d));
    if (domains.length === 0 || !runId) return;
    let cancelled = false;
    fetch(`/api/proyectos/${projectId}/geogrid/${runId}/keywords-negocio?domains=${domains.map(encodeURIComponent).join(",")}`)
      .then((r) => r.json())
      .then((data: Record<string, BusinessKeyword[]>) => {
        if (cancelled || !data || typeof data !== "object") return;
        setKeywordsByDomain((prev) => ({ ...prev, ...data }));
        setFreeDomains((prev) => new Set([...prev, ...Object.keys(data)]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [point, runId, projectId]);

  async function toggleKeywords(domain: string) {
    if (expandedDomain === domain) {
      setExpandedDomain(null);
      return;
    }
    setExpandedDomain(domain);
    setKwError("");
    if (keywordsByDomain[domain] || !runId) return; // ya en caché de esta sesión
    setLoadingDomain(domain);
    const res = await fetch(`/api/proyectos/${projectId}/geogrid/${runId}/keywords-negocio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const data = await res.json();
    setLoadingDomain(null);
    if (!res.ok) {
      setKwError(data.error ?? "Error al buscar las keywords");
      return;
    }
    setKeywordsByDomain((prev) => ({ ...prev, [domain]: data.items }));
  }

  if (!point) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-ink-faint py-10">
        <MousePointerClick className="h-5 w-5" />
        <p className="text-xs">Haz clic en un punto del mapa para ver quién gana el pack local ahí.</p>
      </div>
    );
  }
  const top = point.top ?? [];
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-faint mb-2">
        Punto ({point.row + 1},{point.col + 1}) ·{" "}
        {point.position === null ? "no aparece aquí" : `tú vas #${point.position}`}
      </p>
      {top.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin negocios detectados en este punto.</p>
      ) : (
        <ul className="divide-y divide-line">
          {top.map((item) => (
            <li
              key={item.position}
              className={cn("py-2 flex gap-2 rounded-md", item.isMatch && "bg-accent-tint -mx-2 px-2")}
            >
              <span
                className={cn(
                  "h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5",
                  badgeColor(item.position)
                )}
              >
                {item.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">
                  {item.title}
                  {item.isMatch && <span className="ml-1 text-[10px] font-semibold text-accent-ink">· TÚ</span>}
                </p>
                <p className="text-xs text-ink-soft flex items-center gap-1 flex-wrap">
                  {item.rating !== null ? (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {item.rating.toFixed(1)}/5.0{item.reviewsCount !== null && ` (${item.reviewsCount})`}
                    </span>
                  ) : (
                    <span className="text-ink-faint">Sin valoraciones</span>
                  )}
                  {item.category && <span className="text-ink-faint">· {item.category}</span>}
                </p>
                {item.address && <p className="text-[11px] text-ink-faint truncate">{item.address}</p>}
                {(item.phone || item.totalPhotos != null || item.isClaimed != null) && (
                  <p className="text-[11px] text-ink-faint">
                    {[
                      item.phone,
                      item.totalPhotos != null ? `${item.totalPhotos} fotos` : null,
                      item.isClaimed != null ? (item.isClaimed ? "ficha reclamada" : "ficha sin reclamar") : null,
                      item.priceLevel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {item.hours && <p className="text-[11px] text-ink-faint">{item.hours}</p>}
                {item.additionalCategories && <p className="text-[11px] text-ink-faint">También: {item.additionalCategories.join(", ")}</p>}
                {item.localJustifications && <p className="text-[11px] italic text-ink-faint">{item.localJustifications[0]}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  {item.url && <UrlLink url={item.url} className="text-xs" />}
                  {item.domain && !isOwnSiteDomain(item.domain) && (
                    <span
                      className="text-[11px] text-ink-faint"
                      title={`Su ficha enlaza a ${item.domain}, no a una web propia: sus keywords serían las de toda esa plataforma`}
                    >
                      Sin web propia
                    </span>
                  )}
                  {item.domain && isOwnSiteDomain(item.domain) && (
                    <button
                      onClick={() => toggleKeywords(item.domain as string)}
                      className={cn(
                        "flex items-center gap-1 text-[11px] shrink-0",
                        freeDomains.has(item.domain) ? "text-accent-ink hover:text-accent-ink" : "text-ink-soft hover:text-ink"
                      )}
                      title={
                        freeDomains.has(item.domain)
                          ? `Ya disponible gratis (analizado antes en Competidores) — ${item.domain}`
                          : `Ver keywords de ${item.domain} (${fmtCredits(geogridBusinessKeywordsCostUsd())})`
                      }
                    >
                      {loadingDomain === item.domain ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Search className="h-3 w-3" />
                      )}
                      Ver keywords
                      {freeDomains.has(item.domain) && <span className="text-[10px]">· gratis</span>}
                    </button>
                  )}
                </div>
                {expandedDomain === item.domain && item.domain && (
                  <>
                    {kwError && <p className="text-[11px] text-alert-ink mt-1">{kwError}</p>}
                    {keywordsByDomain[item.domain] && (
                      <BusinessKeywordsTable projectId={projectId} domain={item.domain} items={keywordsByDomain[item.domain]} />
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Resumen agregado "quién gana en toda la rejilla": no solo el punto
// seleccionado, sino cuántos puntos del run entero gana cada competidor y su
// posición media — agrupado por placeId (más fiable que el título) sobre
// datos ya guardados, sin coste adicional.
function GridWinnersSummary({ points, gridSize }: { points: GridPoint[]; gridSize: number }) {
  const totals = points.length;
  const byBusiness = new Map<
    string,
    {
      title: string;
      rating: number | null;
      reviews: number | null;
      points: number;
      posSum: number;
      isMatch: boolean;
      phone: string | null;
      photos: number | null;
      claimed: boolean | null;
      category: string | null;
    }
  >();
  for (const p of points) {
    for (const item of p.top ?? []) {
      const key = item.placeId || item.title;
      const cur =
        byBusiness.get(key) ??
        {
          title: item.title,
          rating: item.rating,
          reviews: item.reviewsCount,
          points: 0,
          posSum: 0,
          isMatch: item.isMatch,
          phone: item.phone ?? null,
          photos: item.totalPhotos ?? null,
          claimed: item.isClaimed ?? null,
          category: item.category,
        };
      cur.points += 1;
      cur.posSum += item.position;
      byBusiness.set(key, cur);
    }
  }
  const ranked = [...byBusiness.values()]
    .map((b) => ({ ...b, avgPosition: Math.round((b.posSum / b.points) * 10) / 10 }))
    .sort((a, b) => b.points - a.points || a.avgPosition - b.avgPosition)
    .slice(0, 10);

  if (ranked.length === 0) return null;

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-ink-soft" />
        <h3 className="text-sm font-semibold text-ink">Quién gana en toda la rejilla</h3>
      </div>
      <p className="text-xs text-ink-faint">
        En cuántos de los {totals} puntos ({gridSize}×{gridSize}) aparece cada negocio, y su posición
        media — calculado sobre los datos ya guardados de este geogrid, sin coste adicional.
      </p>
      <table className="data-table data-table-compact w-full text-xs">
        <thead>
          <tr className="text-left text-ink-faint">
            <th className="font-medium">Negocio</th>
            <th className="text-right font-medium">Puntos</th>
            <th className="text-right font-medium">Media</th>
            <th className="text-right font-medium">Valoración</th>
            <th className="text-right font-medium">Fotos</th>
            <th className="font-medium">Ficha</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((b, i) => (
            <tr key={i} className={cn(b.isMatch && "bg-accent-tint")}>
              <td className="max-w-[200px]">
                <p className="truncate text-sm text-ink">
                  {b.title}
                  {b.isMatch && <span className="ml-1 text-[10px] font-semibold text-accent-ink">· TÚ</span>}
                </p>
                <p className="truncate text-[11px] text-ink-faint">{[b.category, b.phone].filter(Boolean).join(" · ")}</p>
              </td>
              <td className="text-right tabular-nums text-ink-soft">{b.points}/{totals}</td>
              <td className="text-right tabular-nums text-ink-soft">#{b.avgPosition}</td>
              <td className="text-right tabular-nums text-ink-soft">
                {b.rating !== null ? `${b.rating.toFixed(1)}${b.reviews !== null ? ` (${b.reviews})` : ""}` : "—"}
              </td>
              <td className="text-right tabular-nums text-ink-soft">{b.photos ?? "—"}</td>
              <td className="text-ink-soft">{b.claimed === null ? "—" : b.claimed ? "reclamada" : "sin reclamar"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Heatmap reutilizable: pinta la rejilla N×N de un run (o de una comparación).
function Heatmap({ run, compact = false }: { run: { gridSize: number; points: GridPoint[] | null }; compact?: boolean }) {
  const points = sortPoints(run.points);
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${run.gridSize}, minmax(0, 1fr))` }}>
      {points.map((p, i) => (
        <div
          key={i}
          title={p.position === null ? "No aparece en este punto" : `#${p.position}${p.title ? " · " + p.title : ""}`}
          className={cn(
            "aspect-square rounded-md flex items-center justify-center font-semibold",
            compact ? "text-[10px]" : "text-xs",
            cellStyle(p.position)
          )}
        >
          {p.position === null ? "—" : `#${p.position}`}
        </div>
      ))}
    </div>
  );
}

// Color del delta entre dos runs (A=antes, B=después). Devuelve clase + texto.
function deltaStyle(posA: number | null, posB: number | null): { cls: string; label: string } {
  if (posA === null && posB === null) return { cls: "bg-surface-muted text-ink-faint", label: "—" };
  if (posA === null && posB !== null) return { cls: "bg-brand-300 text-accent-ink", label: `#${posB} ✓` }; // apareció
  if (posA !== null && posB === null) return { cls: "bg-alert text-white", label: "perdido" }; // desapareció
  if (posA !== null && posB !== null) {
    if (posB < posA) return { cls: "bg-brand-500 text-white", label: `#${posB} ▼${posA - posB}` }; // mejoró
    if (posB > posA) return { cls: "bg-alert text-white", label: `#${posB} ▲${posB - posA}` }; // empeoró
    return { cls: "bg-ink-faint text-ink-soft", label: `#${posB} =` }; // igual
  }
  return { cls: "bg-surface-muted text-ink-faint", label: "—" };
}

const GRID_OPTIONS = [3, 5, 7];

export default function GeogridView({
  projectId,
  centerLat: initialLat,
  centerLng: initialLng,
  businessName: initialBusinessName,
  gbpName: initialGbpName,
  gbpPlaceId: initialGbpPlaceId,
}: {
  projectId: string;
  centerLat: number | null;
  centerLng: number | null;
  businessName: string | null;
  gbpName: string | null;
  gbpPlaceId: string | null;
}) {
  // Estado local (no solo props): al elegir una ficha de Google con
  // GbpPicker, el centro del mapa y el nombre deben actualizarse al
  // instante sin recargar la página — la fuente inicial es el proyecto,
  // pero a partir de ahí manda lo que el usuario elija en esta sesión.
  const [centerLat, setCenterLat] = useState(initialLat);
  const [centerLng, setCenterLng] = useState(initialLng);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [gbpName, setGbpName] = useState(initialGbpName);
  const [gbpPlaceId, setGbpPlaceId] = useState(initialGbpPlaceId);
  const [fichaOpen, setFichaOpen] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [gridSize, setGridSize] = useState(5);
  const [radiusKm, setRadiusKm] = useState(3);

  const [history, setHistory] = useState<GeogridRun[]>([]);
  const [current, setCurrent] = useState<GeogridRun | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<{ row: number; col: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function pollRun(runId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/proyectos/${projectId}/geogrid/${runId}`);
      if (!res.ok) return;
      const data: GeogridRun = await res.json();
      setCurrent(data);
      setHistory((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      if (data.status === "completed" || data.status === "failed") stopPolling();
    }, 3000);
  }

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/geogrid`)
      .then((r) => r.json())
      .then((data: GeogridRun[]) => {
        if (Array.isArray(data)) {
          setHistory(data);
          const latest = data[0];
          if (latest) {
            setCurrent(latest);
            if (latest.status === "pending" || latest.status === "running") pollRun(latest.id);
          }
        }
        setLoadingHistory(false);
      });
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Selección por defecto en el mapa: el punto donde mejor posiciona el
  // negocio (o el primero si no aparece en ninguno) — así el panel lateral
  // nunca arranca vacío al cargar un run ya completado. Ajuste de estado
  // durante el render (no dentro de un effect), como recomienda
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-based-on-a-prop-change
  const [selectedPointForRunId, setSelectedPointForRunId] = useState(current?.id);
  if (current?.id !== selectedPointForRunId) {
    setSelectedPointForRunId(current?.id);
    if (current?.status !== "completed" || !current.points || current.points.length === 0) {
      setSelectedPoint(null);
    } else {
      const points = sortPoints(current.points);
      const withPosition = points.filter((p) => p.position !== null);
      const best = withPosition.length > 0
        ? withPosition.reduce((a, b) => ((a.position as number) <= (b.position as number) ? a : b))
        : points[0];
      setSelectedPoint({ row: best.row, col: best.col });
    }
  }

  async function loadDetail(runId: string) {
    const res = await fetch(`/api/proyectos/${projectId}/geogrid/${runId}`);
    if (res.ok) setCurrent(await res.json());
  }

  // Borra un geogrid del historial. Si era el current, sustituye por el
  // siguiente disponible (o null si no quedan). El endpoint bloquea el
  // borrado de runs pending/running (409) — aquí lo mostramos como error.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function handleDelete(runId: string, keyword: string) {
    if (!window.confirm(`¿Borrar el geogrid de «${keyword}»? No se puede deshacer.`)) return;
    setDeletingId(runId);
    setError("");
    try {
      const res = await fetch(`/api/proyectos/${projectId}/geogrid/${runId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Error al borrar el geogrid");
        return;
      }
      setHistory((prev) => {
        const next = prev.filter((r) => r.id !== runId);
        // Si era el current, saltamos al siguiente disponible (o null).
        setCurrent((cur) => {
          if (cur?.id !== runId) return cur;
          return next[0] ?? null;
        });
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleGbpApplied(c: GbpCandidate) {
    setGbpPlaceId(c.placeId);
    setGbpName(c.title);
    if (c.lat !== null) setCenterLat(c.lat);
    if (c.lng !== null) setCenterLng(c.lng);
    if (!businessName) setBusinessName(c.title);
  }

  async function handleTrigger(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTriggering(true);
    const res = await fetch(`/api/proyectos/${projectId}/geogrid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, gridSize, radiusKm }),
    });
    const data = await res.json();
    setTriggering(false);
    if (!res.ok) {
      setError(data.error ?? "Error al lanzar el geogrid");
      return;
    }
    setHistory((prev) => [data, ...prev]);
    setCurrent(data);
    pollRun(data.id);
  }

  // Delta de posición media de un run vs el anterior de la misma keyword.
  function avgDelta(run: GeogridRun): { improved: boolean; worsened: boolean; diff: number } | null {
    if (run.averagePosition === null) return null;
    const idx = history.findIndex((r) => r.id === run.id);
    // history va de nuevo a viejo: el "anterior" (más viejo) es el siguiente con misma keyword.
    for (let j = idx + 1; j < history.length; j++) {
      if (history[j].keyword === run.keyword && history[j].averagePosition !== null) {
        const diff = history[j].averagePosition! - run.averagePosition!; // >0 = mejoró (bajó el nº)
        return { improved: diff > 0, worsened: diff < 0, diff: Math.abs(diff) };
      }
    }
    return null;
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  const compareRuns = compareIds
    .map((id) => history.find((r) => r.id === id))
    .filter((r): r is GeogridRun => !!r);
  // La comparación solo es coherente si misma keyword + mismo gridSize.
  const canCompare =
    compareRuns.length === 2 &&
    compareRuns[0].keyword === compareRuns[1].keyword &&
    compareRuns[0].gridSize === compareRuns[1].gridSize &&
    compareRuns.every((r) => r.status === "completed" && r.points);
  // Ordenar: antes (más viejo) primero, después (más nuevo) segundo.
  const [runBefore, runAfter] = [...compareRuns].sort(
    (a, b) => new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime()
  );

  // Delta por celda entre los dos runs comparados.
  let deltaCells: { posA: number | null; posB: number | null }[] = [];
  if (canCompare && runBefore && runAfter) {
    const mapA = new Map(sortPoints(runBefore.points).map((p) => [`${p.row},${p.col}`, p.position]));
    deltaCells = sortPoints(runAfter.points).map((p) => ({
      posA: mapA.get(`${p.row},${p.col}`) ?? null,
      posB: p.position,
    }));
  }

  const selectedPointData: GridPoint | null =
    selectedPoint && current?.points
      ? current.points.find((p) => p.row === selectedPoint.row && p.col === selectedPoint.col) ?? null
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SEO local · Geogrid"
        title="Geogrid"
        description="Mapa de calor de tu posición en Google Maps, punto a punto alrededor del negocio. Cada escaneo se guarda: lanza uno hoy y otro en un mes para ver la evolución y compararlos."
      />

      {/* Nuevo escaneo: todo lo que hace falta para lanzarlo, arriba y en una línea */}
      <form onSubmit={handleTrigger} className="rounded-[20px] border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFichaOpen(true)}
            className="flex min-w-0 max-w-[260px] items-center gap-2 rounded-full border border-line bg-surface-muted px-3.5 py-2 text-left text-sm hover:border-brand-100"
            title="Ficha de Google del negocio que se busca en cada punto"
          >
            <MapPin className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{gbpName || businessName || "Elige la ficha"}</span>
              <span className="block text-[11px] text-ink-faint">{gbpPlaceId ? "Ficha verificada · cambiar" : "Ficha del negocio · elegir"}</span>
            </span>
          </button>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Keyword a medir, p. ej. «dentista oviedo»"
            required
            className="min-w-[220px] flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <div className="inline-flex rounded-full bg-surface-muted p-1" title="Tamaño de la rejilla">
            {GRID_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGridSize(n)}
                className={cn("rounded-full px-3 py-1 text-sm font-semibold", gridSize === n ? "bg-surface text-ink shadow-sm" : "text-ink-soft")}
              >
                {n}×{n}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft" title="Radio de la rejilla alrededor del negocio">
            Radio
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-20 rounded-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            km
          </label>
          <button
            type="submit"
            disabled={triggering || current?.status === "pending" || current?.status === "running"}
            className="ml-auto flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {triggering && <Loader2 className="h-4 w-4 animate-spin" />}
            Ejecutar geogrid <span className="font-normal text-white/70">{fmtCredits(geogridCostUsd(gridSize))}</span>
          </button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert-ink">{error}</p>}
      </form>

      {(current?.status === "pending" || current?.status === "running") && (
        <div className="flex items-center gap-2 text-sm bg-background text-ink-soft px-3 py-2 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          {current.status === "pending"
            ? "En cola, empezará en breve (el cron lo procesa cada 60s)..."
            : `Rastreando rejilla ${current.gridSize}×${current.gridSize} (${current.keyword})...`}
        </div>
      )}

      {current?.status === "failed" && (
        <div className="flex items-center gap-2 text-sm bg-alert-tint text-alert-ink px-3 py-2 rounded-lg">
          <XCircle className="h-4 w-4 shrink-0" />
          {current.errorMessage ?? "El geogrid ha fallado."}
        </div>
      )}


      <Modal open={fichaOpen} title="Ficha de Google del negocio" onClose={() => setFichaOpen(false)}>
        <GbpPicker
          projectId={projectId}
          currentGbpName={gbpName}
          currentPlaceId={gbpPlaceId}
          onApplied={(c) => {
            handleGbpApplied(c);
            setFichaOpen(false);
          }}
        />
      </Modal>

      {/* Resumen del escaneo que estás viendo */}
      {current?.status === "completed" && current.points && (() => {
        const total = current.gridSize * current.gridSize;
        const found = current.foundCount ?? 0;
        const top3 = current.points.filter((pt) => pt.position !== null && pt.position <= 3).length;
        return (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile highlight label="Posición media" value={current.averagePosition !== null ? `#${current.averagePosition}` : "—"} hint={`«${current.keyword}»`} />
            <div className="flex items-center justify-between gap-3 rounded-[20px] border border-line bg-surface p-5 shadow-card">
              <div>
                <p className="text-[13px] font-semibold text-ink-soft">Puntos donde apareces</p>
                <p className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">
                  {found}<span className="text-xl font-bold text-ink-faint"> / {total}</span>
                </p>
                <p className="mt-2 text-xs text-ink-faint">en la rejilla {current.gridSize}×{current.gridSize}</p>
              </div>
              <RadialGauge value={(found / Math.max(1, total)) * 100} size={72} />
            </div>
            <StatTile label="Puntos en top 3" value={top3} hint="donde sales en el pack local" />
            <StatTile label="Escaneo" value={<span className="text-2xl">{new Date(current.triggeredAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>} hint={`radio ${current.radiusKm} km`} />
          </div>
        );
      })()}

      <div className="space-y-4">
      {/* Mapa real (Leaflet/OSM), siempre visible desde el centro del negocio
          aunque todavía no haya ningún geogrid ejecutado, con un círculo
          numerado por punto (mismo lenguaje visual que LocalFalcon/DinoRank)
          y un panel lateral con el pack local real del punto seleccionado. */}
      <div className="space-y-3 rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-ink-soft" />
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {current?.status === "completed" ? current.keyword : businessName ?? "Centro del negocio"}
            </h3>
            {current?.status === "completed" && !canCompare && (
              <p className="text-xs text-ink-faint">
                {current.gridSize}×{current.gridSize} · radio {current.radiusKm} km ·{" "}
                {current.foundCount ?? 0}/{current.gridSize * current.gridSize} puntos posicionando
                {current.averagePosition !== null && <> · media #{current.averagePosition}</>}
                {" · "}{new Date(current.triggeredAt).toLocaleDateString("es-ES")}
              </p>
            )}
          </div>
        </div>

        {centerLat === null || centerLng === null ? (
          <p className="text-sm text-ink-soft">
            Faltan las coordenadas del negocio — defínelas en la ficha del proyecto para ver el mapa
            y poder ejecutar un geogrid.
          </p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <GeogridMap
                centerLat={centerLat}
                centerLng={centerLng}
                radiusKm={current?.status === "completed" ? current.radiusKm : radiusKm}
                points={current?.status === "completed" ? current.points : null}
                keyword={current?.status === "completed" ? current.keyword : undefined}
                selected={selectedPoint}
                onSelectPoint={(p) => setSelectedPoint({ row: p.row, col: p.col })}
              />
            </div>
            <div className="lg:w-72 shrink-0 lg:border-l lg:border-line lg:pl-4 lg:max-h-[440px] lg:overflow-y-auto">
              <PointRankingPanel point={selectedPointData} projectId={projectId} runId={current?.id ?? null} />
            </div>
          </div>
        )}

        {current?.status === "completed" && current.points && !canCompare && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft pt-1">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-brand-500" /> Top 3</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-brand-300" /> 4–10</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-brand-300" /> 11–20</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-alert" /> +20</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-ink-faint" /> No aparece</span>
          </div>
        )}
      </div>

      {current?.status === "completed" && current.points && !canCompare && (
        <GridWinnersSummary points={current.points} gridSize={current.gridSize} />
      )}

      {canCompare && runBefore && runAfter && (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">
                Comparación · {runAfter.keyword}
              </p>
              <p className="text-xs text-ink-faint">
                {new Date(runBefore.triggeredAt).toLocaleDateString("es-ES")} →{" "}
                {new Date(runAfter.triggeredAt).toLocaleDateString("es-ES")}
              </p>
            </div>
            <button
              onClick={() => setCompareIds([])}
              className="text-xs text-ink-faint hover:text-ink"
            >
              Cerrar
            </button>
          </div>

          {/* Grid de deltas: el progreso por celda */}
          <div>
            <p className="text-xs text-ink-soft mb-2">Cambios por punto</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${runAfter.gridSize}, minmax(0, 1fr))` }}>
              {deltaCells.map((c, i) => {
                const d = deltaStyle(c.posA, c.posB);
                return (
                  <div
                    key={i}
                    title={`Antes: ${c.posA === null ? "—" : "#" + c.posA} · Después: ${c.posB === null ? "—" : "#" + c.posB}`}
                    className={cn("aspect-square rounded-md flex items-center justify-center text-[10px] font-semibold", d.cls)}
                  >
                    {d.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Los dos mapas lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[11px] text-ink-faint">Antes · {new Date(runBefore.triggeredAt).toLocaleDateString("es-ES")}</p>
              <Heatmap run={runBefore} compact />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-ink-faint">Después · {new Date(runAfter.triggeredAt).toLocaleDateString("es-ES")}</p>
              <Heatmap run={runAfter} compact />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand-500" /> Mejoró</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand-300" /> Apareció</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-alert" /> Empeoró</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-alert" /> Perdido</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-ink-faint" /> Igual</span>
          </div>
        </div>
      )}

      </div>
      <HistoryDropdown count={history.length} loading={loadingHistory} title="Histórico">
        {(close) => (
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          {history.filter((r) => r.status === "completed").length >= 2 && (
            <button
              onClick={() => {
                setCompareMode((v) => !v);
                setCompareIds([]);
              }}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border",
                compareMode ? "bg-brand text-white border-brand" : "text-ink-soft border-line hover:bg-background"
              )}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              {compareMode ? "Salir de comparación" : "Comparar"}
            </button>
          )}
        </div>

        {loadingHistory ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
        ) : history.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no se ha ejecutado ningún geogrid.</p>
        ) : (
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {history.map((run) => {
              const delta = avgDelta(run);
              const selected = compareIds.includes(run.id);
              const completed = run.status === "completed";
              return (
                <div
                  key={run.id}
                  className={cn(
                    "bg-surface rounded-lg border p-3 flex items-center gap-3",
                    current?.id === run.id ? "border-brand" : "border-line",
                    selected && compareMode && "ring-1 ring-brand"
                  )}
                >
                  {compareMode && completed && (
                    <button
                      onClick={() => toggleCompare(run.id)}
                      className={cn(
                        "h-5 w-5 rounded border flex items-center justify-center shrink-0",
                        selected ? "bg-brand border-brand text-white" : "border-line"
                      )}
                      aria-label="Seleccionar para comparar"
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button onClick={() => { if (!compareMode) { loadDetail(run.id); close(); } }} className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink truncate">{run.keyword}</span>
                      {delta && (
                        <span className={cn("text-[11px] font-medium", delta.improved ? "text-accent-ink" : delta.worsened ? "text-alert-ink" : "text-ink-faint")}>
                          {delta.improved ? "▼" : delta.worsened ? "▲" : "="}{Number(delta.diff.toFixed(1))}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint">
                      {new Date(run.triggeredAt).toLocaleDateString("es-ES")}
                      {completed && (
                        <> · {run.gridSize}×{run.gridSize} · {run.foundCount ?? 0}/{run.gridSize * run.gridSize} puntos
                          {run.averagePosition !== null && ` · media #${run.averagePosition}`}</>
                      )}
                      {run.status === "failed" && " · error"}
                      {(run.status === "pending" || run.status === "running") && " · en curso"}
                    </p>
                  </button>
                  {compareMode && compareIds.length === 2 && !canCompare && selected && (
                    <span className="text-[10px] text-accent-ink max-w-[120px] text-right">
                      Misma keyword y rejilla para comparar
                    </span>
                  )}
                  {!compareMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(run.id, run.keyword);
                      }}
                      disabled={
                        deletingId === run.id ||
                        run.status === "pending" ||
                        run.status === "running"
                      }
                      className="p-1 text-ink-faint hover:text-alert-ink disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      title={
                        run.status === "pending" || run.status === "running"
                          ? "No se puede borrar mientras se está procesando"
                          : "Borrar geogrid"
                      }
                    >
                      {deletingId === run.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {compareMode && compareIds.length < 2 && (
          <p className="text-xs text-ink-faint">Selecciona 2 geogrids de la misma keyword y rejilla para compararlos.</p>
        )}
      </div>
        )}
      </HistoryDropdown>
    </div>
  );
}
