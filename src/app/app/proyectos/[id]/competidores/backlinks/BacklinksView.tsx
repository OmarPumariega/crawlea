"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronRight, ExternalLink, ShieldAlert, Filter, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { backlinkAnalysisCostUsd, BACKLINK_ANCHORS_COST_USD } from "@/lib/dataforseo/pricing";
import { fmtCredits } from "@/lib/credits";
import PageHeader from "@/components/app/PageHeader";
import SimpleHistory from "@/components/app/SimpleHistory";
import Pill from "@/components/app/Pill";
import Modal from "@/components/app/Modal";
import Section from "@/components/ui/Section";
import StatTile from "@/components/ui/StatTile";
import { BarList, RadialGauge } from "@/components/ui/charts";

// TODOS los campos que devuelve /v3/backlinks/backlinks/live — antes solo se
// mostraban 6, el resto se pedía y se tiraba. Nada se muestra que no venga
// real de la API; lo que no llega, queda null.
type TopBacklink = {
  urlFrom: string | null;
  urlFromHttps: boolean | null;
  domainFrom: string | null;
  domainFromRank: number | null;
  pageFromRank: number | null;
  domainFromPlatformType: string[] | null;
  domainFromIsIp: boolean | null;
  urlTo: string | null;
  domainTo: string | null;
  tldFrom: string | null;
  anchor: string | null;
  dofollow: boolean | null;
  textPre: string | null;
  textPost: string | null;
  semanticLocation: string | null;
  linksCount: number | null;
  groupCount: number | null;
  isNew: boolean | null;
  isLost: boolean | null;
  isBroken: boolean | null;
  isIndirectLink: boolean | null;
  urlToStatusCode: number | null;
  backlinkSpamScore: number | null;
  pageFromExternalLinks: number | null;
  pageFromInternalLinks: number | null;
  pageFromSize: number | null;
  pageFromEncoding: string | null;
  pageFromLanguage: string | null;
  pageFromTitle: string | null;
  firstSeen: string | null;
  prevSeen: string | null;
  lastSeen: string | null;
  itemType: string | null;
  domainFromCountry?: string | null;
  domainFromIp?: string | null;
  attributes?: string[] | null;
  urlToSpamScore?: number | null;
  urlToRedirectTarget?: string | null;
  original?: boolean | null;
  pageFromStatusCode?: number | null;
  keywordsTop3?: number | null;
  keywordsTop10?: number | null;
  keywordsTop100?: number | null;
};

type AnchorRow = { anchor: string; backlinks: number; referringDomains: number; referringPages: number; firstSeen: string | null; spamScore: number | null; nofollowPct: number | null };
type Dist = { key: string; count: number }[];
type Profile = {
  firstSeen: string | null;
  spamScore: number | null;
  crawledPages: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  brokenPages: number | null;
  referringIps: number | null;
  referringSubnets: number | null;
  referringPages: number | null;
  referringPagesNofollow: number | null;
  referringDomainsNofollow: number | null;
  site: { server: string | null; cms: string | null; platformType: string[] | null; ip: string | null; country: string | null };
  tld: Dist;
  countries: Dist;
  platformTypes: Dist;
  attributes: Dist;
  linkTypes: Dist;
  semanticLocations: Dist;
} | null;

type Snapshot = {
  id: string;
  domain: string;
  rank: number | null;
  backlinksTotal: number | null;
  referringDomains: number | null;
  referringMainDomains: number | null;
  dofollowBacklinks: number | null;
  nofollowBacklinks: number | null;
  brokenBacklinks: number | null;
  topBacklinks: TopBacklink[] | null;
  profile?: Profile;
  anchors?: AnchorRow[] | null;
  newLost?: { newBacklinks: number | null; lostBacklinks: number | null } | null;
  fetchedAt: string;
} | null;

type CompetitorRow = { domain: string; snapshot: Snapshot };

type Data = {
  projectDomain: string | null;
  projectSnapshot: Snapshot;
  competitors: CompetitorRow[];
};

const LIMIT_OPTIONS = [20, 50, 100, 200, 500] as const;

function fmtNum(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString("es-ES");
}

