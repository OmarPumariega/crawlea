"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import UrlLink from "@/components/app/UrlLink";
import PageHeader from "@/components/app/PageHeader";
import Pill, { type PillTone } from "@/components/app/Pill";
import SchemaTypePicker from "@/components/app/SchemaTypePicker";
import {
  getCatalogEntry,
  type PropLevel,
  type SchemaProp,
} from "@/lib/seo/schema/catalog";

type Generation = {
  id: string;
  url: string;
  suggestedType: string;
  selectedType: string;
  jsonLd: Record<string, unknown>;
  valid: boolean;
  validationErrors: string[] | null;
  createdAt: string;
};

const LEVEL_META: Record<PropLevel, { label: string; tone: PillTone }> = {
  required: { label: "Obligatorio", tone: "danger" },
  recommended: { label: "Recomendado", tone: "warning" },
  optional: { label: "Opcional", tone: "neutral" },
};

function typeLabel(type: string): string {
  return getCatalogEntry(type)?.label ?? type;
}

export default function SchemaView({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [suggestedType, setSuggestedType] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("Article");
  const [current, setCurrent] = useState<Generation | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Generation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/schema`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
        setLoadingHistory(false);
      });
  }, [projectId]);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCurrent(null);
    setSuggestedType(null);
    setAnalyzing(true);

    try {
      const res = await fetch(`/api/proyectos/${projectId}/schema/sugerencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al analizar la URL");
        return;
      }

      setSuggestedType(data.suggestedType);
      setSelectedType(data.suggestedType);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    setError("");
    setGenerating(true);

    try {
      const res = await fetch(`/api/proyectos/${projectId}/schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: selectedType }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al generar el schema");
        return;
      }

      setCurrent(data);
      setHistory((prev) => [data, ...prev]);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  function copyJsonLd() {
    if (!current) return;
    navigator.clipboard.writeText(JSON.stringify(current.jsonLd, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const selectedEntry = getCatalogEntry(selectedType);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Módulo · Schema"
        title="Generador de Schema"
        description="Analiza una URL, elige el tipo de datos estructurados (basado en schema.org) y genera el JSON-LD."
      />

      <form onSubmit={handleAnalyze} className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-ink-soft">URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setSuggestedType(null);
              setCurrent(null);
            }}
            placeholder="https://www.ejemplo.com/pagina"
            required
            className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={analyzing}
          className="flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong disabled:opacity-50 transition-colors"
        >
          {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}
          Analizar
        </button>

        {suggestedType && (
          <div className="border-t border-line pt-4 space-y-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-soft">
                Tipo de schema{" "}
                <span className="text-ink-faint font-normal">
                  (sugerido: {typeLabel(suggestedType)})
                </span>
              </label>
              <SchemaTypePicker value={selectedType} onChange={setSelectedType} />
            </div>

            {selectedEntry && (
              <div className="rounded-xl border border-line p-4 space-y-2 bg-background/60">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-ink-soft leading-snug flex-1">{selectedEntry.description}</p>
                  <a
                    href={selectedEntry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-ink-faint hover:text-ink inline-flex items-center gap-1 shrink-0"
                  >
                    schema.org <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <PropList props={selectedEntry.properties} />
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-brand text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-brand-strong disabled:opacity-50 transition-colors"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              Generar JSON-LD
            </button>
          </div>
        )}

        {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-xl">{error}</p>}
      </form>

      {current && (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-3">
          <Pill tone={current.valid ? "success" : "danger"}>
            {current.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {current.valid ? "Válido" : "Con avisos de validación"}
          </Pill>
          {!current.valid && current.validationErrors && (
            <ul className="text-sm text-alert-ink list-disc list-inside">
              {current.validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-faint">JSON-LD</span>
            <button onClick={copyJsonLd} className="text-ink-faint hover:text-ink" aria-label="Copiar JSON-LD">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <pre className="bg-background text-ink border border-line/90 rounded-xl p-4 font-mono text-xs overflow-x-auto">
            {JSON.stringify(current.jsonLd, null, 2)}
          </pre>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold tracking-tight text-ink mb-3">Historial del proyecto</h3>
        {loadingHistory ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
        ) : history.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no se ha generado nada para este proyecto.</p>
        ) : (
          <div className="space-y-2">
            {history.map((gen) => (
              <div
                key={gen.id}
                role="button"
                tabIndex={0}
                onClick={() => setCurrent(gen)}
                onKeyDown={(e) => e.key === "Enter" && setCurrent(gen)}
                className={cn(
                  "w-full text-left bg-surface rounded-xl border p-3 hover:bg-background transition-colors cursor-pointer shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)]",
                  current?.id === gen.id ? "border-brand ring-2 ring-brand/15" : "border-line"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <UrlLink url={gen.url} className="text-sm" />
                  <span className="text-xs text-ink-faint shrink-0">{typeLabel(gen.selectedType)}</span>
                </div>
                <p className="text-xs text-ink-faint mt-0.5">{new Date(gen.createdAt).toLocaleString("es-ES")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PropList({ props: list }: { props: SchemaProp[] }) {
  return (
    <div className="space-y-1">
      {list.map((p) => (
        <PropRow key={p.name} prop={p} />
      ))}
    </div>
  );
}

function PropRow({ prop }: { prop: SchemaProp }) {
  const meta = LEVEL_META[prop.level];
  return (
    <div>
      <div className="flex items-center gap-2">
        <code className="text-xs text-ink">{prop.name}</code>
        <Pill tone={meta.tone} className="px-1.5 py-0 text-[10px]">{meta.label}</Pill>
        {prop.multiple && <span className="text-[10px] text-ink-faint">lista</span>}
      </div>
      <p className="text-xs text-ink-faint leading-snug pl-0.5">{prop.desc}</p>
      {prop.nested && prop.nested.length > 0 && (
        <div className="pl-3 border-l border-line mt-1 space-y-1">
          <PropList props={prop.nested} />
        </div>
      )}
    </div>
  );
}
