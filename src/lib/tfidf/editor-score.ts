// Puntuación de un texto frente al top-10 de Google para una keyword (editor de
// contenido). Determinista y explicable: no hay IA ni "caja negra". Puro.
//
//  • Cobertura de términos (60 %): qué parte del peso TF-IDF de los 20 términos
//    principales aparece en tu texto.
//  • Longitud (25 %): cercanía a la mediana de palabras de las páginas que
//    posicionan (si no hay dato de longitud, se reparte entre los otros dos).
//  • Preguntas/apartados (15 %): apartados (H2/H3) comunes que tu texto toca.

export type EditorInput = {
  terms: { term: string; tfidf: number }[];
  topics: { text: string; coverage: number }[];
  pageWordCounts?: number[];
};

export type EditorScore = {
  score: number; // 0-100
  words: number;
  termsCoverage: number; // 0-100
  usedTerms: string[];
  missingTerms: string[];
  overusedTerms: { term: string; density: number }[];
  length: { target: number | null; low: number | null; high: number | null; status: "corto" | "bien" | "largo" | "sin-dato" };
  topicsCovered: number;
  topicsTotal: number;
  missingTopics: string[];
};

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

export function scoreText(text: string, input: EditorInput): EditorScore {
  const norm = ` ${normalizeText(text)} `;
  const words = norm.trim() ? norm.trim().split(" ").length : 0;
  const top = input.terms.slice(0, 20);
  const totalWeight = top.reduce((s, t) => s + t.tfidf, 0) || 1;

  const used: string[] = [];
  const missing: string[] = [];
  let usedWeight = 0;
  const overused: { term: string; density: number }[] = [];
  for (const t of top) {
    const nt = normalizeText(t.term);
    const occ = countOccurrences(norm, ` ${nt} `);
    if (occ > 0) {
      used.push(t.term);
      usedWeight += t.tfidf;
      const density = words > 0 ? (occ * nt.split(" ").length) / words : 0;
      if (words >= 100 && density > 0.04) overused.push({ term: t.term, density });
    } else missing.push(t.term);
  }
  const termsCoverage = (usedWeight / totalWeight) * 100;

  const med = median(input.pageWordCounts ?? []);
  let lengthScore: number | null = null;
  let status: EditorScore["length"]["status"] = "sin-dato";
  let low: number | null = null;
  let high: number | null = null;
  if (med) {
    low = Math.round(med * 0.9);
    high = Math.round(med * 1.2);
    status = words < low ? "corto" : words > high ? "largo" : "bien";
    lengthScore = words >= low && words <= high ? 100 : words < low ? Math.max(0, (words / low) * 100) : Math.max(0, 100 - ((words - high) / high) * 100);
  }

  const topics = input.topics.filter((t) => t.coverage >= 2).slice(0, 12);
  const stop = new Set(["de", "la", "el", "los", "las", "en", "y", "a", "un", "una", "que", "para", "por", "con", "del"]);
  const topicHit = (t: string) => {
    const toks = normalizeText(t).split(" ").filter((w) => w.length > 2 && !stop.has(w));
    if (toks.length === 0) return false;
    const found = toks.filter((w) => norm.includes(` ${w}`)).length;
    return found / toks.length >= 0.6;
  };
  const covered = topics.filter((t) => topicHit(t.text));
  const topicsScore = topics.length > 0 ? (covered.length / topics.length) * 100 : null;

  const parts: { w: number; v: number | null }[] = [
    { w: 0.6, v: termsCoverage },
    { w: 0.25, v: lengthScore },
    { w: 0.15, v: topicsScore },
  ];
  const active = parts.filter((p) => p.v !== null);
  const wsum = active.reduce((s, p) => s + p.w, 0);
  const score = words < 30 ? 0 : active.reduce((s, p) => s + (p.v as number) * p.w, 0) / wsum;

  return {
    score: Math.round(score),
    words,
    termsCoverage: Math.round(termsCoverage),
    usedTerms: used,
    missingTerms: missing,
    overusedTerms: overused,
    length: { target: med, low, high, status },
    topicsCovered: covered.length,
    topicsTotal: topics.length,
    missingTopics: topics.filter((t) => !topicHit(t.text)).map((t) => t.text),
  };
}
