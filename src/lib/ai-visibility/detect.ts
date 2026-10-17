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

// En consultas locales ChatGPT cita fichas de Google Maps (google.com/maps/...)
// con el nombre del negocio como título: el dominio no dice nada (todos son
// google.com), la identidad útil es el título. Se usa como "dominio" visible.
function isMapsLink(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

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
    const title = a.title?.trim() || null;
    sources.push({ domain: isMapsLink(a.url) && title ? title : rootDomain(a.url), url: a.url, title });
  }

  // Posición = índice entre DOMINIOS distintos (varias URLs del mismo dominio
  // cuentan una vez), 1-based.
  const domainsInOrder: string[] = [];
  for (const s of sources) if (!domainsInOrder.includes(s.domain)) domainsInOrder.push(s.domain);
  // Fichas de Maps: no son dominios, se comparan por nombre de negocio.
  const brandKeys = [domain.split(".")[0], ...input.brandNames].map((n) => n.trim()).filter((n) => n.length >= 4);
  const isOwnEntry = (d: string) =>
    d.includes(".") && !d.includes(" ")
      ? sameSite(d, domain)
      : brandKeys.some((b) => normalizeText(d).includes(normalizeText(b)));
  const idx = domainsInOrder.findIndex(isOwnEntry);

  const text = normalizeText(input.answer);
  const names = [domain, ...input.brandNames.map((n) => n.trim()).filter((n) => n.length >= 4)];
  const mentioned = names.some((n) => text.includes(normalizeText(n)));

  return { cited: idx >= 0, mentioned, citedRank: idx >= 0 ? idx + 1 : null, sources };
}
