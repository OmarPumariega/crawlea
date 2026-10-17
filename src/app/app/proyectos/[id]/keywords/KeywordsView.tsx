"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ChevronDown,
  Search,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowDownToLine,
  Download,
  Upload,
  Pencil,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import Pill, { type PillTone } from "@/components/app/Pill";
import { suggestionsCostUsd } from "@/lib/dataforseo/pricing";
import { downloadCsv } from "@/lib/csv";
import LocationPicker, { type LocationValue } from "@/components/app/LocationPicker";
import { resolveLocationName } from "@/lib/rank/locations";
import { fmtCredits } from "@/lib/credits";
import StatTile from "@/components/ui/StatTile";
import Modal from "@/components/app/Modal";
import { RadialGauge } from "@/components/ui/charts";

type Keyword = {
  id: string;
  keyword: string;
  searchVolume: number | null;
  competition: string | null;
  cpc: number | string | null;
  intent: string | null;
  // Estacionalidad (12 meses, orden cronológico). Llega gratis con el
  // search_volume; antes se tiraba. Mini-sparkline en la tabla para ver de un
  // vistazo si una keyword es estable o estacional.
  monthlySearches?: number[] | null;
  // Dificultad SEO real (0-100) — solo disponible si la keyword llegó vía
  // Sugerencias (DataForSEO Labs) o import de Competidores/Geogrid; "pegar
  // lista" no la resuelve (el endpoint plano de volumen no la incluye).
  difficulty?: number | null;
  priority: number;
  // Cruce gratis con TF-IDF y Rank Tracking (ya calculado/trackeado en otro
  // módulo) — se pinta solo, sin que el usuario tenga que ir a buscarlo.
  tfidfAvailable?: boolean;
  rankPosition?: number | null;
};

type StructurePage = {
  slug: string;
  h1: string;
  headings: string[];
  navLabel: string;
  keywords: string[];
};

type Study = {
  id: string;
  name: string;
  languageCode: string;
  locationCode: number;
  createdAt: string;
  updatedAt: string;
  structure: { pages: StructurePage[] } | null;
  structureModel: string | null;
  notes: string | null;
  keywords: Keyword[];
};

type StudyListItem = {
  id: string;
  name: string;
  languageCode: string;
  locationCode: number;
  createdAt: string;
  hasStructure: boolean;
  notes: string | null;
  _count: { keywords: number };
};

type Suggestion = {
  keyword: string;
  searchVolume: number | null;
  competition: string | null;
  cpc: number | null;
  intent: string | null;
  difficulty: number | null;
  monthlySearches: number[] | null;
};

// Mismo criterio que Competidores: dificultad SEO real (0-100), no el proxy
// de competition/competitionIndex de Google Ads.
function difficultyBadge(score: number | null | undefined): { label: string; tone: PillTone } | null {
  if (score == null) return null;
  if (score >= 67) return { label: `${score} · Alta`, tone: "danger" };
  if (score >= 34) return { label: `${score} · Media`, tone: "warning" };
  return { label: `${score} · Baja`, tone: "success" };
}

const INTENT_TONES: Record<string, PillTone> = {
  informacional: "info",
  mixta: "warning",
  transaccional: "brand",
  navegacional: "neutral",
};
const COMPETITION_STYLES: Record<string, string> = {
  HIGH: "text-alert-ink",
  MEDIUM: "text-accent-ink",
  LOW: "text-accent-ink",
};
const LIMITS = [30, 100, 250, 500];

function fmtCpc(v: number | string | null): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? `${n.toFixed(2)}€` : "—";
}

// Mini-sparkline de estacionalidad (12 meses). Mismo principio que el de rank
// tracking: rápido de leer, sin librería de gráficos. El título del <svg>
// ofrece el detalle (pico mes/dato) al hacer hover. Null/sin datos → "—".
function SeasonalitySparkline({ points }: { points: number[] | null | undefined }) {
  if (!points || points.length < 2) return <span className="text-ink-faint">—</span>;
  const W = 48;
  const H = 18;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * H;
  const pts = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const peakIdx = points.indexOf(max);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  // El último punto corresponde al mes más reciente; reconstruimos hacia atrás.
  const last = points.length - 1;
  const label =
    `Pico: ${max.toLocaleString("es-ES")} (hace ${last - peakIdx} meses) · ` +
    `Actual: ${points[last].toLocaleString("es-ES")} · ` +
    months[((new Date().getMonth() - (last - peakIdx)) % 12 + 12) % 12];
  return (
    <svg width={W} height={H} className="text-ink-faint" role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </svg>
  );
}