function rankBadge(rank: number | null): string {
  if (rank === null) return "bg-surface-muted text-ink-faint";
  if (rank >= 500) return "bg-accent-tint text-accent-ink";
  if (rank >= 200) return "bg-accent-tint text-accent-ink";
  return "bg-surface-muted text-ink-soft";
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

// "Tus páginas con más enlaces entrantes" — agrupa por urlTo, cuenta.
function topTargetPages(items: TopBacklink[]): { url: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of items) {
    if (!b.urlTo) continue;
    counts.set(b.urlTo, (counts.get(b.urlTo) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([url, count]) => ({ url, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// "Páginas de origen con más autoridad" — autoridad a nivel de PÁGINA
// (pageFromRank), no de dominio, así que puede destacar una página muy
// concreta de un dominio con autoridad media.
function topReferringPages(items: TopBacklink[]): TopBacklink[] {
  return [...items]
    .filter((b) => b.pageFromRank !== null)
    .sort((a, b) => (b.pageFromRank ?? 0) - (a.pageFromRank ?? 0))
    .slice(0, 10);
}

type GapDomain = { domain: string; rank: number | null; count: number; exampleUrlFrom: string | null };

// Gap de dominios de referencia — mismo concepto que el content gap de
// Competidores (keywords que rankea el competidor y el proyecto no), pero
// para enlaces: dominios que enlazan al competidor y no al proyecto. Se
// calcula por completo a partir de los backlinks YA analizados y guardados
// (topBacklinks de ambos snapshots) — sin ninguna llamada nueva a
// DataForSEO, tal como se pidió explícitamente.
function backlinkGap(own: Snapshot, competitor: Snapshot): GapDomain[] {
  if (!own?.topBacklinks || !competitor?.topBacklinks) return [];
  const ownDomains = new Set(
    own.topBacklinks.map((b) => b.domainFrom).filter((d): d is string => d !== null)
  );
  const byDomain = new Map<string, GapDomain>();
  for (const b of competitor.topBacklinks) {
    if (!b.domainFrom || ownDomains.has(b.domainFrom)) continue;
    const existing = byDomain.get(b.domainFrom);
    if (existing) {
      existing.count++;
      if ((b.domainFromRank ?? -1) > (existing.rank ?? -1)) {
        existing.rank = b.domainFromRank;
        existing.exampleUrlFrom = b.urlFrom;
      }
    } else {
      byDomain.set(b.domainFrom, {
        domain: b.domainFrom,
        rank: b.domainFromRank,
        count: 1,
        exampleUrlFrom: b.urlFrom,
      });
    }
  }
  return Array.from(byDomain.values()).sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1));
}

function BacklinkGapCard({
  ownSnapshot,
  competitorSnapshot,
  competitorDomain,
  bare = false,
}: {
  ownSnapshot: Snapshot;
  competitorSnapshot: Snapshot;
  competitorDomain: string;
  bare?: boolean;
}) {
  const gap = useMemo(
    () => backlinkGap(ownSnapshot, competitorSnapshot),
    [ownSnapshot, competitorSnapshot]
  );

  if (!ownSnapshot || !competitorSnapshot) return null; // falta analizar alguno de los dos — sin ruido

  return (
    <div className={cn("space-y-2", !bare && "bg-surface rounded-2xl border border-line shadow-card p-4")}>
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-ink-faint" />
        <h3 className="text-sm font-semibold text-ink">
          Dominios que enlazan a {competitorDomain} y no a ti ({gap.length})
        </h3>
      </div>
      {gap.length === 0 ? (
        <p className="text-xs text-ink-soft">
          Sin dominios exclusivos de {competitorDomain} entre los backlinks ya analizados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-faint bg-surface-muted">
                <th className="py-1.5 pr-2 font-medium">Dominio</th>
                <th className="py-1.5 pr-2 font-medium text-right">Autoridad</th>
                <th className="py-1.5 pr-2 font-medium text-right">Backlinks encontrados</th>
                <th className="py-1.5 pr-2 font-medium">Ejemplo</th>
              </tr>
            </thead>
            <tbody>
              {gap.map((g) => (
                <tr key={g.domain} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-2 text-ink">{g.domain}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink-soft">{g.rank ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink-soft">{g.count}</td>
                  <td className="py-1.5 pr-2">
                    {g.exampleUrlFrom ? (
                      <a
                        href={g.exampleUrlFrom}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-accent-ink hover:underline"
                      >
                        <span className="truncate max-w-[220px] inline-block align-bottom">{g.exampleUrlFrom}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-ink-faint">
        Basado en los backlinks ya analizados de cada dominio (hasta el límite elegido al
        analizar) — no es necesariamente el listado completo.
      </p>
    </div>
  );
}

function BacklinkRow({ b }: { b: TopBacklink }) {
  const [expanded, setExpanded] = useState(false);
  const days = daysAgo(b.lastSeen ?? b.firstSeen);
  return (
    <>
      <tr className="border-b border-line last:border-0 hover:bg-background/60 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <td className="py-1.5 pr-2 text-ink">
          {b.urlFrom ? (
            <a
              href={b.urlFrom}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-accent-ink hover:underline"
            >
              <span className="truncate max-w-[200px] inline-block align-bottom">{b.domainFrom ?? b.urlFrom}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            b.domainFrom ?? "—"
          )}
        </td>
        <td className="py-1.5 pr-2 text-right tabular-nums text-ink-soft">{b.domainFromRank ?? "—"}</td>
        <td className="py-1.5 pr-2 text-right tabular-nums text-ink-soft">{b.pageFromRank ?? "—"}</td>
        <td className="py-1.5 pr-2 text-ink-soft truncate max-w-[160px]">{b.anchor || "—"}</td>
        <td className="py-1.5 pr-2 text-ink-soft">{b.dofollow === false ? "nofollow" : "dofollow"}</td>
        <td className="py-1.5 pr-2">
          {b.isBroken || (b.urlToStatusCode && b.urlToStatusCode >= 400) ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-alert-tint text-alert-ink font-medium">
              roto{b.urlToStatusCode ? ` (${b.urlToStatusCode})` : ""}
            </span>
          ) : b.urlToStatusCode && b.urlToStatusCode >= 300 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-tint text-accent-ink font-medium">
              redirección ({b.urlToStatusCode})
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-tint text-accent-ink">
              {b.urlToStatusCode ?? "OK"}
            </span>
          )}
        </td>
        <td className="py-1.5 pr-2 text-ink-faint">{days !== null ? `hace ${days}d` : "—"}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-line last:border-0 bg-background/40">
          <td colSpan={7} className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px] text-ink-soft">
              <div><span className="text-ink-faint">Página destino:</span> {b.urlTo ?? "—"}</div>
              <div><span className="text-ink-faint">TLD origen:</span> {b.tldFrom ?? "—"}</div>
              <div><span className="text-ink-faint">HTTPS origen:</span> {b.urlFromHttps === null ? "—" : b.urlFromHttps ? "sí" : "no"}</div>
              <div><span className="text-ink-faint">Es IP:</span> {b.domainFromIsIp === null ? "—" : b.domainFromIsIp ? "sí" : "no"}</div>
              <div><span className="text-ink-faint">Nuevo:</span> {b.isNew === null ? "—" : b.isNew ? "sí" : "no"}</div>
              <div><span className="text-ink-faint">Perdido:</span> {b.isLost === null ? "—" : b.isLost ? "sí" : "no"}</div>
              <div><span className="text-ink-faint">Enlace indirecto:</span> {b.isIndirectLink === null ? "—" : b.isIndirectLink ? "sí" : "no"}</div>
              <div><span className="text-ink-faint">Spam score:</span> {b.backlinkSpamScore ?? "—"}</div>
              <div><span className="text-ink-faint">Nº enlaces en la página:</span> {b.linksCount ?? "—"}</div>
              <div><span className="text-ink-faint">Grupo de enlaces:</span> {b.groupCount ?? "—"}</div>
              <div><span className="text-ink-faint">Enlaces externos página origen:</span> {b.pageFromExternalLinks ?? "—"}</div>
              <div><span className="text-ink-faint">Enlaces internos página origen:</span> {b.pageFromInternalLinks ?? "—"}</div>
              <div><span className="text-ink-faint">Tamaño página origen:</span> {b.pageFromSize ?? "—"}</div>
              <div><span className="text-ink-faint">Idioma página origen:</span> {b.pageFromLanguage ?? "—"}</div>
              <div><span className="text-ink-faint">Codificación:</span> {b.pageFromEncoding ?? "—"}</div>
              <div><span className="text-ink-faint">Primera vez visto:</span> {b.firstSeen ? new Date(b.firstSeen).toLocaleDateString("es-ES") : "—"}</div>
              <div><span className="text-ink-faint">Última vez visto:</span> {b.lastSeen ? new Date(b.lastSeen).toLocaleDateString("es-ES") : "—"}</div>
              <div><span className="text-ink-faint">Visto anteriormente:</span> {b.prevSeen ? new Date(b.prevSeen).toLocaleDateString("es-ES") : "—"}</div>
              <div><span className="text-ink-faint">Tipo de item:</span> {b.itemType ?? "—"}</div>
              <div><span className="text-ink-faint">Plataforma origen:</span> {b.domainFromPlatformType?.join(", ") || "—"}</div>
              {b.pageFromTitle && <div className="col-span-2 sm:col-span-4"><span className="text-ink-faint">Título página origen:</span> {b.pageFromTitle}</div>}
              {(b.textPre || b.textPost) && (
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-ink-faint">Contexto del enlace:</span> {b.textPre} <strong>[enlace]</strong> {b.textPost}
                </div>
              )}
              <div><span className="text-ink-faint">País del origen:</span> {b.domainFromCountry ?? "—"}</div>
              <div><span className="text-ink-faint">IP del origen:</span> {b.domainFromIp ?? "—"}</div>
              <div><span className="text-ink-faint">Atributos:</span> {b.attributes?.join(", ") || "ninguno"}</div>
              <div><span className="text-ink-faint">En el HTML original:</span> {b.original == null ? "—" : b.original ? "sí" : "solo con JS"}</div>
              <div><span className="text-ink-faint">Spam de la página destino:</span> {b.urlToSpamScore ?? "—"}</div>
              <div><span className="text-ink-faint">Código de la página origen:</span> {b.pageFromStatusCode ?? "—"}</div>
              <div><span className="text-ink-faint">Keywords de la página origen:</span> {b.keywordsTop3 == null ? "—" : `${b.keywordsTop3} top 3 · ${b.keywordsTop10} top 10 · ${b.keywordsTop100} top 100`}</div>
              {b.urlToRedirectTarget && <div className="col-span-2 sm:col-span-4"><span className="text-ink-faint">Redirige a:</span> {b.urlToRedirectTarget}</div>}
              {b.semanticLocation && <div className="col-span-2 sm:col-span-4"><span className="text-ink-faint">Ubicación semántica:</span> {b.semanticLocation}</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


const PLATFORM_ES: Record<string, string> = { unknown: "Sin clasificar", blogs: "Blogs", cms: "CMS", organization: "Organizaciones", news: "Noticias", ecommerce: "Tiendas online", forums: "Foros", wiki: "Wikis", socialnetworks: "Redes sociales", directories: "Directorios", education: "Educación", government: "Gobierno" };

function DistList({ title, items, label }: { title: string; items: Dist; label?: (k: string) => string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink-soft">{title}</p>
      <BarList items={items.slice(0, 6).map((d) => ({ label: label ? label(d.key) : d.key, value: d.count }))} />
    </div>
  );
}

// Calidad del perfil de enlaces: todo sale del summary que ya se paga.
function ProfileQuality({ snapshot }: { snapshot: NonNullable<Snapshot> }) {
  const p = snapshot.profile;
  if (!p) {
    return <p className="mt-6 rounded-2xl bg-surface-muted px-4 py-3 text-xs text-ink-soft">Este análisis es anterior a «Calidad del perfil». Vuelve a analizar para ver el spam score, la diversidad de IPs y la distribución de enlaces.</p>;
  }
  const spamHigh = (p.spamScore ?? 0) >= 30;
  const site = [p.site.cms, p.site.server, p.site.country].filter(Boolean).join(" · ");
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 text-sm font-bold text-ink">Calidad del perfil de enlaces</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4 lg:grid-cols-6">
        <div><dt className="text-xs text-ink-faint">Spam score</dt><dd className={cn("font-bold tabular-nums", spamHigh ? "text-alert-ink" : "text-ink")}>{p.spamScore ?? "—"}<span className="font-medium text-ink-faint"> /100</span></dd></div>
        <div><dt className="text-xs text-ink-faint">IPs distintas</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(p.referringIps)}</dd></div>
        <div><dt className="text-xs text-ink-faint">Subredes</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(p.referringSubnets)}</dd></div>
        <div><dt className="text-xs text-ink-faint">Páginas que enlazan</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(p.referringPages)}</dd></div>
        <div><dt className="text-xs text-ink-faint">Dominios nofollow</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(p.referringDomainsNofollow)}</dd></div>
        <div><dt className="text-xs text-ink-faint">Páginas rotas propias</dt><dd className={cn("font-bold tabular-nums", (p.brokenPages ?? 0) > 0 ? "text-alert-ink" : "text-ink")}>{fmtNum(p.brokenPages)}</dd></div>
        <div><dt className="text-xs text-ink-faint">Enlaces internos / externos</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(p.internalLinks)} <span className="font-medium text-ink-faint">/ {fmtNum(p.externalLinks)}</span></dd></div>
        <div><dt className="text-xs text-ink-faint">Páginas rastreadas</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(p.crawledPages)}</dd></div>
        <div><dt className="text-xs text-ink-faint">Primer enlace visto</dt><dd className="font-bold text-ink">{p.firstSeen ? new Date(p.firstSeen).toLocaleDateString("es-ES", { month: "short", year: "numeric" }) : "—"}</dd></div>
        {site && <div className="col-span-2"><dt className="text-xs text-ink-faint">Sitio (CMS · servidor · país)</dt><dd className="font-bold text-ink">{site}</dd></div>}
      </dl>
      <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <DistList title="Por dominio de origen (TLD)" items={p.tld} label={(k) => "." + k} />
        <DistList title="País de origen" items={p.countries} />
        <DistList title="Tipo de web que enlaza" items={p.platformTypes} label={(k) => PLATFORM_ES[k] ?? k} />
        <DistList title="Atributos del enlace" items={p.attributes} />
      </div>
    </div>
  );
}

// Anchors más usados y enlaces nuevos/perdidos: pago aparte (~25 créditos), por
// eso es un botón. Un anchor con spam alto (texto de venta de enlaces, PBN) es la
// señal más clara de enlaces tóxicos.
function AnchorsCard({ projectId, domain, snapshot }: { projectId: string; domain: string; snapshot: NonNullable<Snapshot> }) {
  const [anchors, setAnchors] = useState<AnchorRow[] | null>(snapshot.anchors ?? null);
  const [newLost, setNewLost] = useState(snapshot.newLost ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/proyectos/${projectId}/backlinks/anchors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
    const d = await res.json();
    if (!res.ok) setError(d.error ?? "No se pudo obtener");
    else {
      setAnchors(d.anchors);
      setNewLost(d.newLost);
    }
    setBusy(false);
  }

  if (!anchors) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-ink-soft">Mira con qué textos te enlazan y cuántos enlaces has ganado y perdido recientemente.</p>
        <button onClick={load} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Ver anchors y cambios ({fmtCredits(BACKLINK_ANCHORS_COST_USD)})
        </button>
        {error && <p className="w-full text-xs text-alert-ink">{error}</p>}
      </div>
    );
  }
  const toxic = anchors.filter((a) => (a.spamScore ?? 0) >= 50);
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-ink">Anchors y cambios recientes</p>
        {newLost && (
          <p className="text-sm text-ink-soft">
            Enlaces nuevos <strong className="tabular-nums text-ink">{newLost.newBacklinks ?? "—"}</strong> · perdidos <strong className={cn("tabular-nums", (newLost.lostBacklinks ?? 0) > 0 ? "text-alert-ink" : "text-ink")}>{newLost.lostBacklinks ?? "—"}</strong>
          </p>
        )}
      </div>
      {toxic.length > 0 && (
        <p className="mb-3 rounded-lg bg-alert-tint px-3 py-2 text-xs text-alert-ink">
          {toxic.length} anchors con spam alto: suelen ser enlaces comprados o de redes de baja calidad. Revísalos antes de desautorizarlos.
        </p>
      )}
      <table className="data-table data-table-compact w-full">
        <thead><tr><th>Texto del enlace</th><th className="num">Enlaces</th><th className="num">Dominios</th><th className="num">Spam</th></tr></thead>
        <tbody>
          {anchors.slice(0, 15).map((a, i) => (
            <tr key={i}>
              <td className="max-w-[360px] truncate">{a.anchor || <span className="text-ink-faint">(sin texto: imagen o redirección)</span>}</td>
              <td className="num tabular-nums text-ink-soft">{a.backlinks.toLocaleString("es-ES")}</td>
              <td className="num tabular-nums text-ink-soft">{a.referringDomains}</td>
              <td className={cn("num tabular-nums", (a.spamScore ?? 0) >= 50 ? "font-semibold text-alert-ink" : "text-ink-soft")}>{a.spamScore ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Ficha de un dominio. "full" para el propio (sección ancha con gráficos) y
// "card" para cada competidor (tarjeta compacta en rejilla). El listado
// completo de backlinks, con filtros, va siempre en una ventana aparte.
function DomainDetail({
  projectId,
  label,
  domain,
  snapshot,
  analyzing,
  onAnalyze,
  variant = "full",
  gap,
  onShowGap,
}: {
  projectId: string;
  label: string;
  domain: string | null;
  snapshot: Snapshot;
  analyzing: boolean;
  onAnalyze: (limit: number | "all") => void;
  variant?: "full" | "card";
  gap?: number | null;
  onShowGap?: () => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const [limit, setLimit] = useState<number | "all">(20);
  const [minAuthority, setMinAuthority] = useState(0);
  const [maxDaysAgo, setMaxDaysAgo] = useState<number | null>(null);
  const [dofollowOnly, setDofollowOnly] = useState(false);

  const items = snapshot?.topBacklinks ?? [];
  const filtered = useMemo(() => {
    return items.filter((b) => {
      if ((b.domainFromRank ?? 0) < minAuthority) return false;
      if (dofollowOnly && b.dofollow === false) return false;
      if (maxDaysAgo !== null) {
        const d = daysAgo(b.lastSeen ?? b.firstSeen);
        if (d === null || d > maxDaysAgo) return false;
      }
      return true;
    });
  }, [items, minAuthority, maxDaysAgo, dofollowOnly]);

  const targetPages = useMemo(() => topTargetPages(items), [items]);
  const referringPages = useMemo(() => topReferringPages(items), [items]);

  const estimatedCost =
    limit === "all"
      ? snapshot?.backlinksTotal
        ? backlinkAnalysisCostUsd(snapshot.backlinksTotal)
        : null
      : backlinkAnalysisCostUsd(limit);

  function handleAnalyzeClick() {
    if (limit === "all") {
      const msg = estimatedCost
        ? `Se pedirán los ${snapshot?.backlinksTotal?.toLocaleString("es-ES")} backlinks reales de este dominio — coste estimado ${fmtCredits(estimatedCost)}. ¿Continuar?`
        : "No se conoce el total de backlinks todavía (primer análisis) — el coste puede ser alto en dominios grandes. ¿Continuar?";
      if (!window.confirm(msg)) return;
    }
    onAnalyze(limit);
  }

  const dofollowPct =
    snapshot && snapshot.dofollowBacklinks != null && snapshot.nofollowBacklinks != null && snapshot.dofollowBacklinks + snapshot.nofollowBacklinks > 0
      ? (snapshot.dofollowBacklinks / (snapshot.dofollowBacklinks + snapshot.nofollowBacklinks)) * 100
      : null;

  if (!domain) {
    return (
      <Section>
        <p className="text-sm text-ink-soft">Define el dominio del proyecto en su ficha para analizar sus backlinks.</p>
      </Section>
    );
  }

  const analyzeControls = (
    <div className="flex items-center gap-2">
      <select
        value={String(limit)}
        onChange={(e) => setLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
        className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        title="Cuántos backlinks traer (los de más autoridad primero)"
      >
        {LIMIT_OPTIONS.map((n) => (
          <option key={n} value={n}>Top {n}</option>
        ))}
        <option value="all">Todos</option>
      </select>
      <button
        onClick={handleAnalyzeClick}
        disabled={analyzing}
        title={estimatedCost ? `Coste estimado ${fmtCredits(estimatedCost)}` : "Coste según cantidad real"}
        className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
      >
        {analyzing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Analizar {estimatedCost != null && <span className="font-normal text-white/70">{fmtCredits(estimatedCost)}</span>}
      </button>
    </div>
  );

  const listModal = (
    <Modal open={listOpen} title={`Backlinks · ${domain}`} onClose={() => setListOpen(false)} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-muted px-4 py-2.5 text-xs text-ink-soft">
          <Filter className="h-3.5 w-3.5 text-ink-faint" />
          <label className="flex items-center gap-1.5">
            Autoridad mín.
            <input
              type="number"
              min={0}
              max={1000}
              value={minAuthority}
              onChange={(e) => setMinAuthority(Number(e.target.value) || 0)}
              className="w-16 rounded-lg border border-line bg-surface px-1.5 py-0.5 text-xs outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-1.5">
            Visto en los últimos
            <select
              value={maxDaysAgo ?? ""}
              onChange={(e) => setMaxDaysAgo(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-line bg-surface px-1.5 py-0.5 text-xs outline-none focus:border-brand"
            >
              <option value="">cualquier fecha</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="365">1 año</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={dofollowOnly} onChange={(e) => setDofollowOnly(e.target.checked)} className="h-3.5 w-3.5" />
            Solo dofollow
          </label>
          <span className="ml-auto text-ink-faint">{filtered.length} de {items.length}</span>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-muted text-left text-xs font-semibold text-ink-faint">
                <th className="py-2 pl-3 pr-2 font-medium">Origen</th>
                <th className="py-2 pr-2 text-right font-medium">Autoridad dominio</th>
                <th className="py-2 pr-2 text-right font-medium">Autoridad página</th>
                <th className="py-2 pr-2 font-medium">Anchor</th>
                <th className="py-2 pr-2 font-medium">Tipo</th>
                <th className="py-2 pr-2 font-medium">Estado</th>
                <th className="py-2 pr-2 font-medium">Visto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <BacklinkRow key={i} b={b} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );

  // --- Tarjeta compacta (competidor) ---
  if (variant === "card") {
    return (
      <section className="flex flex-col rounded-[20px] border border-line bg-surface p-5 shadow-card">
        <div>
          <h3 className="truncate text-[15px] font-bold text-ink">{domain}</h3>
          <p className="text-xs text-ink-faint">
            {snapshot ? `Analizado el ${new Date(snapshot.fetchedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}` : label}
          </p>
        </div>
        {snapshot ? (
          <>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-ink-faint">Autoridad</p>
                <p className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">{snapshot.rank ?? "—"}</p>
                <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-brand-50">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, ((snapshot.rank ?? 0) / 1000) * 100)}%` }} />
                </div>
              </div>
              {dofollowPct !== null && <RadialGauge value={dofollowPct} size={72} label="dofollow" />}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Backlinks</dt>
                <dd className="font-bold tabular-nums text-ink">{fmtNum(snapshot.backlinksTotal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Dominios ref.</dt>
                <dd className="font-bold tabular-nums text-ink">{fmtNum(snapshot.referringDomains)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Rotos</dt>
                <dd className="font-bold tabular-nums text-ink">{fmtNum(snapshot.brokenBacklinks)}</dd>
              </div>
            </dl>
            {snapshot.profile && (
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-xs text-ink-faint">Spam</dt><dd className={cn("font-bold tabular-nums", (snapshot.profile.spamScore ?? 0) >= 30 ? "text-alert-ink" : "text-ink")}>{snapshot.profile.spamScore ?? "—"}</dd></div>
                <div><dt className="text-xs text-ink-faint">IPs</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(snapshot.profile.referringIps)}</dd></div>
                <div><dt className="text-xs text-ink-faint">Págs. que enlazan</dt><dd className="font-bold tabular-nums text-ink">{fmtNum(snapshot.profile.referringPages)}</dd></div>
              </dl>
            )}
            {gap != null && (
              <button
                onClick={onShowGap}
                className="mt-4 flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-left hover:bg-brand-100/60"
              >
                <span className="text-sm text-ink">
                  <strong className="tabular-nums">{gap}</strong> dominios le enlazan y a ti no
                </span>
                <ChevronRight className="h-4 w-4 text-brand" />
              </button>
            )}
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">Aún no hay datos. Analízalo para ver su autoridad y sus enlaces.</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          {analyzeControls}
          {items.length > 0 && (
            <button onClick={() => setListOpen(true)} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-brand hover:bg-brand-50">
              Ver backlinks <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {listModal}
      </section>
    );
  }

  // --- Sección ancha (dominio propio) ---
  return (
    <Section
      title={`Tus backlinks · ${domain}`}
      description={snapshot ? `Actualizado el ${new Date(snapshot.fetchedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}` : "Sin analizar todavía."}
      actions={
        <>
          {items.length > 0 && (
            <button onClick={() => setListOpen(true)} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-50">
              Ver los {items.length} backlinks <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
          {analyzeControls}
        </>
      }
    >
      {!snapshot ? (
        <p className="text-sm text-ink-soft">Pulsa <strong>Analizar</strong> para ver quién te enlaza y con cuánta autoridad.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex items-center gap-5">
            {dofollowPct !== null ? <RadialGauge value={dofollowPct} size={96} label="enlaces dofollow" /> : null}
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Dofollow / nofollow</dt>
                <dd className="font-bold tabular-nums text-ink">
                  {fmtNum(snapshot.dofollowBacklinks)} <span className="font-medium text-ink-faint">/ {fmtNum(snapshot.nofollowBacklinks)}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Enlaces rotos</dt>
                <dd className={cn("font-bold tabular-nums", (snapshot.brokenBacklinks ?? 0) > 0 ? "text-alert-ink" : "text-ink")}>{fmtNum(snapshot.brokenBacklinks)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">Tus páginas más enlazadas</p>
            {targetPages.length > 0 ? (
              <BarList items={targetPages.slice(0, 5).map((p) => ({ label: p.url.replace(/^https?:\/\//, ""), value: p.count }))} />
            ) : (
              <p className="text-xs text-ink-faint">Sin datos.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">Enlaces con más autoridad</p>
            {referringPages.length > 0 ? (
              <BarList
                items={referringPages.slice(0, 5).map((p) => ({
                  label: (p.domainFrom ?? p.urlFrom ?? "—").replace(/^https?:\/\//, ""),
                  value: p.pageFromRank ?? 0,
                }))}
              />
            ) : (
              <p className="text-xs text-ink-faint">Sin datos.</p>
            )}
          </div>
        </div>
      )}
      {snapshot && <ProfileQuality snapshot={snapshot} />}
      {snapshot && domain && <AnchorsCard key={snapshot.id} projectId={projectId} domain={domain} snapshot={snapshot} />}
      {listModal}
    </Section>
  );
}

export default function BacklinksView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingDomain, setAnalyzingDomain] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [gapDomain, setGapDomain] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

  function load() {
    fetch(`/api/proyectos/${projectId}/backlinks`)
      .then((r) => r.json())
      .then((d: Data) => setData(d))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleAnalyze(domain: string, limit: number | "all") {
    setError("");
    setAnalyzingDomain(domain);
    const res = await fetch(`/api/proyectos/${projectId}/backlinks/analizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, limit }),
    });
    const d = await res.json();
    setAnalyzingDomain(null);
    if (!res.ok) {
      setError(d.error ?? "Error al analizar");
      return;
    }
    load();
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />;

  const comparisonRows = [
    ...(data?.projectDomain
      ? [{ domain: data.projectDomain, snapshot: data.projectSnapshot, isOwn: true }]
      : []),
    ...(data?.competitors.map((c) => ({ domain: c.domain, snapshot: c.snapshot, isOwn: false })) ?? []),
  ].sort((a, b) => (b.snapshot?.rank ?? -1) - (a.snapshot?.rank ?? -1));

  return (
    <div className="space-y-6">
      <SimpleHistory url={`/api/proyectos/${projectId}/backlinks/historial`} refreshKey={data} empty="Aún no has analizado ningún dominio. Cada análisis quedará aquí." />
      <PageHeader
        eyebrow="Competidores · Backlinks"
        title="Backlinks"
        description="Enlazado externo: qué dominios enlazan a tu sitio (y a los de tus competidores ya trackeados en Competidores), cuánta autoridad tienen y desde dónde. Cada análisis gasta créditos; ves cuántos antes de lanzarlo."
      />

      {error && <p className="text-sm text-alert-ink bg-alert-tint px-3 py-2 rounded-lg">{error}</p>}

      {/* Resumen de tu perfil de enlaces */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          highlight
          label="Tu autoridad"
          icon={<ShieldAlert className="h-4 w-4" />}
          value={data?.projectSnapshot?.rank ?? "—"}
          hint="sobre 1.000"
        />
        <StatTile label="Backlinks" value={fmtNum(data?.projectSnapshot?.backlinksTotal)} hint="enlaces que apuntan a tu web" />
        <StatTile label="Dominios de referencia" value={fmtNum(data?.projectSnapshot?.referringDomains)} hint="webs distintas que te enlazan" />
        <StatTile
          label="Tu puesto en autoridad"
          value={(() => {
            const ranked = comparisonRows.filter((r) => r.snapshot?.rank != null);
            const pos = ranked.findIndex((r) => r.isOwn);
            return pos >= 0 ? <>{pos + 1}<span className="text-xl font-bold text-ink-faint"> / {ranked.length}</span></> : "—";
          })()}
          hint="frente a tus competidores analizados"
        />
      </div>

      {comparisonRows.length > 1 && (
        <Section title="Comparativa de autoridad" description="Autoridad del dominio (0-1.000) y volumen de enlaces." flush>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dominio</th>
                  <th className="w-[30%]">Autoridad</th>
                  <th className="num">Backlinks</th>
                  <th className="num">Dominios de ref.</th>
                </tr>
              </thead>
              <tbody>
                {(showAllRows ? comparisonRows : comparisonRows.slice(0, 8)).map((r, i) => (
                  <tr key={i}>
                    <td className="font-semibold">
                      {r.domain} {r.isOwn && <Pill tone="brand" className="ml-1.5">Tú</Pill>}
                    </td>
                    <td>
                      {r.snapshot ? (
                        <div className="flex items-center gap-3">
                          <span className="w-12 shrink-0 font-semibold tabular-nums">{r.snapshot.rank ?? "—"}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-50">
                            <div className={cn("h-full rounded-full", r.isOwn ? "bg-brand-500" : "bg-brand-200")} style={{ width: `${Math.max(2, ((r.snapshot.rank ?? 0) / 1000) * 100)}%` }} />
                          </div>
                        </div>
                      ) : (
                        <Pill tone="neutral">Sin analizar</Pill>
                      )}
                    </td>
                    <td className="num text-ink-soft">{fmtNum(r.snapshot?.backlinksTotal)}</td>
                    <td className="num text-ink-soft">{fmtNum(r.snapshot?.referringDomains)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {comparisonRows.length > 8 && (
            <button
              onClick={() => setShowAllRows((v) => !v)}
              className="w-full border-t border-line py-3 text-xs font-semibold text-brand hover:bg-surface-muted"
            >
              {showAllRows ? "Ver menos" : `Ver los ${comparisonRows.length} dominios`}
            </button>
          )}
        </Section>
      )}

      <DomainDetail
        projectId={projectId}
        label="Tu dominio"
        domain={data?.projectDomain ?? null}
        snapshot={data?.projectSnapshot ?? null}
        analyzing={analyzingDomain === data?.projectDomain}
        onAnalyze={(limit) => data?.projectDomain && handleAnalyze(data.projectDomain, limit)}
      />

      {data?.competitors.length === 0 ? (
        <Section>
          <p className="flex items-start gap-2 text-sm text-ink-soft">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
            Todavía no sigues a ningún competidor. Añádelos en el módulo Competidores: aquí se usa la misma lista.
          </p>
        </Section>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data?.competitors.map((c) => (
            <DomainDetail
        projectId={projectId}
              key={c.domain}
              variant="card"
              label="Sin analizar"
              domain={c.domain}
              snapshot={c.snapshot}
              analyzing={analyzingDomain === c.domain}
              onAnalyze={(limit) => handleAnalyze(c.domain, limit)}
              gap={data.projectSnapshot && c.snapshot ? backlinkGap(data.projectSnapshot, c.snapshot).length : null}
              onShowGap={() => setGapDomain(c.domain)}
            />
          ))}
        </div>
      )}

      {/* Gap de dominios de referencia de un competidor */}
      {(() => {
        const comp = data?.competitors.find((c) => c.domain === gapDomain);
        return (
          <Modal open={!!comp} title={`Dominios que enlazan a ${gapDomain ?? ""} y no a ti`} onClose={() => setGapDomain(null)} wide>
            {comp && data && (
              <BacklinkGapCard ownSnapshot={data.projectSnapshot} competitorSnapshot={comp.snapshot} competitorDomain={comp.domain} bare />
            )}
          </Modal>
        );
      })()}
    </div>
  );
}
