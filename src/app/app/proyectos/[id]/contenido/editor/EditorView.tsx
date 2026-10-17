"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/app/PageHeader";
import Section from "@/components/ui/Section";
import { RadialGauge } from "@/components/ui/charts";
import { scoreText } from "@/lib/tfidf/editor-score";

type Stored = {
  id: string;
  keyword: string;
  result: {
    terms: { term: string; tfidf: number }[];
    topics: { text: string; coverage: number }[];
    pageWordCounts?: number[];
  };
};

const STATUS: Record<string, string> = { corto: "Te falta texto", bien: "Longitud adecuada", largo: "Te has pasado", "sin-dato": "" };

export default function EditorView({ projectId }: { projectId: string }) {
  const [stored, setStored] = useState<Stored[] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/tfidf`)
      .then((r) => r.json())
      .then((d: Stored[]) => {
        const list = Array.isArray(d) ? d : [];
        setStored(list);
        if (list[0]) setKeyword(list[0].keyword);
      })
      .catch(() => setStored([]));
  }, [projectId]);

  const current = stored?.find((s) => s.keyword === keyword) ?? null;
  const score = useMemo(() => (current ? scoreText(text, current.result) : null), [current, text]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contenido · Editor"
        title="Editor con puntuación"
        description="Escribe o pega tu texto y comprueba en vivo cuánto se parece, en términos, longitud y apartados, a lo que ya posiciona en Google para esa keyword."
        actions={
          stored && stored.length > 0 ? (
            <select value={keyword} onChange={(e) => setKeyword(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
              {stored.map((s) => (
                <option key={s.id} value={s.keyword}>{s.keyword}</option>
              ))}
            </select>
          ) : undefined
        }
      />
      {stored === null ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-ink-faint" /></div>
      ) : stored.length === 0 ? (
        <Section>
          <p className="text-sm text-ink-soft">
            Para puntuar un texto hace falta antes analizar la keyword en{" "}
            <Link href={`/app/proyectos/${projectId}/contenido/tfidf`} className="font-medium text-ink underline">TF-IDF</Link>: de ahí salen los términos y la longitud del top-10.
          </p>
        </Section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Section>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Escribe o pega aquí tu texto sobre «${keyword}»…`}
              className="min-h-[460px] w-full resize-y rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </Section>
          {score && (
            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <Section>
                <div className="flex items-center gap-5">
                  <RadialGauge value={score.score} size={96} label="puntuación" />
                  <dl className="space-y-1.5 text-sm">
                    <div><dt className="text-xs text-ink-faint">Palabras</dt><dd className="font-bold tabular-nums text-ink">{score.words}</dd></div>
                    <div>
                      <dt className="text-xs text-ink-faint">Objetivo</dt>
                      <dd className={cn("font-bold", score.length.status === "bien" ? "text-accent-ink" : "text-ink")}>
                        {score.length.low && score.length.high ? `${score.length.low}–${score.length.high}` : "—"}
                        {STATUS[score.length.status] && <span className="ml-1.5 text-xs font-medium text-ink-faint">{STATUS[score.length.status]}</span>}
                      </dd>
                    </div>
                  </dl>
                </div>
                <p className="mt-3 text-xs text-ink-faint">Orientativa: mide parecido con las páginas que posicionan, no garantiza posición.</p>
              </Section>

              <Section title={`Términos (${score.usedTerms.length}/${score.usedTerms.length + score.missingTerms.length})`}>
                {score.missingTerms.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-semibold text-ink-soft">Te faltan</p>
                    <div className="flex flex-wrap gap-1">
                      {score.missingTerms.map((t) => <span key={t} className="rounded-full bg-alert-tint px-2 py-0.5 text-xs text-alert-ink">{t}</span>)}
                    </div>
                  </div>
                )}
                {score.usedTerms.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-semibold text-ink-soft">Ya los usas</p>
                    <div className="flex flex-wrap gap-1">
                      {score.usedTerms.map((t) => <span key={t} className="rounded-full bg-accent-tint px-2 py-0.5 text-xs text-accent-ink">{t}</span>)}
                    </div>
                  </div>
                )}
                {score.overusedTerms.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-ink-soft">Demasiado repetidos</p>
                    <div className="flex flex-wrap gap-1">
                      {score.overusedTerms.map((t) => <span key={t.term} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-soft">{t.term} · {(t.density * 100).toFixed(1).replace(".", ",")} %</span>)}
                    </div>
                  </div>
                )}
              </Section>

              {score.topicsTotal > 0 && (
                <Section title={`Apartados (${score.topicsCovered}/${score.topicsTotal})`} description="Los H2/H3 que casi todos los resultados cubren.">
                  {score.missingTopics.length === 0 ? (
                    <p className="text-xs text-accent-ink">Los cubres todos.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-ink-soft">
                      {score.missingTopics.map((t) => <li key={t}>· {t}</li>)}
                    </ul>
                  )}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
