"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Globe, Loader2, Lock } from "lucide-react";
import { Pill } from "@/components/marketing/mockups";
import { track } from "@/lib/analytics/track";

type Summary = { domain: string; issuesCount: number; passedCount: number; bySeverity: { alto: number; medio: number; bajo: number } };

const STEPS = [
  "Abriendo tu web",
  "Leyendo título y descripción",
  "Revisando los encabezados",
  "Comprobando robots.txt y sitemap",
  "Contando los problemas",
];
const MIN_MS = 5200; // el análisis real suele tardar menos; así se ve avanzar cada paso

type Phase = "idle" | "analyzing" | "result";

// Analizador del hero: escribes tu web → revisión rápida REAL de la página
// principal → recuento real de problemas y comprobaciones superadas. El
// detalle queda bloqueado (borroso) y se ve dentro de la herramienta: el
// botón lleva a crear la cuenta con Google y, al entrar, directo a crear el
// proyecto con ese dominio. No se pide email ni se enseña ninguna cifra que
// no salga de las comprobaciones.
export default function HeroAnalyzer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!url.trim()) { setError("Escribe la dirección de tu web."); return; }
    track("analyzer_start");
    setPhase("analyzing");
    setProgress(0);
    const started = Date.now();
    // La barra avanza sola hasta el 92 %; el 100 % llega con el resultado real.
    timer.current = setInterval(() => {
      setProgress(Math.min(92, Math.round(((Date.now() - started) / MIN_MS) * 92)));
    }, 80);

    const req = fetch("/api/analizar-web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => null) }))
      .catch(() => ({ ok: false, body: null }));
    const [res] = await Promise.all([req, new Promise((r) => setTimeout(r, MIN_MS))]);

    if (timer.current) clearInterval(timer.current);
    if (!res.ok || typeof res.body?.issuesCount !== "number") {
      setError(res.body?.error ?? "No hemos podido analizar esa web. Inténtalo de nuevo en unos minutos.");
      track("analyzer_error", { reason: res.body?.error ? "rejected" : "failed" });
      setPhase("idle");
      return;
    }
    setProgress(100);
    track("analyzer_result", {
      issues_count: res.body.issuesCount,
      passed_count: res.body.passedCount,
      severe_count: res.body.bySeverity?.alto ?? 0,
    });
    setSummary(res.body as Summary);
    setPhase("result");
  }

  const stepIndex = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length));

  if (phase === "idle") {
    return (
      <div className="mx-auto mt-9 w-full max-w-2xl">
        <form onSubmit={analyze} className="flex flex-col gap-2 rounded-[28px] border border-white/15 bg-white/10 p-2 backdrop-blur sm:flex-row sm:items-center sm:rounded-full" noValidate>
          <label htmlFor="hero-url" className="sr-only">Dirección de tu web</label>
          <div className="flex flex-1 items-center gap-3 px-4">
            <Globe className="h-5 w-5 shrink-0 text-white/50" aria-hidden="true" />
            <input
              id="hero-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Escribe la dirección de tu web, p. ej. ejemplo.es"
              inputMode="url" autoComplete="url" spellCheck={false}
              className="w-full bg-transparent py-3 text-base text-white placeholder:text-white/45 focus:outline-none"
            />
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50">
            Analizar <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-alert-bright">{error}</p>}
        <p className="mt-4 text-sm text-white/50">Revisión rápida y gratuita de tu página principal.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-9 w-full max-w-2xl text-left" aria-live="polite">
      <div className="rounded-[24px] border border-line bg-surface p-6 text-ink shadow-[0_40px_90px_-30px_rgba(10,12,50,0.8)] sm:p-8">
        {phase === "analyzing" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="min-w-0 truncate text-sm font-bold">Analizando {url.replace(/^https?:\/\//i, "")}</p>
              <p className="text-sm font-bold tabular-nums text-brand">{progress} %</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-chart-track"><div className="h-full rounded-full bg-brand transition-[width] duration-150" style={{ width: `${progress}%` }} /></div>
            <ul className="mt-6 space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={s} className={"flex items-center gap-3 text-sm " + (i <= stepIndex ? "text-ink" : "text-ink-faint")}>
                  {i < stepIndex ? <Check className="h-4 w-4 text-brand" aria-hidden="true" /> : i === stepIndex ? <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" /> : <span className="h-4 w-4 rounded-full border border-line" aria-hidden="true" />}
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}

        {phase === "result" && summary && (
          <>
            <p className="text-xs font-semibold text-ink-faint">{summary.domain}</p>
            <p className="mt-1 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">
              {summary.issuesCount === 0
                ? "No hemos encontrado problemas"
                : `${summary.issuesCount} ${summary.issuesCount === 1 ? "problema" : "problemas"} en tu web`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.bySeverity.alto > 0 && <Pill tone="down">{summary.bySeverity.alto} {summary.bySeverity.alto === 1 ? "grave" : "graves"}</Pill>}
              {summary.bySeverity.medio > 0 && <Pill tone="neutral">{summary.bySeverity.medio} {summary.bySeverity.medio === 1 ? "medio" : "medios"}</Pill>}
              {summary.bySeverity.bajo > 0 && <Pill tone="neutral">{summary.bySeverity.bajo} {summary.bySeverity.bajo === 1 ? "leve" : "leves"}</Pill>}
              <Pill tone="up">{summary.passedCount} {summary.passedCount === 1 ? "comprobación superada" : "comprobaciones superadas"}</Pill>
            </div>

            {summary.issuesCount > 0 && (
              <div className="relative mt-6 space-y-2" aria-hidden="true">
                {Array.from({ length: Math.min(3, summary.issuesCount) }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted px-4 py-3 blur-[3px]">
                    <span className="h-2 w-2 rounded-full bg-brand-200" /><span className="h-2.5 rounded-full bg-line" style={{ width: `${62 - i * 12}%` }} />
                  </div>
                ))}
                <div className="absolute inset-0 flex items-center justify-center"><span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-bold shadow-md ring-1 ring-line"><Lock className="h-3.5 w-3.5 text-brand" />Detalle bloqueado</span></div>
              </div>
            )}

            <div className="mt-6 rounded-2xl bg-accent-tint p-5">
              <p className="font-bold">{summary.issuesCount > 0 ? "Crea tu cuenta para ver qué corregir" : "Crea tu cuenta para rastrear toda tu web"}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Entras con Google en un clic, sin tarjeta. Esto es solo tu página principal: dentro rastreamos la web entera y te decimos qué hacer en cada caso.</p>
              <div className="mt-4">
                <Link href={`/registro?web=${encodeURIComponent(summary.domain)}`} data-track="analyzer_signup_click" data-track-issues_count={String(summary.issuesCount)} className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-strong">
                  Crea tu cuenta gratis <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
