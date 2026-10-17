import { prisma } from "@/lib/db/prisma";

// Cuota de visibilidad frente a competidores, sobre TUS keywords seguidas: de
// todo el volumen de búsqueda que sigues, qué parte tiene cada dominio en el
// top 10 de Google (con la posición real del último chequeo). Sin modelo de
// CTR ni estimaciones: posición real + volumen real. Solo cuentan las keywords
// con volumen conocido y con chequeo; la cobertura se devuelve para mostrarla.
export type ShareRow = {
  domain: string;
  isOwn: boolean;
  top3Volume: number;
  top10Volume: number;
  pctTop3: number; // 0-100 del volumen total seguido
  pctTop10: number;
  keywordsTop10: number;
  avgPosition: number | null; // sobre las keywords en las que aparece
};

export type ShareOfVoice = {
  rows: ShareRow[];
  totalVolume: number;
  keywordsCounted: number;
  keywordsTracked: number;
};

export async function computeShareOfVoice(projectId: string, ownDomain: string | null, group?: string): Promise<ShareOfVoice> {
  const tracked = await prisma.rankKeyword.findMany({
    where: { projectId, ...(group ? { group } : {}) },
    select: { id: true, keyword: true, languageCode: true, locationCode: true, lastPosition: true, lastCheckedAt: true },
  });
  const checked = tracked.filter((k) => k.lastCheckedAt !== null);
  if (checked.length === 0) return { rows: [], totalVolume: 0, keywordsCounted: 0, keywordsTracked: tracked.length };

  const cache = await prisma.keywordDataCache.findMany({
    where: { keyword: { in: [...new Set(checked.map((k) => k.keyword))] } },
    select: { keyword: true, languageCode: true, locationCode: true, searchVolume: true },
  });
  const volOf = new Map(cache.map((c) => [`${c.keyword}|${c.languageCode}|${c.locationCode}`, c.searchVolume]));

  const comp = await prisma.rankCompetitorPosition.findMany({
    where: { rankKeywordId: { in: checked.map((k) => k.id) } },
    orderBy: { checkedAt: "desc" },
    distinct: ["rankKeywordId", "competitorDomain"],
    select: { rankKeywordId: true, competitorDomain: true, position: true },
  });

  const acc = new Map<string, { top3: number; top10: number; n10: number; posSum: number; posN: number }>();
  const bump = (domain: string, vol: number, pos: number | null) => {
    const a = acc.get(domain) ?? { top3: 0, top10: 0, n10: 0, posSum: 0, posN: 0 };
    if (pos !== null) {
      a.posSum += pos;
      a.posN++;
      if (pos <= 3) a.top3 += vol;
      if (pos <= 10) {
        a.top10 += vol;
        a.n10++;
      }
    }
    acc.set(domain, a);
  };

  let totalVolume = 0;
  let counted = 0;
  const own = ownDomain ?? "tu web";
  const volById = new Map<string, number>();
  for (const k of checked) {
    const vol = volOf.get(`${k.keyword}|${k.languageCode}|${k.locationCode}`);
    if (vol == null || vol <= 0) continue;
    volById.set(k.id, vol);
    totalVolume += vol;
    counted++;
    bump(own, vol, k.lastPosition);
  }
  for (const c of comp) {
    const vol = volById.get(c.rankKeywordId);
    if (vol === undefined) continue;
    bump(c.competitorDomain, vol, c.position);
  }

  const rows: ShareRow[] = [...acc.entries()]
    .map(([domain, a]) => ({
      domain,
      isOwn: domain === own,
      top3Volume: a.top3,
      top10Volume: a.top10,
      pctTop3: totalVolume > 0 ? (a.top3 / totalVolume) * 100 : 0,
      pctTop10: totalVolume > 0 ? (a.top10 / totalVolume) * 100 : 0,
      keywordsTop10: a.n10,
      avgPosition: a.posN > 0 ? a.posSum / a.posN : null,
    }))
    .sort((a, b) => b.pctTop10 - a.pctTop10 || b.pctTop3 - a.pctTop3);

  return { rows, totalVolume, keywordsCounted: counted, keywordsTracked: tracked.length };
}
