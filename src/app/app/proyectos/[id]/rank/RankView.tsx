"use client";

import ShareOfVoiceCard from "@/components/app/ShareOfVoiceCard";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as Select from "@radix-ui/react-select";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  RefreshCw,
  Plus,
  ArrowDownToLine,
  Search,
  Download,
  MapPin,
  Pencil,
  X,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rankMonthlyCostUsd } from "@/lib/dataforseo/pricing";
import { downloadCsv } from "@/lib/csv";
import RankVisibilityChart from "@/components/app/RankVisibilityChart";
import { RadialGauge } from "@/components/ui/charts";
import Modal from "@/components/app/Modal";
import PageHeader from "@/components/app/PageHeader";
import SerpPanoramaCard from "@/components/app/SerpPanoramaCard";
import type { SerpPanorama } from "@/lib/serp/panorama";
import { serpFeatureLabel } from "@/lib/serp/features";
import Pill from "@/components/app/Pill";
import LocationPicker, { type LocationValue } from "@/components/app/LocationPicker";
import UrlLink from "@/components/app/UrlLink";
import { RANK_FREQUENCY_LABELS, RANK_SCAN_FREQUENCIES } from "@/lib/rank/constants";
import { fmtCredits } from "@/lib/credits";

type RankPosition = {
  id: string;
  checkedAt: string;
  position: number | null;
  url: string | null;
  // Copy con el que Google mostraba la URL en esa fecha — llega gratis en el
  // SERP ya pagado; el histórico conserva la evolución del título/meta.
  title?: string | null;
  description?: string | null;
  // Panorama del SERP de ese chequeo (bloques, pack local, snippet destacado…).
  serp?: SerpPanorama | null;
};

type RankKeyword = {
  id: string;
  keyword: string;
  locationCode: number;
  locationName: string | null;
  languageCode: string;
  device: string;
  frequency: string;
  depth: number;
  lastPosition: number | null;
  bestPosition: number | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  positions: RankPosition[];
  searchVolume: number | null;
  group: string | null;
  // Próximo escaneo automático calculado por el servidor (misma fórmula que
  // el cron) — null si la frecuencia es "manual" (sin auto-escaneo).
  nextScanAt: string | null;
  // Precargados desde el mismo GET (gratis, ya en BD) — así la fila muestra
  // un badge sin clic y expandirla no dispara ninguna llamada de red.
  competitorPositions: CompetitorPosition[];
  tfidfAvailable: boolean;
};

type SortKey = "keyword" | "volume" | "position" | "best" | "delta" | (string & {});

type StudyListItem = { id: string; name: string; _count: { keywords: number }; hasStructure: boolean };

type CompetitorPosition = {
  domain: string;
  position: number | null;
  url: string | null;
  title?: string | null;
  description?: string | null;
  checkedAt: string;
};

const DEPTHS = [10, 30, 50, 100];
const MAX_DATE_COLUMNS = 8;

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

// Escala de color por posición — misma idea que scoring.ts en Auditoría:
// explicable y con umbrales fijos, nunca una caja negra. "Sin chequeo" (n/s)
// se distingue de "chequeado pero fuera del depth" (—): son señales distintas.
function positionCell(position: number | null | undefined, checked: boolean): { bg: string; text: string; label: string } {
  if (!checked) return { bg: "bg-background", text: "text-ink-faint", label: "n/s" };
  if (position === null || position === undefined) return { bg: "bg-alert-tint", text: "text-alert-ink", label: "—" };
  if (position <= 3) return { bg: "bg-brand-100", text: "text-brand-700", label: String(position) };
  if (position <= 10) return { bg: "bg-accent-tint", text: "text-accent-ink", label: String(position) };
  if (position <= 20) return { bg: "bg-accent-tint", text: "text-accent-ink", label: String(position) };
  if (position <= 50) return { bg: "bg-surface-muted", text: "text-ink-soft", label: String(position) };
  return { bg: "bg-alert-tint", text: "text-alert-ink", label: String(position) };
}

// Sparkline SVG inline (sin librería de gráficos, mismo principio "sin
// dependencia" que el árbol de URLs del Módulo). position null (fuera del
// top-100) se dibuja en el fondo del gráfico (peor caso).
function PositionSparkline({ positions }: { positions: RankPosition[] }) {
  const data = positions
    .filter((p) => p.position !== null)
    .map((p) => p.position as number);
  if (data.length < 2) {
    return <span className="text-xs text-ink-faint">Sin histórico suficiente</span>;
  }

  const W = 240;
  const H = 60;
  const PAD = 6;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  // En SEO, mejor posición = número más bajo. Invertimos el eje Y para que
  // "subir" en el gráfico signifique mejorar (posición 1 arriba).
  const x = (i: number) => PAD + (i / (data.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + ((v - min) / range) * (H - 2 * PAD);

  const points = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={W} height={H} className="text-ink-faint">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} className="fill-brand-500" />
      ))}
    </svg>
  );
}

function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onClick: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = active === sortKey;
  return (
    <th className={cn("py-2.5 font-semibold whitespace-nowrap", className)}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "flex items-center gap-1 transition-colors hover:text-ink",
          align === "right" && "ml-auto flex-row-reverse",
          isActive ? "text-ink" : "text-ink-faint"
        )}
      >
        {label}
        {isActive ? (
          dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 text-ink-faint/60" />
        )}
      </button>
    </th>
  );
}

function TrendIcon({ kw }: { kw: RankKeyword }) {
  const last = kw.lastPosition;
  // positions viene ordenado desc ([0]=más reciente, [1]=anterior). Pero
  // lastPosition ya es [0]; usamos positions para el anterior.
  const prev = kw.positions[1]?.position ?? null;
  if (last === null || prev === null) {
    return <Minus className="h-3.5 w-3.5 text-ink-faint" />;
  }
  if (last < prev) {
    // número más bajo = mejor → flecha verde "subiendo"
    return <TrendingUp className="h-3.5 w-3.5 text-accent-ink" />;
  }
  if (last > prev) {
    return <TrendingDown className="h-3.5 w-3.5 text-alert-ink" />;
  }
  return <Minus className="h-3.5 w-3.5 text-ink-faint" />;
}

// Bloques del SERP que más importan (AI Overview, mapa y snippet destacado) en
// el último chequeo de una keyword. `positions` viene de más reciente a más antigua.
function latestFeatures(kw: { positions: RankPosition[] }): string[] {
  const f = kw.positions[0]?.serp?.features ?? [];
  return ["ai_overview", "local_pack", "featured_snippet"].filter((t) => f.includes(t));
}

