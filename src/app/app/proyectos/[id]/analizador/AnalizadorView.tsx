"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Info, Loader2, Trash2, XCircle } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import HistoryDropdown from "@/components/app/HistoryDropdown";
import Pill from "@/components/app/Pill";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";
import { RadialGauge } from "@/components/ui/charts";
import { cn } from "@/lib/utils";
import type { AnalysisResult, Check, CheckStatus } from "@/lib/url-analyzer/analyze";

type HistoryItem = { id: string; url: string; keyword: string | null; score: number; createdAt: string };
type Shown = { id: string; createdAt: string; result: AnalysisResult; keywordAuto?: boolean; previous?: { score: number; createdAt: string } | null };

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-brand" />,
  warn: <AlertTriangle className="h-4 w-4 text-accent-ink" />,
  fail: <XCircle className="h-4 w-4 text-alert-ink" />,
  info: <Info className="h-4 w-4 text-ink-faint" />,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function CheckRow({ c }: { c: Check }) {
  return (
    <li className="flex gap-2.5 py-2">
      <span className="mt-0.5 shrink-0">{STATUS_ICON[c.status]}</span>
      <div className="min-w-0 text-sm">
        <p className={cn("font-medium", c.status === "ok" ? "text-ink-soft" : "text-ink")}>{c.title}</p>
        <p className="text-xs text-ink-soft">{c.detail}</p>
        {c.status !== "ok" && c.fix && (
          <p className="mt-1 flex items-start gap-1.5 text-xs text-ink">
            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-brand" />
            <span>{c.fix}</span>
          </p>
        )}
      </div>
    </li>
  );
}

