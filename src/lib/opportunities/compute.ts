// Oportunidades a partir de Search Console (datos REALES del propio sitio).
// Puro: sin imports de la app, para probarlo con filas sintéticas en node.
//
// Fiabilidad: no se usa ninguna curva de CTR "de la industria". Si se estima
// cuántos clics ganarías, se hace con el CTR que ESTE sitio tiene de verdad
// por posición; si no hay datos suficientes para esa posición, no se estima.

export type QpRow = { query: string; page: string; clicks: number; impressions: number; position: number };

export type QuickWinKind = "pagina2" | "top3" | "ctr";

export type QuickWin = {
  kind: QuickWinKind;
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  potentialClicks: number | null; // clics extra en el periodo si se cumple el objetivo; null = sin datos para estimar
  targetPosition: number | null;
  cannibalized: boolean; // la misma query posiciona ≥2 URLs con peso real
};

export type QuickWinsResult = {
  items: QuickWin[];
  ctrCurve: { position: number; ctr: number; impressions: number }[]; // CTR real del sitio por posición (1-10)
  siteCtrAvailable: boolean;
  skippedBrand: number;
};

const MIN_CURVE_IMPRESSIONS = 300;

function weightedPosition(rows: { position: number; impressions: number }[]): number {
  const imp = rows.reduce((s, r) => s + r.impressions, 0);
  if (imp === 0) return rows.length ? rows[0].position : 0;
  return rows.reduce((s, r) => s + r.position * r.impressions, 0) / imp;
}

