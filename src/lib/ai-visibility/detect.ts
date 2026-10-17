// Detección de visibilidad en la respuesta de un asistente de IA. Pura (sin
// red ni BD) para poder probarla con respuestas reales guardadas.
//
//   cited     → el dominio del proyecto está entre las fuentes citadas
//               (annotations de la respuesta, con búsqueda web activa).
//   mentioned → el dominio o el nombre de la marca aparecen en el TEXTO.
//   citedRank → posición del dominio entre las fuentes distintas citadas.
// Sin búsqueda web el modelo no cita nada: cited=false no significa "no
// existes", significa "no te ha citado". La UI lo explica.

export type AiSource = { domain: string; url: string; title: string | null };

export type AiDetection = {
  cited: boolean;
  mentioned: boolean;
  citedRank: number | null;
  sources: AiSource[];
};

export function rootDomain(input: string): string {
  try {
    const host = input.includes("://") ? new URL(input).hostname : input.split("/")[0];
    return host.toLowerCase().replace(/^www\./, "");
  } catch {
    return input.toLowerCase().replace(/^www\./, "");
  }
}

function sameSite(sourceDomain: string, projectDomain: string): boolean {
  return sourceDomain === projectDomain || sourceDomain.endsWith(`.${projectDomain}`);
}

function normalizeText(t: string): string {
  // Sin tildes ni puntuación ("Blanco, González y Mier" = "Blanco González y Mier").
  const flat = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return ` ${flat} `;
}

export function detectVisibility(input: {
  answer: string;
  annotations: { url?: string | null; title?: string | null }[];
  projectDomain: string;
  brandNames: string[];
}): AiDetection {
  const domain = rootDomain(input.projectDomain);

  // Fuentes únicas por URL, en el orden en que el modelo las citó.
  const seen = new Set<string>();
  const sources: AiSource[] = [];
  for (const a of input.annotations) {
    if (!a.url || seen.has(a.url)) continue;
    seen.add(a.url);
    sources.push({ domain: rootDomain(a.url), url: a.url, title: a.title?.trim() || null });
  }

  // Posición = índice entre DOMINIOS distintos (varias URLs del mismo dominio
  // cuentan una vez), 1-based.
  const domainsInOrder: string[] = [];
  for (const s of sources) if (!domainsInOrder.includes(s.domain)) domainsInOrder.push(s.domain);
  const idx = domainsInOrder.findIndex((d) => sameSite(d, domain));

  const text = normalizeText(input.answer);
  const names = [domain, ...input.brandNames.map((n) => n.trim()).filter((n) => n.length >= 4)];
  const mentioned = names.some((n) => text.includes(normalizeText(n)));

  return { cited: idx >= 0, mentioned, citedRank: idx >= 0 ? idx + 1 : null, sources };
}
