// Agrupa keywords por coincidencia real de resultados en Google: dos búsquedas
// van al mismo grupo si su top-10 comparte al menos `minShared` URLs (el
// criterio habitual para decidir si una sola página puede cubrir ambas).
// Puro: sin imports de la app.

export type ClusterInput = { keyword: string; volume: number | null; urls: string[] };
export type Cluster = {
  head: string; // keyword principal (la de más volumen del grupo)
  headVolume: number | null;
  totalVolume: number;
  members: { keyword: string; volume: number | null; shared: number }[]; // shared = URLs en común con la principal
};

export function normUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

export function clusterBySerp(items: ClusterInput[], minShared = 3): Cluster[] {
  const sorted = [...items].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
  const clusters: { head: ClusterInput; headUrls: Set<string>; members: Cluster["members"] }[] = [];
  for (const it of sorted) {
    const urls = new Set(it.urls.map(normUrl));
    let best: { c: (typeof clusters)[number]; shared: number } | null = null;
    for (const c of clusters) {
      let shared = 0;
      for (const u of urls) if (c.headUrls.has(u)) shared++;
      if (shared >= minShared && (!best || shared > best.shared)) best = { c, shared };
    }
    if (best) best.c.members.push({ keyword: it.keyword, volume: it.volume, shared: best.shared });
    else clusters.push({ head: it, headUrls: urls, members: [{ keyword: it.keyword, volume: it.volume, shared: urls.size }] });
  }
  return clusters
    .map((c) => ({
      head: c.head.keyword,
      headVolume: c.head.volume,
      totalVolume: c.members.reduce((s, m) => s + (m.volume ?? 0), 0),
      members: c.members,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume);
}
