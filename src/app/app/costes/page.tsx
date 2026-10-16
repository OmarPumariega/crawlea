"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import ProjectSwitcher, { type ProjectInfo } from "@/components/app/ProjectSwitcher";
import PageHeader from "@/components/app/PageHeader";

type EndpointRow = { api: string; endpoint: string; cost: number; count: number };
type ProjectRow = { projectId: string | null; name: string; cost: number; limit: number | null };
type CallRow = { id: string; api: string; endpoint: string; model: string | null; cost: number; createdAt: string };

type CostData = {
  monthLabel: string;
  year: number;
  month: number;
  isCurrentMonth: boolean;
  scope: "global" | "project";
  project: { id: string; name: string } | null;
  dataforseo: { spentUsd: number; limitUsd: number | null; nearLimit: boolean; blocked: boolean };
  totalUsd: number;
  byEndpoint: EndpointRow[];
  byProject: ProjectRow[];
  recentCalls: CallRow[];
};

const ENDPOINT_LABELS: Record<string, string> = {
  "modulo1.keywords.volumen": "M1 · Volumen de keywords",
  "modulo1.keywords.intencion": "M1 · Intención de keywords",
  "modulo1.estructura": "M1 · Estructura de URLs (IA)",
  "modulo3.titulos-meta": "M3 · Títulos y meta (IA)",
  "modulo4.schema.article": "M4 · Schema (IA)",
  "modulo4.schema.faq": "M4 · Schema (IA)",
  "modulo7.contenido": "M7 · Contenido (IA)",
  "modulo5.rankcheck": "M5 · Rank tracking",
  "modulo9.geogrid": "M9 · Geogrid",
  "modulo9.geogrid.buscar-ficha": "M9 · Buscar ficha GBP",
  "competidores.visibilidad": "Competidores · Visibilidad",
  "competidores.ranked": "Competidores · Keywords que ranquea",
  "competidores.contentgap": "Competidores · Content gap",
};

// toLocaleDateString con month:"long" da "julio de 2026"; la clase Tailwind
// "capitalize" pone mayúscula en CADA palabra ("Julio De 2026") — se
// capitaliza solo la primera letra a mano.
function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

const now = new Date();