export function buildCtrCurve(rows: QpRow[]): Map<number, { ctr: number; impressions: number }> {
  const acc = new Map<number, { clicks: number; impressions: number }>();
  for (const r of rows) {
    const pos = Math.round(r.position);
    if (pos < 1 || pos > 10) continue;
    const cur = acc.get(pos) ?? { clicks: 0, impressions: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    acc.set(pos, cur);
  }
  const out = new Map<number, { ctr: number; impressions: number }>();
  for (const [pos, v] of acc) {
    if (v.impressions >= MIN_CURVE_IMPRESSIONS) out.set(pos, { ctr: v.clicks / v.impressions, impressions: v.impressions });
  }
  return out;
}

export function isBrandQuery(query: string, brandTerms: string[]): boolean {
  const q = query.toLowerCase();
  return brandTerms.some((t) => t.length >= 4 && q.includes(t));
}

export function computeQuickWins(rows: QpRow[], brandTerms: string[] = []): QuickWinsResult {
  const curve = buildCtrCurve(rows);

  // Una fila por query (la URL que más impresiones recibe) + si está canibalizada.
  const byQuery = new Map<string, QpRow[]>();
  for (const r of rows) {
    if (!r.query || !r.page) continue;
    const list = byQuery.get(r.query);
    if (list) list.push(r);
    else byQuery.set(r.query, [r]);
  }

  const items: QuickWin[] = [];
  let skippedBrand = 0;
  for (const [query, list] of byQuery) {
    const totalImp = list.reduce((s, r) => s + r.impressions, 0);
    const best = [...list].sort((a, b) => b.impressions - a.impressions)[0];
    const cannibalized = list.filter((r) => r.impressions >= totalImp * 0.1).length >= 2;
    const impressions = best.impressions;
    const clicks = best.clicks;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const position = best.position;
    if (isBrandQuery(query, brandTerms)) {
      if (position > 3) skippedBrand++;
      continue;
    }

    const potential = (target: number): number | null => {
      const c = curve.get(target);
      return c ? Math.max(0, Math.round(impressions * c.ctr - clicks)) : null;
    };

    let kind: QuickWinKind | null = null;
    let target: number | null = null;
    const expected = curve.get(Math.round(position));
    if (position >= 11 && position <= 20 && impressions >= 50) {
      kind = "pagina2";
      target = 5;
    } else if (position >= 3.5 && position <= 10.5 && impressions >= 100) {
      kind = "top3";
      target = 3;
    }
    // CTR bajo para su posición (el título/meta no convence): prioridad sobre top3
    // porque el arreglo es más barato (reescribir, no posicionar).
    if (position <= 10.5 && impressions >= 100 && expected && expected.ctr >= 0.01 && ctr < expected.ctr * 0.5) {
      kind = "ctr";
      target = Math.round(position);
    }
    if (!kind || target === null) continue;

    let potentialClicks: number | null;
    if (kind === "ctr") {
      potentialClicks = expected ? Math.max(0, Math.round(impressions * expected.ctr - clicks)) : null;
    } else {
      potentialClicks = potential(target);
    }
    if (potentialClicks === 0) continue; // ya rinde lo que rinde su posición: no es una oportunidad
    items.push({ kind, query, page: best.page, impressions, clicks, ctr, position, potentialClicks, targetPosition: target, cannibalized });
  }

  items.sort((a, b) => (b.potentialClicks ?? -1) - (a.potentialClicks ?? -1) || b.impressions - a.impressions);

  return {
    items,
    ctrCurve: [...curve.entries()].sort((a, b) => a[0] - b[0]).map(([position, v]) => ({ position, ctr: v.ctr, impressions: v.impressions })),
    siteCtrAvailable: curve.size > 0,
    skippedBrand,
  };
}

// --- Páginas que pierden tráfico ---------------------------------------------

export type DecayQuery = { query: string; prevClicks: number; clicks: number };
export type DecayPage = {
  page: string;
  prevClicks: number;
  clicks: number;
  delta: number;
  deltaPct: number; // negativo
  prevImpressions: number;
  impressions: number;
  prevPosition: number | null;
  position: number | null;
  topQueries: DecayQuery[]; // las queries que más clics han perdido
};

export function computeDecay(
  current: QpRow[],
  previous: QpRow[],
  opts: { minPrevClicks?: number; minDropPct?: number; minDropClicks?: number } = {}
): DecayPage[] {
  const minPrev = opts.minPrevClicks ?? 20;
  const minPct = opts.minDropPct ?? 0.3;
  const minClicks = opts.minDropClicks ?? 10;

  const group = (rows: QpRow[]) => {
    const m = new Map<string, QpRow[]>();
    for (const r of rows) {
      const l = m.get(r.page);
      if (l) l.push(r);
      else m.set(r.page, [r]);
    }
    return m;
  };
  const cur = group(current);
  const prev = group(previous);
  const out: DecayPage[] = [];

  for (const [page, prevRows] of prev) {
    const curRows = cur.get(page) ?? [];
    const prevClicks = prevRows.reduce((s, r) => s + r.clicks, 0);
    const clicks = curRows.reduce((s, r) => s + r.clicks, 0);
    const delta = clicks - prevClicks;
    if (prevClicks < minPrev || -delta < minClicks || clicks > prevClicks * (1 - minPct)) continue;

    const curByQ = new Map(curRows.map((r) => [r.query, r.clicks]));
    const topQueries = prevRows
      .map((r) => ({ query: r.query, prevClicks: r.clicks, clicks: curByQ.get(r.query) ?? 0 }))
      .filter((q) => q.prevClicks - q.clicks > 0)
      .sort((a, b) => b.prevClicks - b.clicks - (a.prevClicks - a.clicks))
      .slice(0, 3);

    out.push({
      page,
      prevClicks,
      clicks,
      delta,
      deltaPct: prevClicks > 0 ? delta / prevClicks : 0,
      prevImpressions: prevRows.reduce((s, r) => s + r.impressions, 0),
      impressions: curRows.reduce((s, r) => s + r.impressions, 0),
      prevPosition: prevRows.length ? weightedPosition(prevRows) : null,
      position: curRows.length ? weightedPosition(curRows) : null,
      topQueries,
    });
  }
  return out.sort((a, b) => a.delta - b.delta);
}
