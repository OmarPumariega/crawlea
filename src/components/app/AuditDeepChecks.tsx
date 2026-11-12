"use client";

import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Copy, Check, Download, MinusCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Section from "@/components/ui/Section";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  checksToMarkdown,
  type CheckStatus,
  type DeepCheck,
  type DeepResult,
} from "@/lib/audit/deep/types";

// Misma gramática visual que AuditIssuesList (filas con borde, caja «Cómo
// arreglarlo» en accent-tint) y que las barras del Resumen — solo cambia el
// contenido: cada comprobación dice qué se ha medido y cómo arreglarlo.
const STATUS: Record<CheckStatus, { label: string; chip: string; icon: typeof AlertCircle }> = {
  fail: { label: "Fallo", chip: "bg-alert-tint text-alert-ink", icon: AlertCircle },
  improve: { label: "Mejorable", chip: "bg-accent-tint text-accent-ink", icon: AlertTriangle },
  ok: { label: "Correcto", chip: "bg-brand-100 text-brand-700", icon: CheckCircle2 },
  na: { label: "No evaluable", chip: "bg-surface-muted text-ink-soft", icon: MinusCircle },
};

type Filter = "todos" | CheckStatus;

function CheckRow({ check }: { check: DeepCheck }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[check.status];
  const Icon = st.icon;
  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background">
        <span className={cn("flex items-center justify-center h-6 w-6 rounded-full shrink-0", st.chip)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-medium text-ink flex-1">{check.title}</span>
        <span className={cn("text-[11px] px-2 py-0.5 rounded-full shrink-0", st.chip)}>{st.label}</span>
        {open ? <ChevronUp className="h-4 w-4 text-ink-faint shrink-0" /> : <ChevronDown className="h-4 w-4 text-ink-faint shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
          <p className="text-sm text-ink-soft">{check.summary}</p>
          {check.fix && (
            <div className="bg-accent-tint text-accent-ink text-sm px-3 py-2 rounded-lg">
              <span className="font-medium">Cómo arreglarlo: </span>
              {check.fix}
            </div>
          )}
          {check.advisory && check.status !== "ok" && (
            <p className="text-xs text-ink-faint italic">Señal informativa — puede ser intencional, revisar caso a caso. No genera tarea automática.</p>
          )}
          {check.evidence && check.evidence.length > 0 && (
            <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
              {check.evidence.map((e, i) => (
                <div key={i} className="contents">
                  <dt className="font-medium text-ink-faint">{e.label}</dt>
                  <dd className="text-ink-soft break-all">{e.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {check.sources.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {check.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
                  {s.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditDeepChecks({ result, title = "Auditoría profunda de la página de inicio" }: { result: DeepResult; title?: string }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [copied, setCopied] = useState(false);

  const counts = useMemo(
    () => ({
      fail: result.checks.filter((c) => c.status === "fail").length,
      improve: result.checks.filter((c) => c.status === "improve").length,
      ok: result.checks.filter((c) => c.status === "ok").length,
      na: result.checks.filter((c) => c.status === "na").length,
    }),
    [result]
  );

  const markdown = () => checksToMarkdown(result);
  const download = () => {
    const blob = new Blob([markdown()], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria-profunda-${new URL(result.url).hostname}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = () =>
    navigator.clipboard.writeText(markdown()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "todos", label: `Todos (${result.checks.length})` },
    { key: "fail", label: `Fallos (${counts.fail})` },
    { key: "improve", label: `Mejorables (${counts.improve})` },
    { key: "ok", label: `Correctos (${counts.ok})` },
    { key: "na", label: `No evaluables (${counts.na})` },
  ];

  return (
    <div className="space-y-6">
      <Section
        title={title}
        description={`${result.url} · cada comprobación indica qué se ha medido, cómo arreglarlo y la documentación oficial. Los datos son medidos, nunca estimados; lo que no aplica o no se pudo medir aparece como «No evaluable».`}
        actions={
          <>
            <button type="button" onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border border-line text-ink-soft hover:text-ink hover:bg-background">
              {copied ? <Check className="h-4 w-4 text-accent-ink" /> : <Copy className="h-4 w-4" />}
              Copiar para IA
            </button>
            <button type="button" onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border border-line text-ink-soft hover:text-ink hover:bg-background">
              <Download className="h-4 w-4" />
              Descargar .md
            </button>
          </>
        }
      >
        <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
          {CATEGORY_ORDER.map((key) => {
            const cat = result.categoryScores[key];
            const pct = cat?.score ?? null;
            return (
              <li key={key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{CATEGORY_META[key].label}</span>
                  <span className="tabular-nums text-ink-soft">
                    {pct != null ? <strong className="text-ink">{pct}</strong> : "sin datos"}
                    {pct != null && " / 100"}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50">
                  <div className={cn("h-full rounded-full", pct == null ? "" : pct >= 80 ? "bg-brand-500" : pct >= 50 ? "bg-brand-300" : "bg-alert")} style={{ width: `${pct ?? 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="inline-flex flex-wrap items-center gap-1 bg-black/[0.05] rounded-xl p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn("px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors", filter === f.key ? "bg-surface text-ink shadow-[0_1px_3px_rgba(17,20,43,0.12)]" : "text-ink-soft hover:text-ink")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = result.checks.filter((c) => c.category === cat && (filter === "todos" || c.status === filter));
        if (list.length === 0) return null;
        const order: Record<CheckStatus, number> = { fail: 0, improve: 1, ok: 2, na: 3 };
        const sorted = [...list].sort((a, b) => order[a.status] - order[b.status]);
        const cs = result.categoryScores[cat];
        return (
          <div key={cat} className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">
              {CATEGORY_META[cat].label}
              {cs?.score != null && <span className="ml-2 font-normal text-ink-faint tabular-nums">{cs.score}/100</span>}
            </h3>
            <div className="space-y-2">
              {sorted.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