export default function CostesPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  // "loading" se deriva comparando la clave pedida contra la última cargada,
  // en vez de un setState síncrono al inicio del effect (evita un render de
  // más y el aviso de react-hooks/set-state-in-effect).
  const requestKey = `${selectedProjectId ?? ""}-${year}-${month}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    fetch("/api/proyectos")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ProjectInfo[]) => {
        if (Array.isArray(list)) setProjects(list.map((p) => ({ id: p.id, name: p.name, isLocalBusiness: !!p.isLocalBusiness })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (selectedProjectId) params.set("projectId", selectedProjectId);
    fetch(`/api/costes?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.totalUsd === "number") setData(d);
        setLoadedKey(requestKey);
      });
  }, [requestKey, selectedProjectId, year, month]);

  // No se puede navegar a meses futuros — no hay datos que mostrar.
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    // No adelantar más allá del mes en curso.
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) return;
    setYear(y);
    setMonth(m);
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />;
  if (!data) return <p className="text-sm text-ink-soft">No se pudieron cargar los costes.</p>;

  const dfs = data.dataforseo;
  const dfsPct = dfs.limitUsd !== null ? (dfs.spentUsd / dfs.limitUsd) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta · Costes"
        title="Costes de API"
        description={data.project ? data.project.name : "Todos los proyectos"}
        actions={
          <button
            onClick={() =>
              downloadCsv(`costes-${data.monthLabel.replace(/\s+/g, "-")}${data.project ? `-${data.project.name}` : ""}.csv`, ["Sección", "Concepto", "Coste (USD)", "Llamadas / tope"], [
                ...data.byProject.map((r) => ["Por proyecto", r.name, r.cost.toFixed(3), r.limit !== null ? `tope ${r.limit.toFixed(2)}$` : ""]),
                ...data.byEndpoint.map((r) => ["Por tipo de llamada", ENDPOINT_LABELS[r.endpoint] ?? r.endpoint, r.cost.toFixed(3), `${r.count} llamadas`]),
                ...data.recentCalls.map((c) => [
                  "Llamada individual",
                  `${ENDPOINT_LABELS[c.endpoint] ?? c.endpoint}${c.model ? ` (${c.model})` : ""}`,
                  c.cost.toFixed(4),
                  new Date(c.createdAt).toLocaleString("es-ES"),
                ]),
              ])
            }
            className="flex items-center gap-1.5 px-3 py-1.5 border border-line text-ink-soft text-xs font-medium rounded-xl hover:bg-background shrink-0"
            title="Exportar a CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        }
      />

      {/* Navegador de mes/año — sin esto solo se podía ver el mes en curso.
          No deja avanzar más allá del mes actual (no hay datos futuros). */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-surface border border-line rounded-xl px-1 py-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-1.5 text-ink-soft hover:text-ink hover:bg-background rounded-md"
            title="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-ink px-2 min-w-[9rem] text-center">
            {capitalizeFirst(data.monthLabel)}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="p-1.5 text-ink-soft hover:text-ink hover:bg-background rounded-md disabled:opacity-30 disabled:hover:bg-transparent"
            title="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!isCurrentMonth && (
          <button
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth() + 1);
            }}
            className="text-xs text-ink-soft hover:text-ink"
          >
            Volver al mes en curso
          </button>
        )}
      </div>

      {/* Filtro por proyecto: mismo desglose pero acotado a uno solo, con
          trazabilidad total hasta la llamada individual. */}
      <div className="flex items-center gap-2">
        <div className="w-72">
          <ProjectSwitcher projects={projects} currentId={selectedProjectId} onSelect={setSelectedProjectId} />
        </div>
        {selectedProjectId && (
          <button
            onClick={() => setSelectedProjectId(null)}
            className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink px-2 py-1"
          >
            <X className="h-3.5 w-3.5" />
            Ver todos los proyectos
          </button>
        )}
      </div>

      {/* DataForSEO vs tope */}
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">DataForSEO</h2>
          {dfs.limitUsd !== null && dfs.blocked && (
            <span className="flex items-center gap-1 text-xs text-alert-ink">
              <AlertTriangle className="h-3.5 w-3.5" /> Tope alcanzado
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-ink">{dfs.spentUsd.toFixed(2)}$</span>
          {dfs.limitUsd !== null ? (
            <span className="text-sm text-ink-faint">/ {dfs.limitUsd.toFixed(2)}$ configurados</span>
          ) : (
            <span className="text-xs text-ink-faint">(sin tope — define DATAFORSEO_MONTHLY_LIMIT_USD)</span>
          )}
        </div>
        {dfs.limitUsd !== null && (
          <Bar
            pct={dfsPct}
            className={dfs.blocked ? "bg-alert" : dfs.nearLimit ? "bg-brand-300" : "bg-brand-500"}
          />
        )}
      </div>

      {/* Total mes (todas las APIs) */}
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
        <h2 className="text-sm font-semibold text-ink">
          Total del mes (todas las APIs){data.project && <> · {data.project.name}</>}
        </h2>
        <div className="text-2xl font-semibold text-ink mt-1">{data.totalUsd.toFixed(2)}$</div>
        <p className="text-xs text-ink-faint">Incluye DataForSEO y OpenRouter (títulos, schema, contenido...).</p>
      </div>

      {/* Desglose por endpoint */}
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Por tipo de llamada</h2>
        {data.byEndpoint.length === 0 ? (
          <p className="text-sm text-ink-soft">Sin consumo este mes.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.byEndpoint.map((r) => (
                <tr key={r.api + r.endpoint} className="border-b border-line last:border-0">
                  <td className="py-2 text-ink-soft">
                    {ENDPOINT_LABELS[r.endpoint] ?? r.endpoint}
                    <span className="text-xs text-ink-faint ml-1">· {r.count} {r.count === 1 ? "llamada" : "llamadas"}</span>
                  </td>
                  <td className="py-2 text-right text-ink tabular-nums">{r.cost.toFixed(3)}$</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Desglose por proyecto — solo en la vista global; en la vista de un
          proyecto ya está todo acotado, esta tabla no aportaría nada. Cada
          fila lleva directo a su vista filtrada (mismo atajo que el selector). */}
      {data.scope === "global" && (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink">Por proyecto</h2>
          {data.byProject.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin consumo este mes.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.byProject.map((r) => (
                  <tr
                    key={(r.projectId ?? "null") + r.name}
                    className={cn(
                      "border-b border-line last:border-0",
                      r.projectId && "cursor-pointer hover:bg-background"
                    )}
                    onClick={() => r.projectId && setSelectedProjectId(r.projectId)}
                  >
                    <td className="py-2 text-ink-soft truncate">{r.name}</td>
                    <td className="py-2 text-right text-ink tabular-nums">
                      {r.cost.toFixed(3)}$
                      {r.limit !== null && (
                        <span className={cn("text-xs ml-1", r.cost >= r.limit ? "text-alert-ink" : r.cost >= r.limit * 0.8 ? "text-accent-ink" : "text-ink-faint")}>
                          / {r.limit.toFixed(2)}$
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Llamadas individuales — solo en la vista de un proyecto: control
          total hasta la llamada concreta (qué API, qué módulo, cuándo, coste). */}
      {data.scope === "project" && (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink">
            Llamadas recientes ({data.recentCalls.length}{data.recentCalls.length === 100 ? "+" : ""})
          </h2>
          {data.recentCalls.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin llamadas registradas este mes.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-xs text-ink-faint border-b border-line">
                    <th className="font-medium py-1.5 pr-2">Módulo / llamada</th>
                    <th className="font-medium py-1.5 px-2">Modelo</th>
                    <th className="font-medium py-1.5 px-2 text-right">Coste</th>
                    <th className="font-medium py-1.5 pl-2 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentCalls.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="py-1.5 pr-2 text-ink-soft">{ENDPOINT_LABELS[c.endpoint] ?? c.endpoint}</td>
                      <td className="py-1.5 px-2 text-ink-faint text-xs">{c.model ?? "—"}</td>
                      <td className="py-1.5 px-2 text-right text-ink tabular-nums">{c.cost.toFixed(4)}$</td>
                      <td className="py-1.5 pl-2 text-right text-ink-faint text-xs whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleString("es-ES")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