export default function RankView({ projectId }: { projectId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"escribir" | "estudio" | "programar">("escribir");
  const [keywords, setKeywords] = useState<RankKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newKeyword, setNewKeyword] = useState("");
  const [newDevice, setNewDevice] = useState("desktop");
  const [newFrequency, setNewFrequency] = useState("monthly");
  const [newDepth, setNewDepth] = useState("30");
  const [newLocation, setNewLocation] = useState<LocationValue>(null);
  const [adding, setAdding] = useState(false);

  // Búsqueda, filtro por grupo y orden — la tabla no pagina (el volumen
  // típico por proyecto no lo justifica todavía), pero sí necesita estas
  // tres cosas para no volverse inmanejable a partir de 50+ keywords.
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [visibilityGroup, setVisibilityGroup] = useState("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [importStudyId, setImportStudyId] = useState("");
  const [importing, setImporting] = useState(false);

  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkAllProgress, setCheckAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [history, setHistory] = useState<RankPosition[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Copy histórico expandible por fila: al seleccionar una fecha con title/
  // snippet se despliega el "cómo lo mostraba Google" en ese chequeo.
  const [copyExpanded, setCopyExpanded] = useState<string | null>(null);

  // Programación explícita del escaneo conjunto (Project.rankScanFrequency /
  // rankNextScanAt) — tarjeta propia junto a la tabla (antes vivía escondida
  // dentro del formulario de "Añadir keyword", con un selector de frecuencia
  // propio en vez de compartir el del alta). scheduleDate en formato
  // "YYYY-MM-DD" (lo que da/espera <input type="date">).
  const [scheduleFrequency, setScheduleFrequency] = useState<string>("monthly");
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [savedSchedule, setSavedSchedule] = useState<{ frequency: string; date: string } | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  function loadKeywords() {
    return fetch(`/api/proyectos/${projectId}/rank/keywords`)
      .then((r) => r.json())
      .then((d: RankKeyword[]) => {
        if (Array.isArray(d)) setKeywords(d);
      });
  }

  useEffect(() => {
    Promise.all([
      loadKeywords(),
      fetch(`/api/proyectos/${projectId}/keywords/estudios`).then((r) => r.json()),
      fetch(`/api/proyectos/${projectId}`).then((r) => r.json()),
    ]).then(([, s, p]) => {
      if (Array.isArray(s)) setStudies(s as StudyListItem[]);
      if (p && p.rankScanFrequency && p.rankNextScanAt) {
        const date = String(p.rankNextScanAt).slice(0, 10);
        setScheduleDate(date);
        setScheduleFrequency(p.rankScanFrequency);
        setSavedSchedule({ frequency: p.rankScanFrequency, date });
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleSaveSchedule() {
    if (!scheduleDate) return;
    setError("");
    setScheduleSaving(true);
    const res = await fetch(`/api/proyectos/${projectId}/rank/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency: scheduleFrequency, nextScanAt: scheduleDate }),
    });
    const data = await res.json();
    setScheduleSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Error al guardar la programación");
      return;
    }
    setSavedSchedule({ frequency: scheduleFrequency, date: scheduleDate });
  }

  async function handleClearSchedule() {
    setError("");
    setScheduleSaving(true);
    const res = await fetch(`/api/proyectos/${projectId}/rank/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency: null }),
    });
    setScheduleSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error al quitar la programación");
      return;
    }
    setScheduleDate("");
    setSavedSchedule(null);
  }

  // Carga el histórico de una keyword. Se invoca desde el click de selección
  // (no desde un effect) para evitar el patrón setState-dentro-de-effect.
  async function loadHistory(kwId: string) {
    setLoadingHistory(true);
    try {
      const d: RankPosition[] = await fetch(
        `/api/proyectos/${projectId}/rank/keywords/${kwId}/historico`
      ).then((r) => r.json());
      if (Array.isArray(d)) setHistory(d);
    } finally {
      setLoadingHistory(false);
    }
  }

  // OJO: el efecto (fetch de historial) va en el cuerpo de la función, NUNCA
  // dentro del updater de setSelectedId — React (Strict Mode, activo por
  // defecto en `next dev`) puede invocar un updater dos veces para detectar
  // side effects, lo que duplicaba las llamadas y producía condiciones de
  // carrera: la fila expandía y volvía a colapsar sola en el segundo click,
  // dependiendo de qué llamada resolviera última. Los competidores YA NO se
  // piden aquí: vienen precargados en `keywords[i].competitorPositions`
  // desde el GET inicial (gratis, ya en BD) — expandir la fila es
  // instantáneo, sin ninguna llamada de red.
  function selectKeyword(kwId: string) {
    const next = selectedId === kwId ? null : kwId;
    setSelectedId(next);
    setHistory([]);
    if (next) {
      loadHistory(next);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);
    const res = await fetch(`/api/proyectos/${projectId}/rank/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // El backend acepta { keywords: "una por línea" } (bulk) y { keyword } (legacy).
      // Mandamos siempre bulk: con una sola línea también funciona.
      body: JSON.stringify({
        keywords: newKeyword,
        device: newDevice,
        frequency: newFrequency,
        depth: Number(newDepth),
        locationCode: newLocation?.code,
        locationName: newLocation?.name,
      }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setError(data.error ?? "Error al añadir las keywords");
      return;
    }
    // data = { added, skipped, checked, errors }. Lo dejamos 4s visible.
    const parts: string[] = [`${data.added} añadidas`];
    if (data.skipped > 0) parts.push(`${data.skipped} ya seguidas`);
    const errCount = Array.isArray(data.errors) ? data.errors.length : 0;
    if (errCount > 0) {
      const why = data.errors[0]?.error ?? "";
      parts.push(`${errCount} sin posición${why ? ` (${why})` : ""}`);
    }
    setErrorFor("add", parts.join(" · "));
    setNewKeyword("");
    setAddOpen(false);
    await loadKeywords();
  }

  async function handleGroup(kwId: string, group: string) {
    await fetch(`/api/proyectos/${projectId}/rank/keywords/${kwId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group }),
    });
    loadKeywords();
  }

  async function handleImport() {
    setError("");
    if (!importStudyId) {
      setError("Selecciona un estudio");
      return;
    }
    setImporting(true);
    const res = await fetch(`/api/proyectos/${projectId}/rank/importar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyId: importStudyId, device: newDevice, frequency: newFrequency, depth: Number(newDepth) }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setError(data.error ?? "Error al importar");
      return;
    }
    setError("");
    setImportStudyId("");
    await loadKeywords();
    // Deja constancia del resultado en lugar de un error.
    setErrorFor("import", `${data.created} importadas · ${data.skipped} ya seguidas`);
  }

  function setErrorFor(_kind: string, msg: string) {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }

  async function handleCheck(kwId: string) {
    setError("");
    setCheckingId(kwId);
    const res = await fetch(`/api/proyectos/${projectId}/rank/keywords/${kwId}/check`, {
      method: "POST",
    });
    const data = await res.json();
    setCheckingId(null);
    if (!res.ok) {
      setError(data.error ?? "Error al comprobar la posición");
      return;
    }
    await loadKeywords();

    // loadKeywords() ya refresca competitorPositions (viene en el mismo GET);
    // solo el histórico de posiciones necesita su propio fetch.
    if (selectedId === kwId) {
      await loadHistory(kwId);
    }

    // El guard "un chequeo por día natural" puede devolver la posición ya
    // fijada hoy sin llamar a la API (fromCache). Se avisa en verde para que
    // no parezca que la posición "no cambió" por azar — es política, no ruido.
    if (data.fromCache && data.checkedAt) {
      const hora = new Date(data.checkedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      setErrorFor("check", `Ya comprobada hoy a las ${hora}. Posición fijada hasta mañana.`);
    }
  }

  // "Comprobar todas": recorre secuencialmente las keywords visibles (respeta
  // el filtro/búsqueda actual, igual que Exportar CSV) reutilizando la misma
  // ruta que "Comprobar ahora" por fila — sin lógica de servidor nueva, sin
  // paralelizar (mismo principio que el cron: una llamada SERP detrás de
  // otra). El spinner por fila (checkingId) se reutiliza para que se vea cuál
  // se está comprobando en cada momento. Si una falla por tope de gasto
  // (422), se corta el resto del lote en vez de seguir fallando keyword a
  // keyword.
  async function handleCheckAll() {
    const targets = filteredKeywords;
    if (targets.length === 0 || checkingAll) return;
    setError("");
    setCheckingAll(true);
    setCheckAllProgress({ done: 0, total: targets.length });

    let ok = 0;
    let cached = 0;
    let failed = 0;
    let stoppedForSpend = false;

    for (const kw of targets) {
      setCheckingId(kw.id);
      try {
        const res = await fetch(`/api/proyectos/${projectId}/rank/keywords/${kw.id}/check`, {
          method: "POST",
        });
        if (res.ok) {
          ok++;
          // El guard "un chequeo por día" puede servir la posición fijada hoy
          // sin llamar a la API — se contabiliza aparte para que el resumen
          // refleje cuántas se actualizaron de verdad.
          const data = await res.json().catch(() => ({}));
          if (data.fromCache) cached++;
        } else {
          failed++;
          if (res.status === 422) {
            stoppedForSpend = true;
            break; // tope de gasto alcanzado — seguir sería repetir el mismo fallo N veces
          }
        }
      } catch {
        failed++;
      }
      setCheckAllProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    setCheckingId(null);
    setCheckingAll(false);
    setCheckAllProgress(null);
    await loadKeywords();

    const updated = ok - cached;
    const parts = [`${updated} actualizadas`];
    if (cached > 0) parts.push(`${cached} ya fijadas hoy`);
    if (stoppedForSpend) parts.push("detenido por tope de gasto alcanzado");
    else if (failed > 0) parts.push(`${failed} con error`);
    setErrorFor("checkall", parts.join(" · "));
  }

  async function handleFrequency(kwId: string, frequency: string) {
    await fetch(`/api/proyectos/${projectId}/rank/keywords/${kwId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency }),
    });
    loadKeywords();
  }

  async function handleDepth(kwId: string, depth: number) {
    await fetch(`/api/proyectos/${projectId}/rank/keywords/${kwId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depth }),
    });
    loadKeywords();
  }

  async function handleLocation(kwId: string, loc: LocationValue) {
    const res = await fetch(`/api/proyectos/${projectId}/rank/keywords/${kwId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // ?? null (no solo loc?.code): si loc es null, JSON.stringify elimina
      // claves con valor undefined y la petición llegaría vacía — el backend
      // necesita ver la clave presente (aunque sea null) para volver a nacional.
      body: JSON.stringify({ locationCode: loc?.code ?? null, locationName: loc?.name ?? null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorFor("location", data.error ?? "Error al cambiar la ubicación");
      return;
    }
    loadKeywords();
  }

  async function handleDelete(kwId: string) {
    if (selectedId === kwId) {
      setSelectedId(null);
      setHistory([]);
    }
    await fetch(`/api/proyectos/${projectId}/rank/keywords/${kwId}`, { method: "DELETE" });
    loadKeywords();
  }

  // Estimaciones de coste (estilo WebCEO): lo que cuesta/mes lo ya seguido y
  // lo que sumará la nueva keyword o el lote importado, según depth+frecuencia
  // actuales del formulario. Se recalcula en vivo al mover los selectores.
  const projectMonthlyCost = keywords.reduce(
    (sum, kw) => sum + rankMonthlyCostUsd(1, kw.depth, kw.frequency),
    0
  );
  // Cuenta las líneas no vacías del textarea (bulk-aware). Una sola línea
  // también funciona: el coste mostrado es el de esa keyword.
  const newKeywordCount = newKeyword.split("\n").filter((l) => l.trim()).length;
  const newKeywordMonthlyCost = rankMonthlyCostUsd(newKeywordCount, Number(newDepth), newFrequency);
  const importStudy = studies.find((s) => s.id === importStudyId);
  const importBatchMonthly = importStudy
    ? rankMonthlyCostUsd(importStudy._count.keywords, Number(newDepth), newFrequency)
    : 0;

  // Columnas de fecha de la tabla tipo calendario: unión de los días con
  // algún chequeo real entre todas las keywords visibles, más recientes
  // primero, acotada para que la tabla no crezca sin límite. Nunca se
  // interpola una fecha sin chequeo — esa columna simplemente muestra "n/s"
  // para esa keyword.
  const dateColumns = useMemo(() => {
    const days = new Map<string, Date>();
    for (const kw of keywords) {
      for (const p of kw.positions) {
        const key = dayKey(p.checkedAt);
        if (!days.has(key)) days.set(key, new Date(p.checkedAt));
      }
    }
    return [...days.values()]
      .sort((a, b) => b.getTime() - a.getTime())
      .slice(0, MAX_DATE_COLUMNS)
      .reverse();
  }, [keywords]);

  function cellFor(kw: RankKeyword, date: Date) {
    const key = date.toDateString();
    // Si hay varios chequeos el mismo día, nos quedamos con el último
    // (positions ya viene ordenado desc por checkedAt).
    const match = kw.positions.find((p) => dayKey(p.checkedAt) === key);
    return positionCell(match?.position, Boolean(match));
  }

  // Variación (R5): compara el primer y el último chequeo con posición real
  // dentro de la ventana de columnas visible (dateColumns, ya ordenada
  // cronológicamente). Positivo = ha mejorado (el número de posición bajó).
  // Null si no hay al menos dos chequeos con posición real en la ventana.
  function deltaFor(kw: RankKeyword): number | null {
    const withPos = dateColumns
      .map((d) => kw.positions.find((p) => dayKey(p.checkedAt) === d.toDateString()))
      .filter((p): p is RankPosition => Boolean(p) && p!.position !== null);
    if (withPos.length < 2) return null;
    const first = withPos[0].position as number;
    const last = withPos[withPos.length - 1].position as number;
    return first - last;
  }

  // Grupos existentes entre las keywords ya seguidas, para el desplegable de
  // filtro — no hay tabla de grupos aparte, es texto libre por keyword.
  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const kw of keywords) if (kw.group) set.add(kw.group);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [keywords]);

  const filteredKeywords = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = keywords;
    if (groupFilter === "__none__") list = list.filter((kw) => !kw.group);
    else if (groupFilter !== "__all__") list = list.filter((kw) => kw.group === groupFilter);
    if (q) list = list.filter((kw) => kw.keyword.toLowerCase().includes(q));

    const dir = sortDir === "asc" ? 1 : -1;
    const withRank = (v: number | null) => (v === null ? Infinity : v); // sin posición = siempre al final
    // Ordenación por una columna de fecha concreta: extrae la posición que tenía
    // la keyword ese día (o Infinity si no se chequeó).
    const posForDate = (kw: RankKeyword, iso: string) => {
      const date = new Date(iso);
      const match = kw.positions.find((p) => dayKey(p.checkedAt) === date.toDateString());
      return match?.position ?? null;
    };
    return [...list].sort((a, b) => {
      if (typeof sortKey === "string" && sortKey.startsWith("date:")) {
        const iso = sortKey.slice(5);
        return dir * (withRank(posForDate(a, iso)) - withRank(posForDate(b, iso)));
      }
      switch (sortKey) {
        case "keyword":
          return dir * a.keyword.localeCompare(b.keyword);
        case "volume":
          return dir * ((a.searchVolume ?? -1) - (b.searchVolume ?? -1));
        case "best":
          return dir * (withRank(a.bestPosition) - withRank(b.bestPosition));
        case "delta": {
          const da = deltaFor(a);
          const db = deltaFor(b);
          return dir * ((da === null ? -999 : da) - (db === null ? -999 : db));
        }
        case "position":
        default:
          return dir * (withRank(a.lastPosition) - withRank(b.lastPosition));
      }
    });
    // deltaFor es una función del componente que cierra sobre dateColumns
    // (también un useMemo derivado de keywords, ya en deps). No se lista para
    // evitar recrear el sort en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords, search, groupFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // keyword alfabético asc; columnas de fecha asc (mejor posición primero);
      // resto desc.
      const isDate = typeof key === "string" && key.startsWith("date:");
      setSortDir(key === "keyword" || isDate ? "asc" : "desc");
    }
  }

  // Distribución de posiciones (R4) — resumen a golpe de vista, calculado en
  // el cliente con datos ya cargados, sin ninguna llamada nueva.
  const distribution = useMemo(() => {
    const buckets = { top3: 0, top10: 0, top20: 0, top50: 0, worse: 0, none: 0 };
    for (const kw of filteredKeywords) {
      const p = kw.lastPosition;
      if (p === null) buckets.none++;
      else if (p <= 3) buckets.top3++;
      else if (p <= 10) buckets.top10++;
      else if (p <= 20) buckets.top20++;
      else if (p <= 50) buckets.top50++;
      else buckets.worse++;
    }
    return buckets;
  }, [filteredKeywords]);

  // Exportar a CSV (R6) — respeta el filtro/orden actual, sin backend: todo
  // el dato ya está cargado en el cliente.
  function exportCsv() {
    downloadCsv(
      `rank-tracking-${projectId}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Keyword", "Grupo", "Volumen", "Posición actual", "Mejor posición", "Dispositivo", "Frecuencia", "Última comprobación"],
      filteredKeywords.map((kw) => [
        kw.keyword,
        kw.group ?? "",
        kw.searchVolume ?? "",
        kw.lastPosition ?? "",
        kw.bestPosition ?? "",
        kw.device === "mobile" ? "Móvil" : "Desktop",
        RANK_FREQUENCY_LABELS[kw.frequency] ?? kw.frequency,
        kw.lastCheckedAt ? new Date(kw.lastCheckedAt).toLocaleDateString("es-ES") : "",
      ])
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Módulo · Rank tracking"
        title="Rank Tracking"
        description="Seguimiento de tus posiciones orgánicas en Google, keyword a keyword y día a día."
        actions={
          <button
            type="button"
            onClick={() => {
              setAddTab("escribir");
              setAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            <Plus className="h-4 w-4" /> Añadir keywords
          </button>
        }
      />

      {/* Tabla tipo calendario */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Keywords en seguimiento
            </h3>
            {keywords.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand tabular-nums">
                {filteredKeywords.length}/{keywords.length}
              </span>
            )}
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] bg-brand-100" />Top 3</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] bg-accent-tint border border-brand-100" />Top 10</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] bg-accent-tint border border-brand-100" />11-20</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] bg-surface-muted border border-line" />21-50</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] bg-alert-tint border border-alert-tint" />&gt;50 / fuera</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] bg-background border border-line" />sin chequeo</span>
            </div>
          )}
        </div>

        {keywords.length > 0 && (
          <>
            {/* Distribución de posiciones (R4) — bento: total con barra
                apilada por tramo + los dos tramos que importan como stat. */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2 bg-brand text-white rounded-2xl p-5 shadow-[0_10px_30px_-10px_rgba(79,92,245,0.55)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-white/60">Keywords en seguimiento</p>
                  <span className="text-xs text-white/40 tabular-nums">
                    {filteredKeywords.length}/{keywords.length} visibles
                  </span>
                </div>
                <p className="text-4xl font-bold tracking-tight tabular-nums mt-2 leading-none">
                  {keywords.length}
                </p>
                {/* Barra apilada: proporción de keywords por tramo de posición */}
                <div className="mt-5 h-2.5 rounded-full bg-white/15 overflow-hidden flex" aria-hidden="true">
                  {([
                    [distribution.top3, "bg-white"],
                    [distribution.top10, "bg-signal"],
                    [distribution.top20, "bg-brand-300"],
                    [distribution.top50, "bg-white/30"],
                    [distribution.worse, "bg-alert"],
                    [distribution.none, "bg-white/15"],
                  ] as const).map(([v, c], i) => (
                    <div
                      key={i}
                      className={c}
                      style={{ width: `${(v / Math.max(1, keywords.length)) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/60">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white" />Top 3 · {distribution.top3}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-signal" />Top 10 · {distribution.top10}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-300" />11-20 · {distribution.top20}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/30" />21-50 · {distribution.top50}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-alert" />&gt;50 · {distribution.worse}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/15" />sin posicionar · {distribution.none}</span>
                </div>
              </div>
              {(() => {
                const inTop10 = distribution.top3 + distribution.top10;
                const share = (inTop10 / Math.max(1, keywords.length)) * 100;
                let up = 0;
                let down = 0;
                for (const kw of keywords) {
                  const d = deltaFor(kw);
                  if (d !== null && d > 0) up++;
                  else if (d !== null && d < 0) down++;
                }
                return (
                  <>
                    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-line bg-surface p-5 shadow-card">
                      <div>
                        <p className="text-[13px] font-semibold text-ink-soft">En top 10</p>
                        <p className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">{inTop10}</p>
                        <p className="mt-2 text-xs text-ink-faint">de {keywords.length} keywords</p>
                      </div>
                      <RadialGauge value={share} size={76} />
                    </div>
                    <div className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
                      <p className="text-[13px] font-semibold text-ink-soft">Movimiento reciente</p>
                      <div className="mt-2 flex items-end gap-5">
                        <div>
                          <p className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-accent-ink">▲ {up}</p>
                          <p className="mt-2 text-xs text-ink-faint">suben</p>
                        </div>
                        <div>
                          <p className={`text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${down > 0 ? "text-alert-ink" : "text-ink-faint"}`}>▼ {down}</p>
                          <p className="mt-2 text-xs text-ink-faint">bajan</p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Barra de herramientas: búsqueda, filtro por grupo y acciones,
                todo dentro de una tarjeta cohesiva (antes flotaba suelto). */}
            <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-2.5 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar keyword…"
                  className="w-full border border-line rounded-full pl-10 pr-4 py-2 text-sm bg-background outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-surface transition-colors"
                />
              </div>
              {groups.length > 0 && (
                <Select.Root value={groupFilter} onValueChange={setGroupFilter}>
                  <Select.Trigger className="flex items-center justify-between gap-1.5 min-w-[150px] border border-line rounded-full px-4 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                    <Select.Value />
                    <Select.Icon><ChevronDown className="h-3.5 w-3.5 text-ink-faint" /></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                      <Select.Viewport>
                        <Select.Item value="__all__" className="px-3 py-1.5 text-xs text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Todos los grupos</Select.ItemText></Select.Item>
                        <Select.Item value="__none__" className="px-3 py-1.5 text-xs text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Sin grupo</Select.ItemText></Select.Item>
                        {groups.map((g) => (
                          <Select.Item key={g} value={g} className="px-3 py-1.5 text-xs text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>{g}</Select.ItemText></Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleCheckAll}
                  disabled={checkingAll}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-full hover:bg-brand-strong transition-colors disabled:opacity-50 shrink-0"
                  title="Comprobar ahora la posición de todas las keywords visibles (respeta el filtro/búsqueda actual)"
                >
                  {checkingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {checkingAll && checkAllProgress
                    ? `Comprobando ${checkAllProgress.done}/${checkAllProgress.total}…`
                    : "Comprobar todas"}
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-line bg-surface text-ink-soft text-sm font-medium rounded-full hover:bg-background transition-colors shrink-0"
                  title="Exportar la tabla visible a CSV"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            </div>
          </>
        )}

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
          </div>
        ) : keywords.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] py-12 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink-faint">
              <Search className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink-soft">Aún no sigues ninguna keyword para este proyecto.</p>
            <button
              type="button"
              onClick={() => {
                setAddTab("escribir");
                setAddOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              <Plus className="h-4 w-4" /> Añadir keywords
            </button>
          </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] py-12 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink-faint">
              <Search className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink-soft">Ninguna keyword coincide con el filtro actual.</p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-faint bg-surface-muted">
                  <SortableTh label="Keyword" sortKey="keyword" active={sortKey} dir={sortDir} onClick={toggleSort} className="pl-4 pr-3 sticky left-0 bg-surface-muted rounded-tl-lg" />
                  <SortableTh label="Volumen" sortKey="volume" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="px-3" />
                  {dateColumns.map((d) => (
                    <SortableTh
                      key={d.toISOString()}
                      label={d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                      sortKey={`date:${d.toISOString()}`}
                      active={sortKey}
                      dir={sortDir}
                      onClick={toggleSort}
                      align="right"
                      className="px-2"
                    />
                  ))}
                  <SortableTh label="Actual" sortKey="position" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="px-3" />
                  <SortableTh label="Δ" sortKey="delta" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="px-3" />
                  <SortableTh label="Mejor" sortKey="best" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="px-3" />
                  <th className="py-2.5 pr-4 pl-3 font-medium text-right whitespace-nowrap rounded-tr-lg">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeywords.map((kw) => (
                  <Fragment key={kw.id}>
                    <tr
                      onClick={() => selectKeyword(kw.id)}
                      className={cn(
                        "group border-b border-line/60 last:border-0 cursor-pointer transition-colors hover:bg-black/[0.025]",
                        selectedId === kw.id && "bg-brand/5 hover:bg-brand/[0.07]"
                      )}
                    >
                      <td
                        className={cn(
                          "py-2.5 pl-4 pr-3 sticky left-0 bg-surface group-hover:bg-black/[0.025]",
                          selectedId === kw.id && "bg-brand/5 group-hover:bg-brand/[0.07]",
                          // Cada <td sticky> abre su propio contexto de apilamiento — sin esto,
                          // el desplegable (z-50) de LocationPicker queda tapado por la fila
                          // siguiente, que gana por orden en el DOM al no haber z-index explícito.
                          editingLoc === kw.id && "z-20"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-left min-w-0">
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-ink-faint shrink-0 transition-transform",
                              selectedId === kw.id && "rotate-180 text-ink-soft"
                            )}
                          />
                          <TrendIcon kw={kw} />
                          <span className="text-ink truncate max-w-[220px]" title={kw.keyword}>
                            {kw.keyword}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-faint pl-5 flex items-center gap-1 flex-wrap">
                          <span className="whitespace-nowrap">
                            {kw.device === "mobile" ? "Móvil" : "Desktop"} · Top-{kw.depth}
                          </span>
                          {editingLoc === kw.id ? (
                            <span
                              className="inline-flex items-center gap-1 min-w-[180px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="flex-1">
                                <LocationPicker
                                  value={kw.locationName ? { code: kw.locationCode, name: kw.locationName } : null}
                                  onChange={(loc) => {
                                    handleLocation(kw.id, loc);
                                    // Si loc es null es que el usuario borró la ubicación con la
                                    // "X" — deja el editor abierto para que pueda escribir la
                                    // nueva sin tener que volver a abrirlo. Al elegir una sí cierra.
                                    if (loc) setEditingLoc(null);
                                  }}
                                  placeholder="Ubicación…"
                                />
                              </span>
                              <button
                                onClick={() => setEditingLoc(null)}
                                className="text-ink-faint hover:text-ink"
                                title="Cerrar"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLoc(kw.id);
                              }}
                              className="inline-flex items-center gap-0.5 text-[11px] text-ink-soft hover:text-ink underline decoration-dotted truncate max-w-[160px]"
                              title="Cambiar la ubicación de esta keyword"
                            >
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{kw.locationName ?? "Nacional"}</span>
                              <Pencil className="h-2.5 w-2.5 text-ink-faint" />
                            </button>
                          )}
                        </div>
                        {(kw.competitorPositions.length > 0 || kw.tfidfAvailable || latestFeatures(kw).length > 0) && (
                          <div className="pl-5 flex flex-wrap items-center gap-1.5 mt-0.5">
                            {latestFeatures(kw).map((f) => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium" title={serpFeatureLabel(f)}>
                                {f === "ai_overview" ? "IA" : f === "local_pack" ? "Mapa" : "Snippet"}
                              </span>
                            ))}
                            {kw.competitorPositions.length > 0 && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/[0.05] text-ink-soft"
                                title="Competidores trackeados en este mismo SERP (gratis, expande la fila para verlos)"
                              >
                                {kw.competitorPositions.length} competidor{kw.competitorPositions.length === 1 ? "" : "es"}
                              </span>
                            )}
                            {kw.tfidfAvailable && (
                              <Link
                                href={`/app/proyectos/${projectId}/contenido/tfidf?keyword=${encodeURIComponent(kw.keyword)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-tint text-accent-ink hover:bg-brand-100 font-medium"
                              >
                                TF-IDF →
                              </Link>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-soft tabular-nums whitespace-nowrap">
                        {kw.searchVolume === null ? <span className="text-ink-faint">—</span> : kw.searchVolume.toLocaleString("es-ES")}
                        {kw.group && (
                          <div className="mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand whitespace-nowrap">{kw.group}</span>
                          </div>
                        )}
                      </td>
                      {dateColumns.map((d) => {
                        const cell = cellFor(kw, d);
                        return (
                          <td key={d.toISOString()} className="p-1 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md text-xs font-medium tabular-nums",
                                cell.bg,
                                cell.text
                              )}
                            >
                              {cell.label}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right text-ink font-medium tabular-nums whitespace-nowrap">
                        {kw.lastPosition === null ? <span className="text-ink-faint font-normal">—</span> : `#${kw.lastPosition}`}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                        {(() => {
                          const d = deltaFor(kw);
                          if (d === null) return <span className="text-ink-faint">—</span>;
                          if (d === 0) return <span className="text-ink-faint">±0</span>;
                          return (
                            <span className={d > 0 ? "text-accent-ink" : "text-alert-ink"}>
                              {d > 0 ? "+" : ""}
                              {d}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-soft tabular-nums whitespace-nowrap">
                        {kw.bestPosition === null ? "—" : `#${kw.bestPosition}`}
                      </td>
                      <td className="py-2.5 pr-4 pl-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCheck(kw.id)}
                            disabled={checkingId === kw.id}
                            className="p-1.5 rounded-lg text-ink-faint hover:text-ink transition-colors disabled:opacity-50"
                            title="Comprobar ahora"
                          >
                            {checkingId === kw.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(kw.id)}
                            className="p-1.5 rounded-lg text-ink-faint hover:text-alert-ink transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {selectedId === kw.id && (
                      <tr className="border-b border-line/60 last:border-0 bg-black/[0.015]">
                        <td colSpan={dateColumns.length + 6} className="p-4">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-ink-soft">Grupo:</label>
                                <input
                                  type="text"
                                  defaultValue={kw.group ?? ""}
                                  onBlur={(e) => {
                                    if (e.target.value !== (kw.group ?? "")) handleGroup(kw.id, e.target.value);
                                  }}
                                  placeholder="Sin grupo"
                                  maxLength={60}
                                  className="border border-line rounded-xl px-2 py-1 text-xs bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors w-32"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-ink-soft">Frecuencia:</label>
                                <Select.Root value={kw.frequency} onValueChange={(v) => handleFrequency(kw.id, v)}>
                                  <Select.Trigger className="flex items-center justify-between gap-1 border border-line rounded-xl px-2 py-1 text-xs bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                                    <Select.Value />
                                    <ChevronDown className="h-3 w-3 text-ink-faint" />
                                  </Select.Trigger>
                                  <Select.Portal>
                                    <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                                      <Select.Viewport>
                                        {Object.entries(RANK_FREQUENCY_LABELS).map(([v, l]) => (
                                          <Select.Item key={v} value={v} className="px-3 py-1.5 text-xs text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>{l}</Select.ItemText></Select.Item>
                                        ))}
                                      </Select.Viewport>
                                    </Select.Content>
                                  </Select.Portal>
                                </Select.Root>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-ink-soft">Profundidad:</label>
                                <Select.Root value={String(kw.depth)} onValueChange={(v) => handleDepth(kw.id, Number(v))}>
                                  <Select.Trigger className="flex items-center justify-between gap-1 border border-line rounded-xl px-2 py-1 text-xs bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                                    <Select.Value />
                                    <ChevronDown className="h-3 w-3 text-ink-faint" />
                                  </Select.Trigger>
                                  <Select.Portal>
                                    <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                                      <Select.Viewport>
                                        {DEPTHS.map((d) => (
                                          <Select.Item key={d} value={String(d)} className="px-3 py-1.5 text-xs text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Top-{d}</Select.ItemText></Select.Item>
                                        ))}
                                      </Select.Viewport>
                                    </Select.Content>
                                  </Select.Portal>
                                </Select.Root>
                              </div>
                              <div className="flex items-center gap-2 min-w-[220px]">
                                <label className="text-xs text-ink-soft shrink-0">Ubicación:</label>
                                <div className="flex-1">
                                  <LocationPicker
                                    value={kw.locationName ? { code: kw.locationCode, name: kw.locationName } : null}
                                    onChange={(loc) => handleLocation(kw.id, loc)}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs">
                                <Calendar className="h-3.5 w-3.5 text-ink-faint" />
                                <span className="text-ink-soft">Próximo escaneo:</span>
                                <span className="text-ink-soft font-medium">
                                  {kw.nextScanAt
                                    ? new Date(kw.nextScanAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                                    : "Manual — sin auto-escaneo"}
                                </span>
                              </div>
                            </div>

                            {loadingHistory ? (
                              <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
                            ) : history.length === 0 ? (
                              <p className="text-xs text-ink-faint">Sin mediciones todavía. Pulsa &laquo;Comprobar ahora&raquo;.</p>
                            ) : (
                              <div className="space-y-2">
                                <PositionSparkline positions={history} />
                                {history[history.length - 1]?.url && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-ink-soft shrink-0">URL que posiciona ahora:</span>
                                    <UrlLink url={history[history.length - 1]!.url!} className="text-xs" />
                                  </div>
                                )}
                                {/* Panorama del SERP del último chequeo (y novedades frente al anterior) */}
                                <SerpPanoramaCard
                                  serp={history[history.length - 1]?.serp}
                                  previous={history.length > 1 ? history[history.length - 2]?.serp : null}
                                />
                                {/* Copy actual: cómo muestra Google tu resultado en el
                                    último chequeo. Dato gratis del SERP ya pagado. */}
                                {(() => {
                                  const last = history[history.length - 1];
                                  if (!last || (!last.title && !last.description)) return null;
                                  return (
                                    <div className="bg-background border border-line rounded-xl p-2 space-y-0.5">
                                      {last.title && <p className="text-xs font-medium text-ink line-clamp-1">{last.title}</p>}
                                      {last.description && <p className="text-xs text-ink-soft line-clamp-2">{last.description}</p>}
                                    </div>
                                  );
                                })()}
                                <div className="max-h-48 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {history.slice().reverse().map((p) => {
                                        const hasCopy = Boolean(p.title || p.description);
                                        const open = copyExpanded === p.id;
                                        return (
                                          <Fragment key={p.id}>
                                            <tr
                                              className={cn("border-b border-line/60", hasCopy && "cursor-pointer hover:bg-background")}
                                              onClick={() => hasCopy && setCopyExpanded(open ? null : p.id)}
                                            >
                                              <td className="py-1 text-ink-soft whitespace-nowrap">{new Date(p.checkedAt).toLocaleString("es-ES")}</td>
                                              <td className="py-1 text-right text-ink tabular-nums whitespace-nowrap">
                                                {p.position === null ? <span className="text-ink-faint">fuera top-{kw.depth}</span> : `#${p.position}`}
                                              </td>
                                              <td className="py-1 pl-2 min-w-0">
                                                {p.url ? (
                                                  <UrlLink url={p.url} className="text-xs" showIcon={false} />
                                                ) : (
                                                  <span className="text-ink-faint">—</span>
                                                )}
                                              </td>
                                              <td className="py-1 pl-1 text-right w-6">
                                                {hasCopy && (
                                                  <span className="text-ink-faint">
                                                    {open ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />}
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                            {open && hasCopy && (
                                              <tr className="bg-background">
                                                <td colSpan={4} className="px-2 py-1.5 space-y-0.5">
                                                  {p.title && <p className="text-xs font-medium text-ink">{p.title}</p>}
                                                  {p.description && <p className="text-xs text-ink-soft leading-relaxed">{p.description}</p>}
                                                </td>
                                              </tr>
                                            )}
                                          </Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Competidores en el mismo SERP (R1) — coste marginal cero: la
                                posición ya venía en la respuesta pagada para la keyword propia. */}
                            <div className="pt-2 border-t border-line">
                              <p className="text-xs font-medium text-ink-soft mb-1.5">Competidores en este SERP</p>
                              {kw.competitorPositions.length === 0 ? (
                                <p className="text-xs text-ink-faint">
                                  Sin competidores trackeados todavía (o el último chequeo fue anterior a esta
                                  función) — añádelos en la pestaña Competidores.
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <tbody>
                                    {kw.competitorPositions.map((c) => {
                                      const hasCopy = Boolean(c.title || c.description);
                                      const key = `comp:${c.domain}`;
                                      const open = copyExpanded === key;
                                      return (
                                        <Fragment key={c.domain}>
                                          <tr
                                            className={cn("border-b border-line/60", hasCopy && "cursor-pointer hover:bg-background")}
                                            onClick={() => hasCopy && setCopyExpanded(open ? null : key)}
                                          >
                                            <td className="py-1 text-ink-soft">
                                              {c.domain}
                                              {hasCopy && (
                                                <span className="ml-1 text-ink-faint align-middle">
                                                  {open ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />}
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-1 text-ink-faint">
                                              {new Date(c.checkedAt).toLocaleDateString("es-ES")}
                                            </td>
                                            <td className="py-1 text-right text-ink tabular-nums">
                                              {c.position === null ? (
                                                <span className="text-ink-faint">fuera top-{kw.depth}</span>
                                              ) : (
                                                `#${c.position}`
                                              )}
                                            </td>
                                            <td className="py-1 pl-2 text-right whitespace-nowrap">
                                              {c.position !== null && kw.lastPosition !== null ? (
                                                <span className={kw.lastPosition < c.position ? "text-accent-ink" : "text-alert-ink"}>
                                                  {kw.lastPosition < c.position ? "vas delante" : "vas detrás"}
                                                </span>
                                              ) : (
                                                "—"
                                              )}
                                            </td>
                                          </tr>
                                          {open && hasCopy && (
                                            <tr className="bg-background">
                                              <td colSpan={4} className="px-2 py-1.5 space-y-0.5">
                                                {c.title && <p className="text-xs font-medium text-ink">{c.title}</p>}
                                                {c.description && <p className="text-xs text-ink-soft leading-relaxed">{c.description}</p>}
                                                {c.url && (
                                                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline">
                                                    <span className="truncate max-w-sm">{c.url}</span>
                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                  </a>
                                                )}
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {keywords.length > 0 && (
        <div className="space-y-2">
          {groups.length > 0 && (
            <div className="flex justify-end">
              <Select.Root value={visibilityGroup} onValueChange={setVisibilityGroup}>
                <Select.Trigger className="flex items-center justify-between gap-1.5 min-w-[160px] border border-line rounded-xl px-3 py-1.5 text-xs bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="h-3.5 w-3.5 text-ink-faint" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                    <Select.Viewport>
                      <Select.Item value="__all__" className="px-3 py-1.5 text-xs text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Visibilidad: todo el proyecto</Select.ItemText></Select.Item>
                      {groups.map((g) => (
                        <Select.Item key={g} value={g} className="px-3 py-1.5 text-xs text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Visibilidad: {g}</Select.ItemText></Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          )}
          <RankVisibilityChart projectId={projectId} group={visibilityGroup === "__all__" ? undefined : visibilityGroup} />
          <ShareOfVoiceCard projectId={projectId} group={visibilityGroup === "__all__" ? undefined : visibilityGroup} />
        </div>
      )}
      {/* Añadir keywords: escribirlas, traerlas de un estudio o programar el
          escaneo, todo en un mismo sitio que se abre desde arriba. */}
      <Modal open={addOpen} title="Añadir keywords al seguimiento" onClose={() => setAddOpen(false)} wide>
        <div className="space-y-5">
          <div className="inline-flex items-center gap-1 rounded-full bg-surface-muted p-1">
            {([
              ["escribir", "Escribir keywords"],
              ["estudio", "Desde un estudio"],
              ["programar", "Escaneo programado"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAddTab(k)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  addTab === k ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]" : "text-ink-soft hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {addTab === "escribir" && (
            <>
      {/* Añadir keyword */}
      <form onSubmit={handleAdd} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-ink-soft">Keywords a seguir (una por línea)</label>
            <textarea
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder={"abogado de familia madrid\nabogado laboralista madrid\nabogado penalista madrid"}
              rows={3}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors resize-y"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft">
                Ubicación <span className="text-ink-faint font-normal">(opcional)</span>
              </label>
              <LocationPicker
                value={newLocation}
                onChange={setNewLocation}
                placeholder="España (nacional)"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft">Dispositivo</label>
              <Select.Root value={newDevice} onValueChange={setNewDevice}>
                <Select.Trigger className="w-full flex items-center justify-between border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                    <Select.Viewport>
                      <Select.Item value="desktop" className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Desktop</Select.ItemText></Select.Item>
                      <Select.Item value="mobile" className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Móvil</Select.ItemText></Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft">Frecuencia</label>
              <Select.Root value={newFrequency} onValueChange={setNewFrequency}>
                <Select.Trigger className="w-full flex items-center justify-between border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                    <Select.Viewport>
                      {Object.entries(RANK_FREQUENCY_LABELS).map(([v, l]) => (
                        <Select.Item key={v} value={v} className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>{l}</Select.ItemText></Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft" title="Resultados a rastrear. A mayor depth, más caro.">Profundidad</label>
              <Select.Root value={newDepth} onValueChange={setNewDepth}>
                <Select.Trigger className="w-full flex items-center justify-between border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                    <Select.Viewport>
                      {DEPTHS.map((d) => (
                        <Select.Item key={d} value={String(d)} className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>Top-{d}</Select.ItemText></Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
        </div>
        <p className="text-xs text-ink-faint">
          La ubicación simula la búsqueda desde ese punto (ej. &laquo;Gijón&raquo;) en vez de
          España entera — más fiable para negocios locales. Sin elegir nada, España (nacional).
        </p>

        {error && <p className="text-sm text-accent-ink bg-accent-tint px-3 py-2 rounded-xl">{error}</p>}
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Añadir a seguimiento
        </button>
        <p className="text-xs text-ink-faint">
          {newKeywordCount > 0
            ? <>Estas {newKeywordCount} keyword(s) costarán <strong className="text-ink-soft">{fmtCredits(newKeywordMonthlyCost)}/mes</strong> (Top-{newDepth}, {RANK_FREQUENCY_LABELS[newFrequency].toLowerCase()}).</>
            : <>Coste por keyword: <strong className="text-ink-soft">{fmtCredits(rankMonthlyCostUsd(1, Number(newDepth), newFrequency))}/mes</strong> (Top-{newDepth}, {RANK_FREQUENCY_LABELS[newFrequency].toLowerCase()}).</>}
          {" "}Total del proyecto al añadirlas: {fmtCredits((projectMonthlyCost + newKeywordMonthlyCost))}/mes.
        </p>
      </form>

            </>
          )}
          {addTab === "estudio" && (
            studies.length > 0 ? (
              <>
      {/* Importar desde estudio */}
      {studies.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Importar desde un estudio</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="block text-xs font-medium text-ink-soft">Estudio (Módulo 1)</label>
              <Select.Root value={importStudyId} onValueChange={setImportStudyId}>
                <Select.Trigger className="w-full flex items-center justify-between border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
                  <Select.Value placeholder="Selecciona un estudio" />
                  <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50 max-h-60">
                    <Select.Viewport>
                      {studies.map((s) => (
                        <Select.Item key={s.id} value={s.id} className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-background">
                          <Select.ItemText>{s.name} ({s._count.keywords})</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center gap-2 border border-line bg-surface text-ink-soft text-sm rounded-xl px-3 py-2 hover:bg-background transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
              Importar
            </button>
          </div>
          {importStudy && (
            <p className="text-xs text-ink-faint">
              Importar {importStudy._count.keywords} keywords costará{" "}
              <strong className="text-ink-soft">{fmtCredits(importBatchMonthly)}/mes</strong> (Top-{newDepth}, {RANK_FREQUENCY_LABELS[newFrequency].toLowerCase()}).
            </p>
          )}
        </div>
      )}
              </>
            ) : (
              <p className="text-sm text-ink-soft">Aún no tienes estudios de keywords en este proyecto. Créalos en Investigación → Keywords.</p>
            )
          )}
          {addTab === "programar" && (
            <>
      {/* Escaneo programado del proyecto — antes vivía escondido dentro del
          formulario de alta; tarjeta propia para que sea fácil de encontrar
          y quede claro que es la palanca que sincroniza al mismo día TODAS
          las keywords con frecuencia automática del proyecto (ver
          src/lib/rank/job.ts). */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-ink-faint" />
          <h3 className="text-sm font-semibold text-ink">Escaneo programado del proyecto</h3>
        </div>
        <p className="text-xs text-ink-faint">
          Fija una fecha para que TODAS las keywords con frecuencia automática (no manual) del
          proyecto se comprueben el mismo día, y se sigan repitiendo cada cierto tiempo a partir de ahí.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select.Root value={scheduleFrequency} onValueChange={setScheduleFrequency}>
            <Select.Trigger className="flex items-center justify-between gap-2 w-36 border border-line rounded-xl px-3 py-1.5 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors">
              <Select.Value />
              <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50">
                <Select.Viewport>
                  {RANK_SCAN_FREQUENCIES.map((v) => (
                    <Select.Item key={v} value={v} className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-background"><Select.ItemText>{RANK_FREQUENCY_LABELS[v]}</Select.ItemText></Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="border border-line rounded-xl px-3 py-1.5 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
          />
          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={scheduleSaving || !scheduleDate}
            className="border border-line bg-surface text-ink-soft text-sm font-medium rounded-xl px-3 py-1.5 hover:bg-background transition-colors disabled:opacity-50"
          >
            {scheduleSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar programación"}
          </button>
          {savedSchedule && (
            <button
              type="button"
              onClick={handleClearSchedule}
              disabled={scheduleSaving}
              className="text-ink-soft text-sm hover:text-alert-ink disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </div>
        {savedSchedule && (
          <p className="text-xs text-accent-ink">
            Próximo escaneo programado: {new Date(savedSchedule.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            {" "}· cada {RANK_FREQUENCY_LABELS[savedSchedule.frequency].toLowerCase()}
          </p>
        )}
      </div>

            </>
          )}
        </div>
      </Modal>
    </div>
  );
}