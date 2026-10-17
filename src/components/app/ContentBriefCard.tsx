"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Download, FileText } from "lucide-react";
import Section from "@/components/ui/Section";

// Brief de contenido armado SIN coste y SIN IA: junta lo que ya tenemos del
// SERP pagado (top-10, H2/H3 repetidos, términos TF-IDF, preguntas de la gente)
// en un documento listo para pasar a quien redacta. Cada dato viene del top-10
// real; si no hay dato (p. ej. resultados guardados antes de medir palabras),
// la línea se omite en vez de inventarla.
export type BriefInput = {
  keyword: string;
  terms: { term: string }[];
  topics: { text: string; coverage: number }[];
  headingTerms?: { term: string }[];
  peopleAlsoAsk?: { question: string }[] | null;
  relatedSearches?: string[] | null;
  featuredSnippet?: { title: string | null; description: string | null } | null;
  competitors?: { title: string; position: number | null }[];
  pageWordCounts?: number[];
  sources: string[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function buildBriefMarkdown(r: BriefInput): string {
  const words = r.pageWordCounts && r.pageWordCounts.length > 0 ? r.pageWordCounts : null;
  const med = words ? median(words) : null;
  const repeated = r.topics.filter((t) => t.coverage >= 2).slice(0, 12);
  const optional = r.topics.filter((t) => t.coverage < 2).slice(0, 6);
  const lines: string[] = [];
  lines.push(`# Brief de contenido: ${r.keyword}`);
  lines.push("");
  lines.push(`Basado en el top-10 real de Google (${r.sources.length} páginas analizadas).`);
  if (med && words) {
    lines.push("");
    lines.push(`## Longitud orientativa`);
    lines.push(`Las páginas que posicionan tienen entre ${Math.min(...words)} y ${Math.max(...words)} palabras (mediana ${med}). Apunta a ${Math.round(med * 0.9)}–${Math.round(med * 1.2)} palabras, sin rellenar.`);
  }
  if (repeated.length > 0) {
    lines.push("");
    lines.push("## Apartados que casi todos cubren (H2/H3)");
    for (const t of repeated) lines.push(`- ${t.text} (${t.coverage} de ${r.sources.length} páginas)`);
  }
  if (r.peopleAlsoAsk && r.peopleAlsoAsk.length > 0) {
    lines.push("");
    lines.push("## Preguntas que Google muestra a la gente");
    for (const q of r.peopleAlsoAsk) lines.push(`- ${q.question}`);
  }
  if (r.terms.length > 0) {
    lines.push("");
    lines.push("## Términos que conviene usar");
    lines.push(r.terms.slice(0, 15).map((t) => t.term).join(", "));
  }
  if (r.relatedSearches && r.relatedSearches.length > 0) {
    lines.push("");
    lines.push("## Búsquedas relacionadas");
    lines.push(r.relatedSearches.slice(0, 8).join(", "));
  }
  if (optional.length > 0) {
    lines.push("");
    lines.push("## Ideas para diferenciarte (las cubren pocos)");
    for (const t of optional) lines.push(`- ${t.text}`);
  }
  if (r.featuredSnippet?.description) {
    lines.push("");
    lines.push("## Respuesta destacada actual");
    lines.push(`${r.featuredSnippet.title ?? ""}: ${r.featuredSnippet.description}`);
  }
  return lines.join("\n");
}

export default function ContentBriefCard({ result }: { result: BriefInput }) {
  const md = useMemo(() => buildBriefMarkdown(result), [result]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles bloqueado: la descarga sigue disponible */
    }
  }
  function download() {
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `brief-${result.keyword.replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Section
      title={
        <span className="inline-flex items-center gap-2">
          <FileText className="h-4 w-4 text-ink-faint" /> Brief de contenido
        </span>
      }
      description="Para pasar a quien redacta: longitud, apartados, preguntas y términos del top-10. Sin coste."
      actions={
        <>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted">
            {copied ? <Check className="h-3.5 w-3.5 text-accent-ink" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button onClick={download} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted">
            <Download className="h-3.5 w-3.5" /> .md
          </button>
        </>
      }
    >
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-4 font-sans text-xs leading-relaxed text-ink-soft">{md}</pre>
    </Section>
  );
}
