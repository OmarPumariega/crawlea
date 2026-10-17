"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Network, Link2, AlertTriangle, Download, ArrowRight } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import UrlLink from "@/components/app/UrlLink";
import PageHeader from "@/components/app/PageHeader";

type PageRow = {
  url: string;
  pagerank: number;
  incoming: number;
  outgoing: number;
  externalLinks: number;
  externalDomains: string[];
};

type LinkSuggestion = {
  target: { url: string; title: string | null; incoming: number; pagerank: number; keyword: string | null; position: number | null };
  reason: "opportunity" | "orphan" | "weak";
  anchor: string;
  sources: { url: string; title: string | null; pagerank: number; sharedTerms: string[]; related: boolean }[];
};

const REASON_LABEL: Record<LinkSuggestion["reason"], string> = {
  opportunity: "Oportunidad",
  orphan: "Huérfana",
  weak: "Poca fuerza",
};

type EnlacesData = {
  suggestions: LinkSuggestion[];
  pages: PageRow[];
  orphans: string[];
  topHubs: string[];
  topExternalDomains: { domain: string; pages: number }[];
  totalExternalLinks: number;
  auditDate: string;
};

export default function EnlacesView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<EnlacesData | null>(null);
  const [needsAudit, setNeedsAudit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/proyectos/${projectId}/enlaces`)
      .then((r) => r.json())
      .then((body) => {
        if (body && body.needsAudit) setNeedsAudit(true);
        else if (body && Array.isArray(body.pages)) setData(body);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" />
        Analizando el enlazado interno…
      </div>
    );
  }

  if (needsAudit) {
    return (
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-6 space-y-2">
        <div className="flex items-center gap-2 text-ink font-medium">
          <Network className="h-5 w-5 text-ink-faint" />
          Aún no hay grafo de enlaces
        </div>
        <p className="text-sm text-ink-soft">
          Ejecuta una auditoría para analizar el enlazado interno. El rastreo
          construye el grafo de enlaces sobre el que se calcula el PageRank y
          se detectan las páginas huérfanas.
        </p>
        <Link
          href={`/app/proyectos/${projectId}/auditoria`}
          className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-full hover:bg-brand-strong"
        >
          Ir a la pestaña Auditoría
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const all = data.pages;
  const maxRank = all.length > 0 ? all[0].pagerank : 0;
  const hubs = data.topHubs
    .map((url) => data.pages.find((p) => p.url === url))
    .filter((p): p is PageRow => Boolean(p));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Auditoría · Enlaces"
        title="Enlazado interno"
        description="PageRank interno calculado sobre el grafo de enlaces de la última auditoría — identifica qué URLs reciben más fuerza, cuáles están huérfanas y cuáles son hubs distribuidores."
      />
      <p className="text-xs font-semibold text-ink-faint">
        {all.length} URLs analizadas · {data.totalExternalLinks} enlaces externos · auditoría del{" "}
        {new Date(data.auditDate).toLocaleDateString("es-ES")}
      </p>

      {/* Sugerencias: lo accionable va arriba */}
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-ink-soft" />
            <h3 className="text-sm font-semibold text-ink">
              Enlaces internos que te conviene añadir ({data.suggestions.length})
            </h3>
          </div>
          {data.suggestions.length > 0 && (
            <button
              onClick={() =>
                downloadCsv(
                  `enlaces-sugeridos-${projectId}-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Enlazar desde", "Hacia", "Anchor sugerido", "Motivo", "Términos en común"],
                  data.suggestions.flatMap((sg) =>
                    sg.sources.map((src) => [src.url, sg.target.url, sg.anchor, REASON_LABEL[sg.reason], src.sharedTerms.join(" ")])
                  )
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 border border-line text-ink-soft text-xs font-medium rounded-lg hover:bg-background"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
        </div>
        <p className="text-xs text-ink-faint mb-4">
          Páginas que necesitan más enlaces entrantes (huérfanas, con un solo enlace, o que posicionan entre el 4 y el 30)
          y desde qué páginas relacionadas enlazarlas. La relación se mide por términos compartidos en título, H1 y meta.
        </p>
        {data.suggestions.length === 0 ? (
          <p className="text-sm text-ink-soft">No hay sugerencias: el enlazado interno está bien repartido.</p>
        ) : (
          <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
            {data.suggestions.map((sg) => (
              <div key={sg.target.url} className="rounded-xl border border-line p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <UrlLink url={sg.target.url} className="text-sm font-medium" />
                    <p className="text-xs text-ink-faint mt-0.5">
                      Anchor sugerido: <span className="text-ink-soft font-medium">«{sg.anchor}»</span>
                      {sg.target.position !== null && <> · posición #{sg.target.position}</>}
                      {" · "}{sg.target.incoming} enlace{sg.target.incoming === 1 ? "" : "s"} entrante{sg.target.incoming === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${sg.reason === "orphan" ? "bg-accent-tint text-accent-ink" : "bg-surface-muted text-ink-soft"}`}>
                    {REASON_LABEL[sg.reason]}
                  </span>
                </div>
                <ul className="space-y-1">
                  {sg.sources.map((src) => (
                    <li key={src.url} className="flex items-center gap-2 text-xs">
                      <ArrowRight className="h-3 w-3 text-ink-faint shrink-0" />
                      <span className="min-w-0 flex-1"><UrlLink url={src.url} className="text-xs" /></span>
                      <span className="shrink-0 text-ink-faint">
                        {src.related ? `comparte: ${src.sharedTerms.join(", ")}` : "sin relación temática detectada"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla completa de PageRank por URL */}
      <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-ink-soft" />
            <h3 className="text-sm font-semibold text-ink">
              PageRank por URL ({all.length})
            </h3>
          </div>
              <button
            onClick={() =>
              downloadCsv(
                `pagerank-${projectId}-${new Date().toISOString().slice(0, 10)}.csv`,
                ["URL", "PageRank (%)", "Entrantes", "Salientes", "Externos"],
                all.map((p) => [p.url, (p.pagerank * 100).toFixed(2), p.incoming, p.outgoing, p.externalLinks])
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 border border-line text-ink-soft text-xs font-medium rounded-lg hover:bg-background"
            title="Exportar a CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-xs text-ink-faint border-b border-line">
                <th className="font-medium py-2 pr-4">URL</th>
                <th className="font-medium py-2 px-2 text-right">PageRank</th>
                <th className="font-medium py-2 px-2 text-right">Entrantes</th>
                <th className="font-medium py-2 px-2 text-right">Salientes</th>
                <th className="font-medium py-2 px-2 text-right">Externos</th>
                <th className="font-medium py-2 pl-2 w-32">Fuerza</th>
              </tr>
            </thead>
            <tbody>
              {all.map((page) => {
                const widthPct = maxRank > 0 ? (page.pagerank / maxRank) * 100 : 0;
                return (
                  <tr key={page.url} className="border-b border-line">
                    <td className="py-1.5 pr-4 max-w-[320px]">
                      <UrlLink url={page.url} className="text-xs" />
                    </td>
                    <td className="py-1.5 px-2 text-right text-ink-soft tabular-nums text-xs">
                      {(page.pagerank * 100).toFixed(2)}%
                    </td>
                    <td className="py-1.5 px-2 text-right text-ink-soft tabular-nums">
                      {page.incoming}
                    </td>
                    <td className="py-1.5 px-2 text-right text-ink-soft tabular-nums">
                      {page.outgoing}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums" title={page.externalDomains.join(", ")}>
                      {page.externalLinks > 0 ? (
                        <span className="text-ink-soft">{page.externalLinks}</span>
                      ) : (
                        <span className="text-ink-faint">0</span>
                      )}
                    </td>
                    <td className="py-1.5 pl-2">
                      <div className="h-2 w-full bg-surface-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-accent-ink" />
            <h3 className="text-sm font-semibold text-ink">
              Páginas huérfanas ({data.orphans.length})
            </h3>
          </div>
          {data.orphans.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No hay páginas huérfanas: todas reciben al menos un enlace interno.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.orphans.map((url) => (
                <li key={url}>
                  <span className="inline-block bg-accent-tint px-2 py-1 rounded-md max-w-full align-middle">
                    <UrlLink url={url} className="text-xs text-accent-ink hover:text-ink" showIcon={false} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-faint mt-3">
            Candidatas a enlazar desde otras páginas para que reciban fuerza.
          </p>
        </div>

        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="h-4 w-4 text-ink-soft" />
            <h3 className="text-sm font-semibold text-ink">
              Principales distribuidoras (hubs)
            </h3>
          </div>
          <ol className="space-y-1.5">
            {hubs.map((hub, i) => (
              <li key={hub.url} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center min-w-0">
                  <span className="text-ink-faint mr-2 tabular-nums shrink-0">{i + 1}.</span>
                  <UrlLink url={hub.url} className="text-sm" />
                </span>
                <span className="text-xs text-ink-faint shrink-0 tabular-nums">
                  {hub.outgoing} salientes
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-ink-faint mt-3">
            Páginas que más enlaces reparten — buenas distribuidoras de fuerza.
          </p>
        </div>
      </div>

      {/* Dominios externos más enlazados */}
      {data.topExternalDomains.length > 0 && (
        <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="h-4 w-4 text-ink-soft" />
            <h3 className="text-sm font-semibold text-ink">
              Dominios externos más enlazados ({data.topExternalDomains.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.topExternalDomains.map((d) => (
              <span
                key={d.domain}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-surface-muted text-ink-soft"
                title={`${d.pages} página(s) enlazan este dominio`}
              >
                {d.domain}
                <span className="text-ink-faint tabular-nums">· {d.pages}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-faint mt-3">
            Dominios a los que tu sitio enlaza (según el rastreo). El número indica en cuántas páginas aparecen.
          </p>
        </div>
      )}
    </div>
  );
}