export default function AnalizadorView({ projectId }: { projectId: string }) {
  const [domain, setDomain] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/proyectos/${projectId}/analizador`);
    const body = await res.json().catch(() => null);
    if (res.ok && body) {
      setDomain(body.domain ?? null);
      setHistory(body.history ?? []);
    }
  }, [projectId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function analyze(targetUrl: string, kw: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${projectId}/analizador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, keyword: kw }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo analizar");
      setShown(body as Shown);
      if (body.keywordAuto && body.result?.keyword) setKeyword(body.result.keyword);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar");
    } finally {
      setBusy(false);
    }
  }

  async function open(h: HistoryItem) {
    setError(null);
    const res = await fetch(`/api/proyectos/${projectId}/analizador/${h.id}`);
    const body = await res.json();
    if (res.ok) {
      setShown({ id: body.id, createdAt: body.createdAt, result: body.result });
      setUrl(h.url);
      setKeyword(h.keyword ?? "");
    }
  }

  async function remove(h: HistoryItem) {
    await fetch(`/api/proyectos/${projectId}/analizador/${h.id}`, { method: "DELETE" });
    if (shown?.id === h.id) setShown(null);
    await loadHistory();
  }

  const r = shown?.result ?? null;
  const priorities = useMemo(() => {
    if (!r) return [];
    const rank = (c: Check) => (c.status === "fail" ? 0 : 1) * 10 - c.weight;
    return r.checks.filter((c) => c.status === "fail" || c.status === "warn").sort((a, b) => rank(a) - rank(b)).slice(0, 6);
  }, [r]);
  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, fail: 0 };
    for (const k of r?.checks ?? []) if (k.status !== "info") c[k.status as "ok" | "warn" | "fail"]++;
    return c;
  }, [r]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="On-Page · Analizador de URL"
        title="Analizador de URL"
        description="Pega cualquier página, tuya o de la competencia, y te decimos qué está bien, qué falta y cómo arreglarlo: título, encabezados, palabra clave, contenido, imágenes, datos estructurados y más."
      />

      <Section>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) void analyze(url, keyword);
          }}
        >
          <label className="min-w-[260px] flex-[2]">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">URL a analizar</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tuweb.com/servicio"
              className="w-full rounded-full border border-line bg-background px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">Palabra clave objetivo (opcional)</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="auditoría de cuentas oviedo"
              maxLength={120}
              className="w-full rounded-full border border-line bg-background px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong transition-colors disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Analizar
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          {domain && (
            <button type="button" onClick={() => setUrl(domain.startsWith("http") ? domain : `https://${domain}`)} className="rounded-full border border-line px-3 py-1 text-ink-soft hover:bg-background">
              Usar la home de {domain}
            </button>
          )}
          <span>Sin coste: se descarga la página y se analiza al momento. Si no escribes keyword y la URL ya posiciona en Rank Tracking, usamos la tuya.</span>
        </div>
        {error && <p className="mt-3"><Pill tone="danger">{error}</Pill></p>}
      </Section>

      <HistoryDropdown count={history.length}>
        {(close) =>
          history.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-soft">Aún no has analizado ninguna URL.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 py-2">
                  <button type="button" onClick={() => { void open(h); close(); }} className="min-w-0 flex-1 text-left">
                    <p className={cn("truncate text-sm", shown?.id === h.id ? "font-semibold text-brand" : "text-ink")}>{h.url.replace(/^https?:\/\//, "")}</p>
                    <p className="text-xs text-ink-faint">{fmtDate(h.createdAt)}{h.keyword ? ` · ${h.keyword}` : ""}</p>
                  </button>
                  <Pill tone={h.score >= 80 ? "brand" : "neutral"}>{h.score}</Pill>
                  <button type="button" title="Borrar" onClick={() => remove(h)} className="rounded-lg p-1.5 text-ink-soft hover:bg-background hover:text-alert-ink">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </HistoryDropdown>

      <div className="space-y-6">
        <div className="space-y-6">
          {!r ? (
            <Section>
              <p className="py-6 text-center text-sm text-ink-soft">
                {busy ? "Analizando la página…" : "Aquí aparecerá el análisis. Escribe una URL arriba o abre uno del historial."}
              </p>
            </Section>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <a href={r.finalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink hover:text-brand">
                  <span className="truncate">{r.finalUrl}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
                <span className="text-xs text-ink-faint">
                  Código {r.status} · {(r.loadMs / 1000).toFixed(1)} s · {r.facts.htmlKb} KB · analizada el {fmtDate(shown!.createdAt)}
                  {r.keyword && <> · keyword «{r.keyword}»{shown?.keywordAuto ? " (de Rank Tracking)" : ""}</>}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="flex items-center justify-between gap-4 rounded-[20px] bg-brand p-5 text-white shadow-[0_10px_30px_-12px_rgba(79,92,245,0.6)] md:col-span-2">
                  <div>
                    <p className="text-[13px] font-semibold text-white/75">Puntuación on-page</p>
                    <p className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.03em]">{r.score}<span className="text-lg font-bold text-white/60"> /100</span></p>
                    {shown?.previous && (
                      <p className="mt-2 text-xs text-white/75">
                        {r.score === shown.previous.score ? "Igual que" : r.score > shown.previous.score ? `+${r.score - shown.previous.score} puntos desde` : `${r.score - shown.previous.score} puntos desde`} el {fmtDate(shown.previous.createdAt)}
                      </p>
                    )}
                  </div>
                  <RadialGauge value={r.score} size={84} onBrand unit="" />
                </div>
                <StatTile label="A corregir" value={counts.fail + counts.warn} hint={`${counts.fail} errores · ${counts.warn} avisos · ${counts.ok} correctos`} />
                <StatTile label="Palabras" value={r.facts.wordCount.toLocaleString("es-ES")} hint={`${r.facts.imagesTotal} imágenes · ${r.facts.internalLinks} enlaces internos`} />
              </div>

              {priorities.length > 0 && (
                <Section title="Qué arreglar primero" description="Lo que más pesa en la puntuación, por orden.">
                  <ul className="divide-y divide-line">
                    {priorities.map((c) => (
                      <CheckRow key={c.id} c={c} />
                    ))}
                  </ul>
                </Section>
              )}

              <Section title="Así se vería en Google" description="Título y descripción tal como los lee Google (se cortan al llegar al límite).">
                <div className="max-w-xl rounded-xl border border-line bg-background p-4">
                  <p className="truncate text-xs text-ink-faint">{r.finalUrl}</p>
                  <p className="mt-1 text-lg leading-snug text-brand">{(r.facts.title ?? "Sin título").slice(0, 62)}{(r.facts.title?.length ?? 0) > 62 ? "…" : ""}</p>
                  <p className="mt-1 text-sm text-ink-soft">{(r.facts.metaDescription ?? "Sin meta descripción: Google elegirá un fragmento del texto.").slice(0, 158)}{(r.facts.metaDescription?.length ?? 0) > 158 ? "…" : ""}</p>
                </div>
              </Section>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
                {r.categories.map((cat) => (
                  <Section
                    key={cat.id}
                    title={cat.label}
                    actions={cat.score !== null ? <Pill tone={cat.score >= 80 ? "brand" : "neutral"}>{cat.score}/100</Pill> : undefined}
                  >
                    <ul className="-my-2 divide-y divide-line">
                      {r.checks.filter((c) => c.category === cat.id).map((c) => (
                        <CheckRow key={c.id} c={c} />
                      ))}
                    </ul>
                  </Section>
                ))}
              </div>

              <Section title="Estructura de encabezados" description="Cómo está organizado el contenido, en orden de aparición.">
                {r.facts.outline.length === 0 ? (
                  <p className="text-sm text-ink-soft">La página no tiene encabezados.</p>
                ) : (
                  <ul className="space-y-1">
                    {r.facts.outline.slice(0, 60).map((h, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-sm" style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
                        <span className="w-7 shrink-0 text-xs font-bold text-brand">H{h.level}</span>
                        <span className={cn("min-w-0 truncate", h.text ? "text-ink" : "text-ink-faint italic")}>{h.text || "(vacío)"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
