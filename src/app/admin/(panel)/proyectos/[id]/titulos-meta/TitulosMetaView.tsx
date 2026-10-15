"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import UrlLink from "@/components/admin/UrlLink";
import PageHeader from "@/components/admin/PageHeader";

type Variant = { title: string; description: string };

type Generation = {
  id: string;
  url: string;
  keyword: string | null;
  variants: Variant[];
  model: string;
  createdAt: string;
};

const TITLE_MAX = 65;
const DESC_MIN = 70;
const DESC_MAX = 155;

function charCountClass(count: number, max: number, min = 0) {
  if (count > max) return "text-red-600";
  if (count < min) return "text-amber-600";
  return "text-emerald-600";
}

function VariantCard({ variant, index }: { variant: Variant; index: number }) {
  const [copiedField, setCopiedField] = useState<"title" | "description" | null>(null);

  function copy(field: "title" | "description", text: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  // Color de la barra de longitud: verde dentro de rango, ámbar corta, rojo pasa.
  function lenBar(count: number, max: number, min = 0) {
    const color =
      count > max ? "bg-red-500" : count < min ? "bg-amber-400" : "bg-emerald-500";
    return { color, width: `${Math.min(100, (count / max) * 100)}%` };
  }

  return (
    <div className="bg-white rounded-2xl border border-line p-5 shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)] space-y-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
          Variante {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => copy("title", variant.title)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-900 hover:bg-background transition-colors"
            aria-label="Copiar título"
          >
            {copiedField === "title" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Título
          </button>
          <button
            onClick={() => copy("description", variant.description)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-900 hover:bg-background transition-colors"
            aria-label="Copiar descripción"
          >
            {copiedField === "description" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Meta
          </button>
        </div>
      </div>

      {/* Vista previa estilo SERP de Google: cómo se vería el resultado real */}
      <div className="rounded-xl bg-background border border-line/70 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-line text-[10px] font-bold text-gray-500">
            ◎
          </span>
          <span className="text-xs text-gray-500 truncate">ejemplo.com › pagina</span>
        </div>
        <p className="text-[18px] leading-snug text-[#1a0dab] line-clamp-2">{variant.title}</p>
        <p className="text-[13px] leading-relaxed text-gray-600 mt-1 line-clamp-2">{variant.description}</p>
      </div>

      {/* Barras de longitud: título y descripción contra sus límites SEO */}
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-medium text-gray-500">Título</span>
            <span className={cn("font-semibold tabular-nums", charCountClass(variant.title.length, TITLE_MAX))}>
              {variant.title.length}/{TITLE_MAX}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
            <div className={cn("h-full rounded-full", lenBar(variant.title.length, TITLE_MAX).color)} style={{ width: lenBar(variant.title.length, TITLE_MAX).width }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-medium text-gray-500">Descripción</span>
            <span className={cn("font-semibold tabular-nums", charCountClass(variant.description.length, DESC_MAX, DESC_MIN))}>
              {variant.description.length}/{DESC_MAX}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
            <div className={cn("h-full rounded-full", lenBar(variant.description.length, DESC_MAX, DESC_MIN).color)} style={{ width: lenBar(variant.description.length, DESC_MAX, DESC_MIN).width }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TitulosMetaView({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Generation | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/titulos-meta`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
        setLoadingHistory(false);
      });
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setCurrent(null);

    // Red de seguridad para una conexión colgada del todo (sin respuesta ni
    // cabeceras) — el caso normal de "el LLM tarda" ya lo corta antes el
    // timeout de 90s del backend (src/lib/seo/llm.ts) devolviendo un error
    // claro, así que este abort rara vez debería dispararse.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch(`/api/proyectos/${projectId}/titulos-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, keyword: keyword || undefined }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al generar los títulos y meta descripciones");
        return;
      }

      setCurrent(data);
      setHistory((prev) => [data, ...prev]);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "La conexión se ha quedado colgada más de 2 minutos sin respuesta. Inténtalo de nuevo."
          : "Error de conexión. Inténtalo de nuevo."
      );
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Módulo · Título y Meta"
        title="Título y Meta Descripción"
        description="Analiza una URL real del proyecto y genera 3 variantes de título y meta descripción siguiendo las reglas SEO de la agencia."
      />

      {/* Generador: URL + keyword + acción en una sola barra horizontal */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-line shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)] p-4 flex flex-col lg:flex-row gap-3 lg:items-end">
        <div className="flex-[2] space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-600">URL a analizar</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.ejemplo.com/pagina"
            required
            className="w-full border border-line rounded-full px-4 py-2.5 text-sm bg-background outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="block text-[13px] font-medium text-gray-600">
            Keyword <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Detección automática"
            className="w-full border border-line rounded-full px-4 py-2.5 text-sm bg-background outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 focus:bg-white transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-brand text-white text-sm font-semibold rounded-full px-6 py-2.5 hover:bg-brand-strong disabled:opacity-50 transition-colors shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generar
        </button>
      </form>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl">{error}</p>}

      {current && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {current.variants.map((variant, i) => (
            <VariantCard key={i} variant={variant} index={i} />
          ))}
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold tracking-tight text-gray-900 mb-3">Historial del proyecto</h3>
        {loadingHistory ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-gray-400">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm text-gray-500">Todavía no se ha generado nada para este proyecto.</p>
          </div>
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
                  "w-full text-left bg-white rounded-xl border p-3 hover:bg-background transition-colors cursor-pointer shadow-[0_1px_2px_rgba(26,29,26,0.05),0_4px_16px_-6px_rgba(26,29,26,0.10)]",
                  current?.id === gen.id ? "border-brand ring-2 ring-brand/15" : "border-line"
                )}
              >
                <UrlLink url={gen.url} className="text-sm" />
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(gen.createdAt).toLocaleString("es-ES")}
                  {gen.keyword ? ` · ${gen.keyword}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
