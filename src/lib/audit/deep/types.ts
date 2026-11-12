// Checks "profundos" de la auditoría (estilo Microaudit): cada uno dice qué
// se ha encontrado, si está bien / mejorable / mal / no aplica, CÓMO arreglarlo
// y la documentación oficial. Sin dependencias de servidor: se importa desde
// el cliente (vista, exportación .md) igual que issue-meta.ts.
//
// Regla de fiabilidad: un check solo da "ok"/"improve"/"fail" cuando lo ha
// podido MEDIR. Si no aplica a la página o no se ha podido comprobar, es "na"
// y lo dice con el motivo — nunca se rellena con una suposición.

export type CheckStatus = "ok" | "improve" | "fail" | "na";

export type CheckCategory =
  | "crawl"
  | "url"
  | "onpage"
  | "content"
  | "schema"
  | "perf"
  | "a11y"
  | "eeat"
  | "intl"
  | "ai";

export type CheckSource = { label: string; url: string };

export type DeepCheck = {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  // Qué se ha encontrado, con el dato real medido.
  summary: string;
  // Cómo arreglarlo (null si está bien o no aplica).
  fix: string | null;
  // Datos concretos medidos (valores, URLs, cabeceras...).
  evidence?: { label: string; value: string }[];
  // Peso en la nota de su categoría (1 = normal).
  weight: number;
  // Aviso/convención emergente: se muestra pero no genera tarea automática.
  advisory?: boolean;
  sources: CheckSource[];
};

export const CATEGORY_META: Record<CheckCategory, { label: string; short: string }> = {
  crawl: { label: "Rastreo e indexación", short: "Rastreo" },
  url: { label: "URL y arquitectura", short: "URL" },
  onpage: { label: "Etiquetas on-page", short: "On-page" },
  content: { label: "Contenido", short: "Contenido" },
  schema: { label: "Datos estructurados (Schema.org)", short: "Schema" },
  perf: { label: "Rendimiento y Core Web Vitals", short: "Rendimiento" },
  a11y: { label: "Experiencia, móvil y accesibilidad", short: "Móvil y a11y" },
  eeat: { label: "Confianza y E-E-A-T", short: "E-E-A-T" },
  intl: { label: "SEO internacional", short: "Internacional" },
  ai: { label: "AI SEO (asistentes de IA)", short: "AI SEO" },
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_META) as CheckCategory[];

export type DeepCategoryScore = {
  score: number | null; // 0-100, null si ningún check aplicable
  evaluated: number;
  ok: number;
  improve: number;
  fail: number;
  na: number;
};

export type DeepResult = {
  url: string; // URL auditada (la página de inicio)
  checkedAt: string;
  checks: DeepCheck[];
  categoryScores: Record<CheckCategory, DeepCategoryScore>;
  score: number | null;
};

const POINTS: Record<Exclude<CheckStatus, "na">, number> = { ok: 1, improve: 0.5, fail: 0 };

// Pura. Nota de categoría = media ponderada (ok=1, mejorable=0,5, fallo=0) de
// los checks aplicables; la global = media de las categorías con datos.
export function scoreChecks(checks: DeepCheck[]): Pick<DeepResult, "categoryScores" | "score"> {
  const categoryScores = {} as Record<CheckCategory, DeepCategoryScore>;
  const scored: number[] = [];
  for (const cat of CATEGORY_ORDER) {
    const inCat = checks.filter((c) => c.category === cat);
    const applicable = inCat.filter((c) => c.status !== "na");
    const totalW = applicable.reduce((s, c) => s + c.weight, 0);
    const got = applicable.reduce((s, c) => s + c.weight * POINTS[c.status as Exclude<CheckStatus, "na">], 0);
    const score = totalW > 0 ? Math.round((got / totalW) * 1000) / 10 : null;
    if (score !== null) scored.push(score);
    categoryScores[cat] = {
      score,
      evaluated: applicable.length,
      ok: inCat.filter((c) => c.status === "ok").length,
      improve: inCat.filter((c) => c.status === "improve").length,
      fail: inCat.filter((c) => c.status === "fail").length,
      na: inCat.filter((c) => c.status === "na").length,
    };
  }
  const score = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;
  return { categoryScores, score };
}

// Markdown pensado para pegárselo a una IA (o leerlo): hallazgos accionables
// primero, con el arreglo y la documentación oficial al lado.
export function checksToMarkdown(r: Pick<DeepResult, "url" | "checkedAt" | "checks" | "score" | "categoryScores">): string {
  const icon: Record<CheckStatus, string> = { fail: "❌ FALLO", improve: "⚠️ MEJORABLE", ok: "✅ CORRECTO", na: "➖ NO EVALUABLE" };
  const lines: string[] = [
    `# Auditoría profunda — ${r.url}`,
    "",
    `Fecha: ${r.checkedAt} · Nota: ${r.score ?? "—"}/100`,
    "",
    "## Puntuación por categoría",
    ...CATEGORY_ORDER.map((c) => `- ${CATEGORY_META[c].label}: ${r.categoryScores[c]?.score ?? "sin datos"}`),
    "",
  ];
  for (const status of ["fail", "improve", "ok", "na"] as CheckStatus[]) {
    const list = r.checks.filter((c) => c.status === status);
    if (!list.length) continue;
    lines.push(`## ${icon[status]} (${list.length})`, "");
    for (const c of list) {
      lines.push(`### ${c.title} · ${CATEGORY_META[c.category].short}`, c.summary);
      if (c.fix) lines.push("", `**Cómo arreglarlo:** ${c.fix}`);
      if (c.evidence?.length) lines.push("", ...c.evidence.map((e) => `- ${e.label}: ${e.value}`));
      if (c.sources.length) lines.push("", ...c.sources.map((s) => `- Doc: [${s.label}](${s.url})`));
      lines.push("");
    }
  }
  return lines.join("\n");
}
