"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtCredits } from "@/lib/credits";
import { Loader2, RefreshCw, Rocket, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

// Panel "Poner en marcha el proyecto" (antes "Lanzar / re-procesar análisis"): encola el mismo flujo que el wizard
// de alta (importar keywords del estudio → chequear posición → TF-IDF gratis;
// analizar competidores → content gap) como un BootstrapRun en background —
// mismo patrón pending/running/completed/failed que Auditoría/Geogrid, con
// polling cada 3s mientras dura. No bloquea la navegación: el usuario puede
// moverse a otro módulo y volver más tarde a ver el resultado.

type Estimate = {
  keywordsToCheck: number;
  competitorsToAnalyze: number;
  estimatedCostUsd: number;
  missingDomain: boolean;
};

type Result = {
  keywordsImported: number;
  keywordsReplaced?: number;
  keywordsChecked: number;
  tfidfGenerated: number;
  competitorsAnalyzed: number;
  contentGapsCalculated: number;
  errors: { step: string; ref: string; message: string }[];
  spendLimitHit: boolean;
};

type BootstrapRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result: Result | null;
  errorMessage: string | null;
};

export default function BootstrapPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [run, setRun] = useState<BootstrapRun | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadEstimate = useCallback(() => {
    setLoadingEstimate(true);
    fetch(`/api/proyectos/${projectId}/bootstrap`)
      .then((r) => r.json())
      .then((d: Estimate) => setEstimate(d))
      .catch(() => setEstimate(null))
      .finally(() => setLoadingEstimate(false));
  }, [projectId]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const pollRun = useCallback(
    (runId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/proyectos/${projectId}/bootstrap/runs/${runId}`);
        if (!res.ok) return;
        const data: BootstrapRun = await res.json();
        setRun(data);
        if (data.status === "completed" || data.status === "failed") {
          stopPolling();
          loadEstimate();
          router.refresh();
        }
      }, 3000);
    },
    [projectId, loadEstimate, router]
  );

  useEffect(() => {
    // loadingEstimate ya arranca en `true` (useState inicial) — no hace falta
    // volver a activarlo aquí, evita un setState síncrono dentro del efecto.
    fetch(`/api/proyectos/${projectId}/bootstrap`)
      .then((r) => r.json())
      .then((d: Estimate) => setEstimate(d))
      .catch(() => setEstimate(null))
      .finally(() => setLoadingEstimate(false));
    fetch(`/api/proyectos/${projectId}/bootstrap/runs`)
      .then((r) => r.json())
      .then((data: BootstrapRun[]) => {
        const latest = Array.isArray(data) ? data[0] : null;
        if (!latest) return;
        setRun(latest);
        if (latest.status === "pending" || latest.status === "running") {
          pollRun(latest.id);
        }
      })
      .catch(() => {});
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const running = run?.status === "pending" || run?.status === "running";

  const nothingToDo: boolean =
    !!estimate &&
    !estimate.missingDomain &&
    estimate.keywordsToCheck === 0 &&
    estimate.competitorsToAnalyze === 0;

  async function launch() {
    setLaunching(true);
    setError("");
    try {
      const res = await fetch(`/api/proyectos/${projectId}/bootstrap`, { method: "POST" });
      const data = await res.json();
      if (res.status === 409 && data.run) {
        // Ya había uno en curso (p.ej. lanzado desde el wizard): nos
        // enganchamos a su polling en vez de mostrar error.
        setRun(data.run);
        pollRun(data.run.id);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Error al lanzar el análisis");
        return;
      }
      setRun(data as BootstrapRun);
      pollRun(data.id);
    } catch {
      setError("Error de conexión");
    } finally {
      setLaunching(false);
      setConfirming(false);
    }
  }

  const result = run?.status === "completed" ? run.result : null;

  // Si no queda nada por poner en marcha y no hay un resultado o error que
  // enseñar, el panel no ocupa sitio.
  if (!running && !loadingEstimate && nothingToDo && !result && run?.status !== "failed" && !error) return null;

  return (
    <div className="space-y-3 rounded-[20px] border border-line bg-surface p-6 shadow-card">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-brand text-white flex items-center justify-center shrink-0">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold tracking-tight text-ink">Poner en marcha el proyecto</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            Un solo clic para dejar el proyecto preparado en vez de hacerlo módulo a módulo. Hace dos cosas:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
            <li>
              Añade a <strong className="text-ink">Rank Tracking</strong> las keywords de tu estudio «General» y comprueba
              en qué posición estás (el TF-IDF de esas keywords sale gratis).
            </li>
            <li>
              Analiza a <strong className="text-ink">todos tus competidores</strong>: tráfico, keywords y content gap.
            </li>
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            Gasta créditos (se muestra el coste antes de confirmar), va en segundo plano y puedes seguir navegando.
          </p>
        </div>
      </div>

      {running && (
        <div className="flex items-center gap-2 text-xs text-ink-soft bg-background border border-line rounded-xl p-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          {run?.status === "pending"
            ? "En cola — empezará en breve."
            : "Analizando en segundo plano: importando keywords, comprobando posiciones y analizando competidores…"}
        </div>
      )}

      {!running && loadingEstimate ? (
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando…
        </div>
      ) : !running && estimate ? (
        estimate.missingDomain ? (
          <p className="text-xs text-accent-ink bg-accent-tint border border-brand-100 rounded-lg p-2.5">
            El proyecto no tiene dominio configurado. Añádelo arriba y guarda antes de lanzar el
            análisis.
          </p>
        ) : nothingToDo ? (
          <p className="text-xs text-accent-ink bg-accent-tint border border-brand-100 rounded-lg p-2.5">
            Todo al día: no hay keywords pendientes de importar ni competidores sin analizar.
          </p>
        ) : (
          <div className="text-xs text-ink-soft bg-background border border-line rounded-xl p-2.5 space-y-0.5">
            <div>
              <strong className="text-ink">{estimate.keywordsToCheck}</strong> keyword
              {estimate.keywordsToCheck === 1 ? "" : "s"} a importar y chequear
            </div>
            <div>
              <strong className="text-ink">{estimate.competitorsToAnalyze}</strong> competidor
              {estimate.competitorsToAnalyze === 1 ? "" : "es"} a analizar (visibilidad + content gap)
            </div>
            <div className="text-ink-soft pt-0.5">
              Coste estimado: <strong className="text-ink-soft">{fmtCredits(estimate.estimatedCostUsd)}</strong>
            </div>
          </div>
        )
      ) : null}

      {error && <p className="text-xs text-alert-ink bg-alert-tint rounded-lg p-2.5">{error}</p>}

      {run?.status === "failed" && (
        <div className="text-xs text-alert-ink bg-alert-tint border border-alert-tint rounded-lg p-2.5 flex items-start gap-1.5">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{run.errorMessage ?? "El análisis ha fallado."}</span>
        </div>
      )}

      {result && (
        <div className="text-xs space-y-1.5 bg-surface border border-line rounded-xl p-3">
          <div className="flex items-center gap-2 font-medium text-ink">
            {result.errors.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-accent-ink" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-accent-ink" />
            )}
            {result.errors.length === 0 ? "Análisis completado" : "Completado con avisos"}
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-ink-soft">
            <li>Keywords importadas: <strong className="text-ink">{result.keywordsImported}</strong></li>
            <li>Keywords reemplazadas: <strong className="text-ink">{result.keywordsReplaced ?? 0}</strong></li>
            <li>Posiciones comprobadas: <strong className="text-ink">{result.keywordsChecked}</strong></li>
            <li>TF-IDF generados: <strong className="text-ink">{result.tfidfGenerated}</strong></li>
            <li>Competidores analizados: <strong className="text-ink">{result.competitorsAnalyzed}</strong></li>
            <li>Content gaps: <strong className="text-ink">{result.contentGapsCalculated}</strong></li>
            <li>Errores: <strong className="text-ink">{result.errors.length}</strong></li>
          </ul>
          {result.errors.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-alert-ink">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i} className="flex items-start gap-1">
                  <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    <strong>{e.step}</strong> · {e.ref}: {e.message}
                  </span>
                </li>
              ))}
              {result.errors.length > 5 && (
                <li className="text-ink-faint">…y {result.errors.length - 5} más</li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setConfirming(true)}
          disabled={
            running ||
            loadingEstimate ||
            launching ||
            !!estimate?.missingDomain ||
            (!!estimate && nothingToDo && result === null)
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-full hover:bg-brand-strong disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Poner en marcha
        </button>
      </div>

      {confirming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-surface-muted flex items-center justify-center shrink-0">
                <Rocket className="h-5 w-5 text-ink-soft" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-ink">Poner en marcha el proyecto</h3>
                <p className="text-sm text-ink-soft mt-1">
                  Se procesarán{" "}
                  <strong className="text-ink">{estimate?.keywordsToCheck ?? 0}</strong> keywords
                  (rank tracking + TF-IDF) y{" "}
                  <strong className="text-ink">{estimate?.competitorsToAnalyze ?? 0}</strong>{" "}
                  competidores (visibilidad + content gap).
                </p>
                <p className="text-xs text-ink-soft mt-1.5">
                  Coste estimado:{" "}
                  <strong className="text-ink-soft">{fmtCredits(estimate?.estimatedCostUsd ?? 0)}</strong>. Se
                  ejecuta en segundo plano — puedes cerrar o navegar a otra sección mientras dura. Si
                  se alcanza el tope de gasto, se detendrá y lo procesado quedará guardado.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirming(false)}
                disabled={launching}
                className="flex-1 px-4 py-2 text-sm text-ink-soft border border-line rounded-xl hover:bg-background disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={launch}
                disabled={launching}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand rounded-full hover:bg-brand-strong disabled:opacity-50"
              >
                {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Poner en marcha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
