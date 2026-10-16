"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { Loader2, ChevronDown, Sparkles, GitFork, RefreshCw } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import { normalizeKeyword } from "@/lib/keywords/normalize";
import { buildStructureTree, type StructureTreeNode } from "@/lib/keywords/structure-tree";
import type { StructureProposal } from "@/lib/keywords/structure";
import StructureTreeView from "@/components/app/StructureTreeView";

type StudyListItem = {
  id: string;
  name: string;
  _count: { keywords: number };
  hasStructure: boolean;
};

type StudyKeyword = { keyword: string; searchVolume: number | null };

type StudyDetail = {
  id: string;
  name: string;
  structure: StructureProposal | null;
  structureModel: string | null;
  updatedAt: string;
  keywords: StudyKeyword[];
};

export default function ArquitecturaView({
  projectId,
  domain,
}: {
  projectId: string;
  domain: string | null;
}) {
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [loadingStudies, setLoadingStudies] = useState(true);
  const [studyId, setStudyId] = useState("");
  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [loadedStudyId, setLoadedStudyId] = useState<string | null>(null);
  const loadingStudy = studyId !== "" && loadedStudyId !== studyId;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Deep-link (?estudio=<id>) desde Competidores/TF-IDF tras importar — si
  // apunta a un estudio real, gana sobre el fallback de "primero con
  // keywords".
  const searchParams = useSearchParams();
  const deepLinkStudyId = searchParams.get("estudio");

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/keywords/estudios`)
      .then((r) => r.json())
      .then((list: StudyListItem[]) => {
        if (Array.isArray(list)) {
          setStudies(list);
          if (deepLinkStudyId && list.some((s) => s.id === deepLinkStudyId)) {
            setStudyId(deepLinkStudyId);
            return;
          }
          // Preselecciona el primer estudio que ya tenga keywords — el
          // usuario puede cambiarlo, esto solo evita una pantalla vacía.
          const withKeywords = list.find((s) => s._count.keywords > 0);
          if (withKeywords) setStudyId(withKeywords.id);
        }
      })
      .finally(() => setLoadingStudies(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Reset del estudio cargado y del error al cambiar/vaciar la selección —
  // ajuste de estado durante el render (no dentro de un effect), como
  // recomienda https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-based-on-a-prop-change
  const [studyIdForStudy, setStudyIdForStudy] = useState(studyId);
  if (studyId !== studyIdForStudy) {
    setStudyIdForStudy(studyId);
    setError("");
    if (!studyId) setStudy(null);
  }

  useEffect(() => {
    if (!studyId) return;
    fetch(`/api/proyectos/${projectId}/keywords/estudios/${studyId}`)
      .then((r) => r.json())
      .then((d: StudyDetail) => {
        if (d && d.id) setStudy(d);
      })
      .finally(() => setLoadedStudyId(studyId));
  }, [projectId, studyId]);

  async function handleGenerate() {
    if (!studyId) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/proyectos/${projectId}/keywords/estudios/${studyId}/estructura`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al generar la estructura");
        return;
      }
      setStudy((prev) =>
        prev ? { ...prev, structure: data.structure, structureModel: data.structureModel, updatedAt: data.updatedAt } : prev
      );
      // Refresca la lista para que el badge "hasStructure" quede al día.
      setStudies((prev) => prev.map((s) => (s.id === studyId ? { ...s, hasStructure: true } : s)));
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  const volumeByKeyword = new Map<string, number>(
    (study?.keywords ?? [])
      .filter((k) => k.searchVolume !== null)
      .map((k) => [normalizeKeyword(k.keyword), k.searchVolume as number])
  );

  const tree: StructureTreeNode | null =
    study?.structure && study.structure.pages.length > 0
      ? buildStructureTree(study.structure.pages, volumeByKeyword)
      : null;

  const totalVolume = tree?.volume ?? 0;
  const pageCount = study?.structure?.pages.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Arquitectura de la web</h2>
        <p className="text-sm text-ink-soft mt-1">
          Jerarquía de páginas recomendada a partir de un estudio de keywords (pestaña Estudios) — agrupa las
          keywords reales del estudio por volumen de búsqueda y propone la URL optimizada de cada
          página.
        </p>
      </div>

      {/* Selector de estudio */}
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px] space-y-1">
            <label className="block text-xs font-medium text-ink-soft">Estudio de keywords (Módulo 1)</label>
            {loadingStudies ? (
              <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
            ) : studies.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Aún no hay estudios de keywords en este proyecto — crea uno en la pestaña Keywords.
              </p>
            ) : (
              <Select.Root value={studyId} onValueChange={setStudyId}>
                <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors bg-surface">
                  <Select.Value placeholder="Selecciona un estudio" />
                  <Select.Icon><ChevronDown className="h-4 w-4 text-ink-faint" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface border border-line rounded-xl shadow-lg overflow-hidden z-50 max-h-60">
                    <Select.Viewport>
                      {studies.map((s) => (
                        <Select.Item key={s.id} value={s.id} className="px-3 py-2 text-sm text-ink outline-none cursor-pointer data-[highlighted]:bg-surface-muted">
                          <Select.ItemText>
                            {s.name} ({s._count.keywords}){s.hasStructure ? " · con estructura" : ""}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            )}
          </div>
          {studyId && study && study.keywords.length > 0 && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-brand-900 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 shrink-0"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : study.structure ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {study.structure ? "Regenerar estructura" : "Generar estructura"}
            </button>
          )}
        </div>
        {study && study.keywords.length === 0 && (
          <p className="text-xs text-accent-ink">
            Este estudio todavía no tiene keywords — añádelas en la pestaña Keywords antes de generar
            la arquitectura.
          </p>
        )}
        {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>}
        <p className="text-xs text-ink-faint">
          La agrupación en páginas y su jerarquía las genera un modelo de IA (OpenRouter) a partir de
          las keywords reales del estudio (volumen, intención, prioridad) — el volumen mostrado en el
          árbol es siempre el real acumulado, no una estimación de la IA.
        </p>
      </div>

      {/* Árbol en abanico */}
      {loadingStudy ? (
        <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
      ) : tree ? (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <GitFork className="h-4 w-4 text-ink-soft" />
              <h3 className="text-sm font-semibold text-ink">
                {pageCount} página{pageCount === 1 ? "" : "s"} propuesta{pageCount === 1 ? "" : "s"}
              </h3>
            </div>
            <p className="text-xs text-ink-faint">
              {totalVolume.toLocaleString("es-ES")} vol. total cubierto
              {study?.structureModel && <> · generado con {study.structureModel}</>}
              {study?.updatedAt && <> · {new Date(study.updatedAt).toLocaleDateString("es-ES")}</>}
            </p>
          </div>
          <p className="text-xs text-ink-faint">
            Despliega cada rama para ver sus páginas. Cada tarjeta muestra el H1, la URL, los
            encabezados (H2/H3) y las keywords que cubre. El orden dentro de cada rama es por
            volumen de búsqueda real, de mayor a menor.
          </p>
          <StructureTreeView root={tree} domain={domain} />
        </div>
      ) : study && !study.structure ? (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-6 text-center space-y-2">
          <GitFork className="h-6 w-6 text-ink-faint mx-auto" />
          <p className="text-sm text-ink-soft">
            Este estudio todavía no tiene una arquitectura generada.
          </p>
          {study.keywords.length > 0 && (
            <p className="text-xs text-ink-faint">
              Pulsa «Generar estructura» arriba para crearla a partir de sus {study.keywords.length}{" "}
              keywords.
            </p>
          )}
        </div>
      ) : !loadingStudies && studies.length > 0 && !studyId ? (
        <p className="text-sm text-ink-soft">Selecciona un estudio para ver o generar su arquitectura.</p>
      ) : null}
    </div>
  );
}