// --- Árbol de estructura de URLs (mismo render que antes) ---
type TreeNode = { segment: string; path: string; page?: StructurePage; children: TreeNode[] };
function buildTree(pages: StructurePage[]): TreeNode[] {
  const root: TreeNode = { segment: "", path: "", children: [] };
  for (const page of pages) {
    const segments = page.slug.split("/").filter(Boolean);
    let node = root;
    let acc = "";
    segments.forEach((seg, i) => {
      acc = acc ? `${acc}/${seg}` : seg;
      let child = node.children.find((c) => c.segment === seg);
      if (!child) {
        child = { segment: seg, path: acc, children: [] };
        node.children.push(child);
      }
      if (i === segments.length - 1) child.page = page;
      node = child;
    });
  }
  return root.children;
}
function StructureTree({ nodes, depth }: { nodes: TreeNode[]; depth: number }) {
  return (
    <ul className={cn(depth > 0 && "pl-4 border-l border-line ml-1.5")}>
      {nodes.map((node) => (
        <li key={node.path} className="space-y-1.5">
          <div className="text-xs font-semibold text-ink-faint">{node.segment}</div>
          {node.page && (
            <div className="ml-5 bg-surface border border-line rounded-xl p-3.5 space-y-2 shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)]">
              <p className="text-sm font-medium text-ink">{node.page.h1}</p>
              {node.page.headings.length > 0 && (
                <ul className="text-xs text-ink-soft space-y-0.5 pl-3">
                  {node.page.headings.map((h, i) => (
                    <li key={i} className="border-l border-line pl-2">{h}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-ink-faint">{node.page.navLabel}</span>
                {node.page.keywords.map((k, i) => (
                  <span key={i} className=" text-[10px] px-1.5 py-0.5 rounded-md bg-background text-ink-soft">{k}</span>
                ))}
              </div>
            </div>
          )}
          {node.children.length > 0 && <StructureTree nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function KeywordsView({ projectId }: { projectId: string }) {
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [current, setCurrent] = useState<Study | null>(null);
  // Tabla del estudio: búsqueda y paginación (los estudios importados tienen cientos de filas).
  const [kwSearch, setKwSearch] = useState("");
  const [kwShown, setKwShown] = useState(50);
  const [newOpen, setNewOpen] = useState(false);
  const [loadingStudies, setLoadingStudies] = useState(true);

  // Nuevo estudio
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Subir CSV/documento con keywords ya investigadas (con volumen y,
  // opcionalmente, competencia/CPC/intención) — crea el estudio directamente
  // con esos datos, sin llamar a DataForSEO.
  const [importingFile, setImportingFile] = useState(false);
  const [importFileError, setImportFileError] = useState("");

  // Sugerencias
  const [seed, setSeed] = useState("");
  const [limit, setLimit] = useState(100);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggError, setSuggError] = useState("");

  // Pegar lista
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [resolving, setResolving] = useState(false);

  // Estructura
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [structureError, setStructureError] = useState("");

  // Edición / borrado del estudio (desde la lista)
  const [listEditId, setListEditId] = useState<string | null>(null);
  const [listEditName, setListEditName] = useState("");
  const [listEditNotes, setListEditNotes] = useState("");
  const [listSaving, setListSaving] = useState(false);

  // Edición / borrado del estudio (desde dentro del workspace)
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLocation, setEditLocation] = useState<LocationValue>(null);
  const [savingStudy, setSavingStudy] = useState(false);
  const [deletingStudy, setDeletingStudy] = useState(false);

  function loadStudies() {
    return fetch(`/api/proyectos/${projectId}/keywords/estudios`)
      .then((r) => r.json())
      .then((d: StudyListItem[]) => Array.isArray(d) && setStudies(d));
  }

  function openStudy(studyId: string) {
    fetch(`/api/proyectos/${projectId}/keywords/estudios/${studyId}`)
      .then((r) => r.json())
      .then((d: Study | { error: string }) => {
        if (d && !("error" in d)) setCurrent(d);
      });
  }

  function reloadCurrent() {
    if (current) openStudy(current.id);
    loadStudies();
  }

  function startListEdit(study: StudyListItem) {
    setListEditId(study.id);
    setListEditName(study.name);
    setListEditNotes(study.notes ?? "");
  }

  async function handleListSave() {
    if (!listEditId) return;
    setListSaving(true);
    await fetch(`/api/proyectos/${projectId}/keywords/estudios/${listEditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: listEditName.trim(), notes: listEditNotes.trim() || null }),
    });
    setListSaving(false);
    setListEditId(null);
    loadStudies();
  }

  async function handleListDelete(studyId: string, studyName: string) {
    if (!confirm(`¿Eliminar el estudio "${studyName}" y todas sus keywords?`)) return;
    await fetch(`/api/proyectos/${projectId}/keywords/estudios/${studyId}`, { method: "DELETE" });
    loadStudies();
  }

  function startEdit() {
    if (!current) return;
    setEditName(current.name);
    setEditNotes(current.notes ?? "");
    // Cargamos la ubicación actual del estudio en el picker. Como el estudio
    // solo guarda el locationCode (no el nombre), lo resolvemos desde el
    // mismo JSON estático que usa el LocationPicker.
    setEditLocation(
      current.locationCode && current.locationCode !== 2724
        ? { code: current.locationCode, name: resolveLocationName(current.locationCode) ?? `Código ${current.locationCode}` }
        : null
    );
    setEditing(true);
  }

  async function handleSaveStudy() {
    if (!current) return;
    setSavingStudy(true);
    const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim() ? editName : current.name,
        notes: editNotes.trim() ? editNotes : null,
        locationCode: editLocation?.code ?? 2724,
      }),
    });
    const data = await res.json();
    setSavingStudy(false);
    if (!res.ok) return;
    setCurrent(data);
    setEditing(false);
    loadStudies();
  }

  async function handleDeleteStudy() {
    if (!current) return;
    if (!window.confirm(`¿Eliminar el estudio '${current.name}' y todas sus keywords?`)) return;
    setDeletingStudy(true);
    const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/${current.id}`, {
      method: "DELETE",
    });
    setDeletingStudy(false);
    if (!res.ok) return;
    setCurrent(null);
    setEditing(false);
    loadStudies();
  }

  // Deep-link (?estudio=<id>) desde Competidores/TF-IDF tras importar — abre
  // ese estudio directamente en vez de mostrar el listado.
  const searchParams = useSearchParams();
  const deepLinkStudyId = searchParams.get("estudio");

  useEffect(() => {
    loadStudies().finally(() => setLoadingStudies(false));
    if (deepLinkStudyId) openStudy(deepLinkStudyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleCreateStudy(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName || undefined }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) return;
    setNewName("");
    setCurrent(data);
    setNewOpen(false);
    loadStudies();
  }

  async function handleImportFile(file: File) {
    setImportFileError("");
    setImportingFile(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/importar-archivo`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setImportingFile(false);
    if (!res.ok) {
      setImportFileError(data.error ?? "Error al importar el archivo");
      return;
    }
    setCurrent(data);
    setNewOpen(false);
    loadStudies();
  }

  async function handleSearch() {
    setSuggError("");
    if (!seed.trim()) return;
    setSearching(true);
    setSuggestions([]);
    const res = await fetch(
      `/api/proyectos/${projectId}/keywords/estudios/${current!.id}/sugerencias?seed=${encodeURIComponent(seed.trim())}&limit=${limit}`
    );
    const data = await res.json();
    setSearching(false);
    if (!res.ok) {
      setSuggError(data.error ?? "Error al buscar sugerencias");
      return;
    }
    setSuggestions(data.items ?? []);
  }

  async function addItems(items: Suggestion[]) {
    if (items.length === 0) return;
    const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/${current!.id}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      reloadCurrent();
      // Quita de la lista de sugerencias las ya añadidas.
      const added = new Set(items.map((i) => i.keyword));
      setSuggestions((prev) => prev.filter((s) => !added.has(s.keyword)));
    }
  }

  async function handleResolve() {
    setSuggError("");
    setResolving(true);
    const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/${current!.id}/keywords/resolver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: pasteText }),
    });
    const data = await res.json();
    setResolving(false);
    if (!res.ok) {
      setSuggError(data.error ?? "Error al resolver la lista");
      return;
    }
    setPasteText("");
    reloadCurrent();
  }

  async function handleRemove(keywordId: string) {
    await fetch(`/api/proyectos/${projectId}/keywords/estudios/${current!.id}/keywords/${keywordId}`, {
      method: "DELETE",
    });
    reloadCurrent();
  }

  function exportCsv() {
    if (!current) return;
    downloadCsv(
      `keywords-${current.name}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Keyword", "Volumen", "Competición", "CPC", "Intención", "Prioridad"],
      current.keywords.map((kw) => [kw.keyword, kw.searchVolume ?? "", kw.competition ?? "", kw.cpc ?? "", kw.intent ?? "", kw.priority])
    );
  }

  async function handleGenerateStructure() {
    setStructureError("");
    setGeneratingStructure(true);
    try {
      const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/${current!.id}/estructura`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setStructureError(data.error ?? "Error al generar la estructura");
        return;
      }
      setCurrent((prev) => (prev ? { ...prev, structure: data.structure, structureModel: data.structureModel, updatedAt: data.updatedAt } : prev));
      loadStudies();
    } catch {
      setStructureError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setGeneratingStructure(false);
    }
  }

  const tree = current?.structure?.pages ? buildTree(current.structure.pages) : [];
  const inStudy = new Set(current?.keywords.map((k) => k.keyword) ?? []);

  // ===== Vista del workspace (estudio abierto) =====
  if (current) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setCurrent(null)}
          className="flex items-center gap-1 -ml-1 px-1.5 py-1 rounded-lg text-sm text-ink-soft hover:text-ink hover:bg-background transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a estudios
        </button>

        <div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">{current.name}</h2>
              <p className="text-xs font-semibold text-ink-faint mt-2 tabular-nums">
                {current.keywords.length} keywords · {current.languageCode.toUpperCase()}/{current.locationCode} · {new Date(current.createdAt).toLocaleDateString("es-ES")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={startEdit}
                disabled={deletingStudy}
                className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-background disabled:opacity-50 transition-colors"
                title="Editar estudio"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={handleDeleteStudy}
                disabled={deletingStudy}
                className="p-1.5 rounded-lg text-ink-faint hover:text-alert-ink hover:bg-alert-tint disabled:opacity-50 transition-colors"
                title="Eliminar estudio"
              >
                {deletingStudy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {current.notes && !editing && (
            <p className="text-sm text-ink-soft mt-2 whitespace-pre-wrap">{current.notes}</p>
          )}
        </div>

        {/* Resumen del estudio */}
        {current.keywords.length > 0 && (() => {
          const kws = current.keywords;
          const totalVolume = kws.reduce((sum, k) => sum + (k.searchVolume ?? 0), 0);
          const ranked = kws.filter((k) => k.rankPosition != null).length;
          const intents = ["informacional", "transaccional", "mixta", "navegacional"].map((i) => ({ i, n: kws.filter((k) => k.intent === i).length }));
          const withIntent = intents.reduce((a, b) => a + b.n, 0);
          const INTENT_BAR: Record<string, string> = { informacional: "bg-brand-300", transaccional: "bg-brand-500", mixta: "bg-brand-200", navegacional: "bg-brand-100" };
          return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile highlight label="Keywords" value={kws.length.toLocaleString("es-ES")} hint="en este estudio" />
              <StatTile label="Volumen total" value={totalVolume >= 1000 ? `${(totalVolume / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k` : totalVolume} hint="búsquedas al mes" />
              <div className="flex items-center justify-between gap-3 rounded-[20px] border border-line bg-surface p-5 shadow-card">
                <div>
                  <p className="text-[13px] font-semibold text-ink-soft">Ya posicionas</p>
                  <p className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">{ranked}</p>
                  <p className="mt-2 text-xs text-ink-faint">con posición en Rank Tracking</p>
                </div>
                <RadialGauge value={(ranked / kws.length) * 100} size={72} />
              </div>
              <div className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
                <p className="text-[13px] font-semibold text-ink-soft">Intención de búsqueda</p>
                {withIntent > 0 ? (
                  <>
                    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-brand-50">
                      {intents.filter((x) => x.n > 0).map((x) => (
                        <div key={x.i} className={INTENT_BAR[x.i]} style={{ width: `${(x.n / withIntent) * 100}%` }} title={`${x.i}: ${x.n}`} />
                      ))}
                    </div>
                    <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-soft">
                      {intents.filter((x) => x.n > 0).map((x) => (
                        <li key={x.i} className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", INTENT_BAR[x.i])} />
                          <span className="capitalize">{x.i}</span>
                          <strong className="ml-auto tabular-nums text-ink">{x.n}</strong>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-ink-faint">Sin intención resuelta en este estudio.</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Panel inline de edición del estudio */}
        {editing && (
          <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-faint">Nombre del estudio</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={120}
                className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-faint">Notas</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Notas internas sobre este estudio (opcional)..."
                className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-faint">Ubicación de la búsqueda</label>
              <div className="max-w-sm">
                <LocationPicker value={editLocation} onChange={setEditLocation} />
              </div>
              <p className="text-xs text-ink-faint">
                Cambiarla aquí NO recalcula en bloque las keywords ya cacheadas, pero el siguiente
                “Lanzar / re-procesar análisis” propagará la nueva ubicación al Rank Tracking
                (reemplazando las keywords viejas sin histórico).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveStudy}
                disabled={savingStudy}
                className="flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong transition-colors disabled:opacity-50"
              >
                {savingStudy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={savingStudy}
                className="border border-line bg-surface text-ink-soft text-sm rounded-xl px-4 py-2 hover:bg-background transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Buscar keywords relacionadas (Planificador) */}
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
          <h3 className="text-lg font-bold tracking-tight text-ink">Buscar keywords relacionadas</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="block text-xs font-semibold text-ink-faint">Keyword semilla</label>
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="abogado de familia"
                className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink-faint">Nº resultados</label>
              <div className="inline-flex items-center gap-1 bg-black/[0.05] rounded-xl p-1">
                {LIMITS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLimit(n)}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                      limit === n
                        ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]"
                        : "text-ink-soft hover:text-ink"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="inline-flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong transition-colors disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </div>
          <p className="text-xs text-ink-faint">
            Coste estimado de la búsqueda: {fmtCredits(suggestionsCostUsd(limit))} (las que añadas después son gratis, ya cacheadas).
          </p>

          {suggError && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-xl">{suggError}</p>}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-faint">{suggestions.length} sugerencias</p>
                <button
                  onClick={() => addItems(suggestions)}
                  className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-strong"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" /> Añadir todas
                </button>
              </div>
              <div className="max-h-80 overflow-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-ink-faint bg-surface-muted">
                      <th className="py-2.5 px-3 pl-4 font-medium rounded-tl-lg">Keyword</th>
                      <th className="py-2.5 px-3 font-medium w-20">Volumen</th>
                      <th className="py-2.5 px-3 font-medium w-14">Tend.</th>
                      <th className="py-2.5 px-3 font-medium w-16">Comp.</th>
                      <th className="py-2.5 px-3 font-medium w-20">CPC</th>
                      <th className="py-2.5 px-3 font-medium w-24">Dif.</th>
                      <th className="py-2.5 px-3 font-medium w-28">Intención</th>
                      <th className="py-2.5 px-3 pr-4 font-medium rounded-tr-lg w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => {
                      const already = inStudy.has(s.keyword);
                      return (
                        <tr key={s.keyword} className="border-b border-line/60 last:border-0 hover:bg-black/[0.025] transition-colors">
                          <td className="py-2.5 px-3 pl-4 text-ink">{s.keyword}</td>
                          <td className="py-2.5 px-3 text-ink-soft tabular-nums w-20">
                            {s.searchVolume === null ? <span className="text-ink-faint">—</span> : s.searchVolume.toLocaleString("es-ES")}
                          </td>
                          <td className="py-2.5 px-3 w-14">
                            <SeasonalitySparkline points={s.monthlySearches} />
                          </td>
                          <td className="py-2.5 px-3 w-16">
                            <span className={cn("text-xs font-medium", COMPETITION_STYLES[s.competition ?? ""] ?? "text-ink-faint")}>
                              {s.competition ?? "—"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-ink-soft tabular-nums w-20">{fmtCpc(s.cpc)}</td>
                          <td className="py-2.5 px-3 w-24">
                            {(() => {
                              const dif = difficultyBadge(s.difficulty);
                              return dif ? (
                                <Pill tone={dif.tone} className="px-1.5 text-[11px]">{dif.label}</Pill>
                              ) : (
                                <span className="text-ink-faint text-xs">—</span>
                              );
                            })()}
                          </td>
                          <td className="py-2.5 px-3 w-28">
                            {s.intent && (
                              <Pill tone={INTENT_TONES[s.intent] ?? "neutral"} className="px-2 text-[11px]">
                                {s.intent}
                              </Pill>
                            )}
                          </td>
                          <td className="py-2.5 px-3 pr-4 w-12 text-right">
                            <button
                              onClick={() => addItems([s])}
                              disabled={already}
                              className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-background disabled:text-brand disabled:cursor-default transition-colors"
                              title={already ? "Ya en el estudio" : "Añadir al estudio"}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Pegar lista (alternativa) */}
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
          <button
            onClick={() => setShowPaste((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink transition-colors"
          >
            <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform", showPaste && "rotate-180")} />
            O pegar una lista de keywords
          </button>
          {showPaste && (
            <div className="space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                placeholder={"una keyword por línea"}
                className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
              />
              <button
                onClick={handleResolve}
                disabled={resolving || !pasteText.trim()}
                className="inline-flex items-center gap-2 border border-line bg-surface text-ink-soft text-sm rounded-xl px-4 py-2 hover:bg-background transition-colors disabled:opacity-50"
              >
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Añadir al estudio
              </button>
            </div>
          )}
        </div>

        {/* Tabla de keywords del estudio */}
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight text-ink">Keywords del estudio ({current.keywords.length})</h3>
            <button
              onClick={exportCsv}
              disabled={current.keywords.length === 0}
              className="inline-flex items-center gap-1.5 border border-line bg-surface text-ink-soft text-xs font-medium rounded-xl px-3 py-1.5 hover:bg-background transition-colors disabled:opacity-50"
              title="Exportar a CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>

          {current.keywords.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink-faint">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-sm text-ink-soft">Aún no hay keywords. Busca relacionadas o pega una lista para empezar.</p>
            </div>
          ) : (() => {
            const kws = current.keywords;
            const has = {
              trend: kws.some((k) => (k.monthlySearches?.length ?? 0) > 1),
              comp: kws.some((k) => k.competition),
              cpc: kws.some((k) => k.cpc != null && k.cpc !== ""),
              dif: kws.some((k) => k.difficulty != null),
              intent: kws.some((k) => k.intent),
              pos: kws.some((k) => k.rankPosition != null),
              tfidf: kws.some((k) => k.tfidfAvailable),
            };
            const q = kwSearch.trim().toLowerCase();
            const filtered = q ? kws.filter((k) => k.keyword.toLowerCase().includes(q)) : kws;
            const shown = filtered.slice(0, kwShown);
            const maxVol = Math.max(1, ...kws.map((k) => k.searchVolume ?? 0));
            return (
              <div className="space-y-3">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <input
                    value={kwSearch}
                    onChange={(e) => {
                      setKwSearch(e.target.value);
                      setKwShown(50);
                    }}
                    placeholder="Buscar en el estudio…"
                    className="w-full rounded-full border border-line bg-surface py-2 pl-10 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                </div>
                <div className="max-h-[640px] overflow-auto rounded-xl border border-line">
                  <table className="data-table">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th>Keyword</th>
                        <th className="w-[22%]">Volumen</th>
                        {has.trend && <th>Tend.</th>}
                        {has.comp && <th>Comp.</th>}
                        {has.cpc && <th className="num">CPC</th>}
                        {has.dif && <th>Dif.</th>}
                        {has.intent && <th>Intención</th>}
                        {has.pos && <th className="num">Posición</th>}
                        {has.tfidf && <th>TF-IDF</th>}
                        <th className="num">Prio.</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((kw) => (
                        <tr key={kw.id}>
                          <td className="font-medium">{kw.keyword}</td>
                          <td>
                            {kw.searchVolume === null ? (
                              <span className="text-ink-faint">—</span>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <span className="w-14 shrink-0 tabular-nums text-ink-soft">{kw.searchVolume.toLocaleString("es-ES")}</span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-50">
                                  <div className="h-full rounded-full bg-brand-300" style={{ width: `${Math.max(2, (kw.searchVolume / maxVol) * 100)}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                          {has.trend && (
                            <td>
                              <SeasonalitySparkline points={kw.monthlySearches} />
                            </td>
                          )}
                          {has.comp && (
                            <td>
                              <span className={cn("text-xs font-medium", COMPETITION_STYLES[kw.competition ?? ""] ?? "text-ink-faint")}>{kw.competition ?? "—"}</span>
                            </td>
                          )}
                          {has.cpc && <td className="num text-ink-soft">{fmtCpc(kw.cpc)}</td>}
                          {has.dif && (
                            <td>
                              {(() => {
                                const dif = difficultyBadge(kw.difficulty);
                                return dif ? <Pill tone={dif.tone} className="px-1.5 text-[11px]">{dif.label}</Pill> : <span className="text-ink-faint">—</span>;
                              })()}
                            </td>
                          )}
                          {has.intent && (
                            <td>
                              {kw.intent ? <Pill tone={INTENT_TONES[kw.intent] ?? "neutral"} className="px-2 text-[11px]">{kw.intent}</Pill> : <span className="text-ink-faint">—</span>}
                            </td>
                          )}
                          {has.pos && (
                            <td className="num text-ink-soft">{kw.rankPosition == null ? <span className="text-ink-faint">—</span> : `#${kw.rankPosition}`}</td>
                          )}
                          {has.tfidf && (
                            <td>
                              {kw.tfidfAvailable ? (
                                <Link
                                  href={`/app/proyectos/${projectId}/contenido/tfidf?keyword=${encodeURIComponent(kw.keyword)}`}
                                  className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand transition-colors hover:bg-brand/20"
                                >
                                  Ver →
                                </Link>
                              ) : (
                                <span className="text-ink-faint">—</span>
                              )}
                            </td>
                          )}
                          <td className="num text-ink-soft">{kw.priority}</td>
                          <td className="text-right">
                            <button
                              onClick={() => handleRemove(kw.id)}
                              className="rounded-md p-1 text-ink-faint transition-colors hover:bg-alert-tint hover:text-alert-ink"
                              title="Quitar del estudio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
                  <span>
                    Mostrando {shown.length.toLocaleString("es-ES")} de {filtered.length.toLocaleString("es-ES")}
                    {q && ` (filtrado de ${kws.length.toLocaleString("es-ES")})`}
                  </span>
                  {filtered.length > shown.length && (
                    <button onClick={() => setKwShown((n) => n + 100)} className="rounded-full border border-line px-3.5 py-1.5 font-semibold text-ink-soft hover:bg-surface-muted">
                      Ver 100 más
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Estructura de URLs — sección propia, no un botón secundario perdido
            en la tabla: es el resultado final del módulo, sobre el que luego
            trabajan Título/Meta y Contenido. */}
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-ink">Estructura de URLs</h3>
              <p className="text-xs text-ink-soft mt-1 max-w-md">
                Propone, vía IA, un árbol de páginas (slug, H1, encabezados) a partir de las
                keywords de este estudio — listo como brief para Contenido y Título/Meta.
              </p>
            </div>
            <button
              onClick={handleGenerateStructure}
              disabled={generatingStructure || current.keywords.length === 0}
              className="inline-flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong transition-colors disabled:opacity-50 shrink-0"
            >
              {generatingStructure && <Loader2 className="h-4 w-4 animate-spin" />}
              {current.structure ? "Regenerar estructura" : "Generar estructura de URLs"}
            </button>
          </div>

          {current.keywords.length === 0 && (
            <p className="text-xs text-ink-faint">Añade al menos una keyword al estudio para poder generarla.</p>
          )}
          {structureError && (
            <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-xl">{structureError}</p>
          )}

          {tree.length > 0 ? (
            <div className="pt-2">
              <p className="text-xs font-semibold text-ink-faint mb-3">
                Generada con {current.structureModel} · {new Date(current.updatedAt).toLocaleString("es-ES")}
              </p>
              <StructureTree nodes={tree} depth={0} />
            </div>
          ) : (
            current.keywords.length > 0 &&
            !generatingStructure && (
              <p className="text-sm text-ink-soft">
                Aún no se ha generado. Pulsa &laquo;Generar estructura de URLs&raquo;.
              </p>
            )
          )}
        </div>
      </div>
    );
  }

  // ===== Vista de listado de estudios =====
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Módulo · Keywords"
        title="Keyword Research"
        description="Estudios de palabras clave por proyecto. Cada estudio es un espacio de trabajo: busca relacionadas, añade las que interesan y construye el árbol de URLs."
        actions={
          <button
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            <Plus className="h-4 w-4" /> Nuevo estudio
          </button>
        }
      />

      {/* Estudios primero (los datos), alta e importación después */}
      <div>
        <h3 className="text-lg font-bold tracking-tight text-ink mb-3">Estudios</h3>
        {loadingStudies ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
        ) : studies.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-ink-faint">
              <FileSearch className="h-5 w-5" />
            </div>
            <p className="text-sm text-ink-soft">Todavía no hay estudios para este proyecto.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {studies.map((s) => (
              <div key={s.id} className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-4">
                {listEditId === s.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={listEditName}
                      onChange={(e) => setListEditName(e.target.value)}
                      className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                      placeholder="Nombre del estudio"
                    />
                    <textarea
                      value={listEditNotes}
                      onChange={(e) => setListEditNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                      placeholder="Notas o descripción breve (opcional)..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleListSave}
                        disabled={listSaving}
                        className="inline-flex items-center gap-1.5 bg-brand text-white text-xs font-medium rounded-full px-3 py-1.5 hover:bg-brand-strong transition-colors disabled:opacity-50"
                      >
                        {listSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                      </button>
                      <button
                        onClick={() => setListEditId(null)}
                        className="px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    {/* Número de keywords como protagonista de la tarjeta */}
                    <button
                      onClick={() => openStudy(s.id)}
                      className="shrink-0 flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-brand/10 hover:bg-brand/15 transition-colors"
                      title="Abrir estudio"
                    >
                      <span className="text-xl font-bold tabular-nums text-brand leading-none">{s._count.keywords}</span>
                      <span className="text-[10px] font-medium text-brand/70 mt-1">keys</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => openStudy(s.id)}
                          className="text-sm font-semibold text-ink hover:text-brand transition-colors text-left min-w-0 truncate"
                        >
                          {s.name}
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); startListEdit(s); }}
                            className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-background transition-colors"
                            title="Editar nombre y notas"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleListDelete(s.id, s.name); }}
                            className="p-1 rounded-md text-ink-faint hover:text-alert-ink hover:bg-alert-tint transition-colors"
                            title="Eliminar estudio"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {s.notes && (
                        <p className="text-xs text-ink-soft mt-1 leading-snug line-clamp-2">{s.notes}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                          {s.languageCode.toUpperCase()}/{s.locationCode}
                        </span>
                        {s.hasStructure && (
                          <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                            estructura
                          </span>
                        )}
                        <span className="text-[11px] text-ink-faint">
                          {new Date(s.createdAt).toLocaleDateString("es-ES")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nuevo estudio (con nombre o subiendo un CSV), desde el botón de arriba */}
      <Modal open={newOpen} title="Nuevo estudio de keywords" onClose={() => setNewOpen(false)} wide>
      <div className="space-y-4">
      <form onSubmit={handleCreateStudy} className="flex items-end gap-3 rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <div className="flex-1 space-y-1.5">
          <label className="block text-sm font-medium text-ink-soft">Nuevo estudio</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Briefing Q3 — Cliente X"
            className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear
        </button>
      </form>

      <div className="space-y-2 rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-ink">O sube un CSV con keywords ya investigadas</h3>
            <p className="text-xs text-ink-soft mt-1 max-w-2xl">
              Columnas: keyword (obligatoria) y, si las tienes, volumen / competencia / cpc / intención.
              También acepta la exportación tal cual de Google Ads Keyword Planner (&laquo;Historial de
              estadísticas de palabras clave&raquo;). Se usan tal cual vengan en el archivo — no se
              completan con otros datos.
            </p>
          </div>
          <label
            className={cn(
              "inline-flex items-center gap-2 border border-line bg-surface text-ink-soft text-sm rounded-xl px-4 py-2 hover:bg-background transition-colors cursor-pointer shrink-0 font-medium",
              importingFile && "opacity-50 pointer-events-none"
            )}
          >
            {importingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Subir archivo
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // permite volver a subir el mismo archivo si falla
                if (file) handleImportFile(file);
              }}
            />
          </label>
        </div>
        {importFileError && (
          <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-xl">{importFileError}</p>
        )}
      </div>
      </div>
      </Modal>
    </div>
  );
}
