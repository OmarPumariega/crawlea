import * as cheerio from "cheerio";

// Analizador de URL — comprobaciones deterministas sobre el HTML real de una
// página (sin LLM y sin coste de API). Cada comprobación dice qué se ha
// encontrado, si está bien, y cómo arreglarlo. Nada se inventa: todo sale del
// HTML descargado. Importante: analiza el HTML INICIAL (como la primera pasada
// de Google); lo que una web pinte después con JavaScript no se ve aquí.

export type CheckStatus = "ok" | "warn" | "fail" | "info";
export type CategoryId =
  | "indexacion"
  | "titulo"
  | "encabezados"
  | "keyword"
  | "contenido"
  | "imagenes"
  | "datos"
  | "enlaces"
  | "movil";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  indexacion: "URL e indexación",
  titulo: "Título y descripción",
  encabezados: "Encabezados",
  keyword: "Palabra clave",
  contenido: "Contenido",
  imagenes: "Imágenes",
  datos: "Datos estructurados",
  enlaces: "Enlaces",
  movil: "Móvil y redes sociales",
};

export type Check = {
  id: string;
  category: CategoryId;
  title: string;
  status: CheckStatus;
  weight: 1 | 2 | 3; // importancia relativa para la puntuación
  detail: string; // qué se ha encontrado
  fix?: string; // cómo arreglarlo (solo si no está ok)
};

export type Facts = {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1s: string[];
  outline: { level: number; text: string }[]; // encabezados en orden
  wordCount: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  schemaTypes: string[];
  internalLinks: number;
  externalLinks: number;
  htmlKb: number;
  lang: string | null;
};

export type AnalysisResult = {
  url: string;
  finalUrl: string;
  status: number;
  loadMs: number;
  redirects: { from: string; to: string; status: number }[];
  keyword: string | null;
  score: number; // 0-100
  categories: { id: CategoryId; label: string; score: number | null; ok: number; warn: number; fail: number }[];
  checks: Check[];
  facts: Facts;
};

// ── utilidades de texto ───────────────────────────────────────────────────────

function flat(t: string): string {
  const f = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return ` ${f} `;
}

function words(t: string): string[] {
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

function countPhrase(haystackFlat: string, needleFlat: string): number {
  const n = needleFlat.trim();
  if (!n) return 0;
  let count = 0;
  let i = 0;
  const h = haystackFlat;
  const needle = ` ${n} `;
  while ((i = h.indexOf(needle, i)) !== -1) {
    count++;
    i += n.length; // permite solapar el espacio compartido
  }
  return count;
}

function hasAllWords(haystackFlat: string, needleFlat: string): boolean {
  const ws = needleFlat.trim().split(" ").filter(Boolean);
  return ws.length > 0 && ws.every((w) => haystackFlat.includes(` ${w} `));
}

const GENERIC_ANCHORS = new Set([
  "aqui", "click aqui", "clic aqui", "pincha aqui", "haz clic aqui", "leer mas", "ver mas", "mas info",
  "mas informacion", "saber mas", "click here", "read more", "here", "mas", "enlace", "link",
]);

type Cheerio = ReturnType<cheerio.CheerioAPI>;

export function analyzeHtml(input: {
  url: string;
  finalUrl: string;
  status: number;
  loadMs: number;
  redirects: { from: string; to: string; status: number }[];
  html: string;
  headers: { get(name: string): string | null };
  keyword?: string | null;
}): AnalysisResult {
  const { html, finalUrl, status, headers } = input;
  const keyword = input.keyword?.trim() || null;
  const kwFlat = keyword ? flat(keyword) : null;
  const $ = cheerio.load(html);
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const finalU = new URL(finalUrl);

  // ── extracción básica ───────────────────────────────────────────────────────
  const title = $("head title").first().text().trim() || $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description" i]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const robotsMeta = ($('meta[name="robots" i]').attr("content") ?? "").toLowerCase();
  const xRobots = (headers.get("x-robots-tag") ?? "").toLowerCase();
  const lang = $("html").attr("lang")?.trim() || null;

  // Raíz del contenido: <main>/<article> si existen; si no, el body sin
  // cabecera, navegación, pie y laterales.
  const $body = cheerio.load(html);
  $body("script, style, noscript, iframe, svg, template").remove();
  let $root: Cheerio = $body("main, [role=main]").first();
  if ($root.length === 0) $root = $body("article").first();
  if ($root.length === 0) {
    $body("header, nav, footer, aside").remove();
    $root = $body("body");
  }
  const contentText = $root.text().replace(/\s+/g, " ").trim();
  const wordList = words(contentText);
  const wordCount = wordList.length;
  const contentFlat = flat(contentText);

  // ── 1. URL e indexación ─────────────────────────────────────────────────────
  if (status === 200) {
    add({ id: "status", category: "indexacion", title: "Responde correctamente", status: "ok", weight: 3, detail: "La página responde con código 200." });
  } else {
    add({
      id: "status", category: "indexacion", title: "Responde correctamente", status: "fail", weight: 3,
      detail: `La página responde con código ${status}.`,
      fix: status === 404 ? "La URL no existe: corrígela o redirige a la página correcta." : "Una página que no responde con 200 no se indexa. Revisa el servidor o la redirección.",
    });
  }

  if (input.redirects.length === 0) {
    add({ id: "redirects", category: "indexacion", title: "Sin redirecciones", status: "ok", weight: 1, detail: "La URL no redirige." });
  } else {
    add({
      id: "redirects", category: "indexacion", title: "Sin redirecciones", status: "warn", weight: 1,
      detail: `Redirige ${input.redirects.length} vez(es) hasta ${finalUrl}.`,
      fix: "Enlaza y comparte directamente la URL final; cada redirección retrasa la carga y diluye algo de señal.",
    });
  }

  add(
    finalU.protocol === "https:"
      ? { id: "https", category: "indexacion", title: "Usa HTTPS", status: "ok", weight: 2, detail: "La página se sirve por HTTPS." }
      : { id: "https", category: "indexacion", title: "Usa HTTPS", status: "fail", weight: 2, detail: "La página se sirve por HTTP sin cifrar.", fix: "Instala un certificado y redirige todo el tráfico a HTTPS." }
  );

  const noindex = robotsMeta.includes("noindex") || xRobots.includes("noindex");
  add(
    noindex
      ? { id: "noindex", category: "indexacion", title: "Se puede indexar", status: "fail", weight: 3, detail: "Tiene la directiva noindex: Google no la mostrará en los resultados.", fix: "Quita noindex del meta robots (o de la cabecera X-Robots-Tag) si quieres que posicione." }
      : { id: "noindex", category: "indexacion", title: "Se puede indexar", status: "ok", weight: 3, detail: "No bloquea la indexación." }
  );

  if (!canonical) {
    add({ id: "canonical", category: "indexacion", title: "Etiqueta canonical", status: "warn", weight: 2, detail: "No tiene etiqueta canonical.", fix: "Añade <link rel=\"canonical\" href=\"URL-de-esta-página\"> para evitar contenido duplicado por parámetros o variantes." });
  } else {
    let canonUrl: URL | null = null;
    try {
      canonUrl = new URL(canonical, finalUrl);
    } catch {
      canonUrl = null;
    }
    const strip = (u: URL) => `${u.origin}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
    if (canonUrl && strip(canonUrl) === strip(finalU)) {
      add({ id: "canonical", category: "indexacion", title: "Etiqueta canonical", status: "ok", weight: 2, detail: "La canonical apunta a esta misma URL." });
    } else {
      add({
        id: "canonical", category: "indexacion", title: "Etiqueta canonical", status: "warn", weight: 2,
        detail: `La canonical apunta a otra URL (${canonical}): Google tratará esa como la principal.`,
        fix: "Si esta página debe posicionar por sí misma, haz que la canonical apunte a su propia URL.",
      });
    }
  }

  const slug = finalU.pathname;
  const slugIssues: string[] = [];
  if (finalUrl.length > 115) slugIssues.push("es larga (más de 115 caracteres)");
  if (/[A-Z]/.test(slug)) slugIssues.push("tiene mayúsculas");
  if (slug.includes("_")) slugIssues.push("usa guiones bajos en vez de guiones");
  if ([...finalU.searchParams.keys()].length > 2) slugIssues.push("lleva muchos parámetros");
  add(
    slugIssues.length === 0
      ? { id: "slug", category: "indexacion", title: "URL limpia y legible", status: "ok", weight: 1, detail: "La URL es corta, en minúsculas y legible." }
      : { id: "slug", category: "indexacion", title: "URL limpia y legible", status: "warn", weight: 1, detail: `La URL ${slugIssues.join(", ")}.`, fix: "Usa URLs cortas, en minúsculas, con guiones y sin parámetros innecesarios." }
  );

  if (input.loadMs > 3000) {
    add({ id: "speed", category: "indexacion", title: "Tiempo de respuesta", status: "warn", weight: 1, detail: `Descargar la página tardó ${(input.loadMs / 1000).toFixed(1)} s desde nuestros servidores.`, fix: "Revisa el servidor, la caché y el peso de la página. Para métricas reales de velocidad usa la Auditoría (PageSpeed)." });
  } else {
    add({ id: "speed", category: "indexacion", title: "Tiempo de respuesta", status: "ok", weight: 1, detail: `Se descargó en ${(input.loadMs / 1000).toFixed(1)} s desde nuestros servidores.` });
  }

  // ── 2. Título y descripción ─────────────────────────────────────────────────
  if (!title) {
    add({ id: "title", category: "titulo", title: "Etiqueta title", status: "fail", weight: 3, detail: "La página no tiene <title>.", fix: "Añade un título único de unos 50–60 caracteres que describa la página." });
  } else if (title.length < 30) {
    add({ id: "title", category: "titulo", title: "Etiqueta title", status: "warn", weight: 3, detail: `El título tiene ${title.length} caracteres: es corto («${title}»).`, fix: "Amplíalo hasta unos 50–60 caracteres incluyendo la palabra clave y un gancho." });
  } else if (title.length > 65) {
    add({ id: "title", category: "titulo", title: "Etiqueta title", status: "warn", weight: 3, detail: `El título tiene ${title.length} caracteres: Google lo cortará (máx. ~65).`, fix: "Acórtalo a unos 60 caracteres dejando lo importante al principio." });
  } else {
    add({ id: "title", category: "titulo", title: "Etiqueta title", status: "ok", weight: 3, detail: `Título de ${title.length} caracteres, longitud correcta.` });
  }

  if (!metaDescription) {
    add({ id: "description", category: "titulo", title: "Meta descripción", status: "fail", weight: 2, detail: "No tiene meta descripción.", fix: "Escribe una descripción de 70–155 caracteres que resuma la página y anime a hacer clic." });
  } else if (metaDescription.length < 70) {
    add({ id: "description", category: "titulo", title: "Meta descripción", status: "warn", weight: 2, detail: `La meta descripción tiene ${metaDescription.length} caracteres: es corta.`, fix: "Amplíala hasta 70–155 caracteres." });
  } else if (metaDescription.length > 160) {
    add({ id: "description", category: "titulo", title: "Meta descripción", status: "warn", weight: 2, detail: `La meta descripción tiene ${metaDescription.length} caracteres: Google la cortará (máx. ~155).`, fix: "Acórtala a unos 150 caracteres con lo esencial al principio." });
  } else {
    add({ id: "description", category: "titulo", title: "Meta descripción", status: "ok", weight: 2, detail: `Meta descripción de ${metaDescription.length} caracteres, longitud correcta.` });
  }

  // ── 3. Encabezados ──────────────────────────────────────────────────────────
  const outline: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    // Se ignoran los de cabecera/menú/pie: no son la estructura del contenido.
    if ($(el).closest("nav, footer, header[role=banner]").length > 0) return;
    const tag = (el as { tagName?: string }).tagName ?? "h2";
    outline.push({ level: Number(tag.replace(/\D/g, "")) || 2, text: $(el).text().replace(/\s+/g, " ").trim() });
  });
  const h1s = outline.filter((h) => h.level === 1).map((h) => h.text);

  if (h1s.length === 0) {
    add({ id: "h1", category: "encabezados", title: "Un único H1", status: "fail", weight: 3, detail: "La página no tiene ningún H1.", fix: "Añade un H1 que diga de qué trata la página e incluya la palabra clave." });
  } else if (h1s.length > 1) {
    add({ id: "h1", category: "encabezados", title: "Un único H1", status: "warn", weight: 2, detail: `Tiene ${h1s.length} H1: «${h1s.slice(0, 3).join("», «")}».`, fix: "Deja un solo H1 y pasa el resto a H2." });
  } else if (!h1s[0]) {
    add({ id: "h1", category: "encabezados", title: "Un único H1", status: "fail", weight: 3, detail: "El H1 está vacío.", fix: "Escribe el texto del H1: ahora mismo no aporta nada." });
  } else {
    add({ id: "h1", category: "encabezados", title: "Un único H1", status: "ok", weight: 3, detail: `H1: «${h1s[0]}».` });
  }

  const skips: string[] = [];
  let prev = 0;
  for (const h of outline) {
    if (prev > 0 && h.level > prev + 1) skips.push(`H${prev} → H${h.level} («${h.text.slice(0, 40)}»)`);
    prev = h.level;
  }
  const firstIsNotH1 = outline.length > 0 && outline[0].level !== 1;
  const emptyHeadings = outline.filter((h) => !h.text).length;
  const hierarchyProblems: string[] = [];
  if (skips.length) hierarchyProblems.push(`saltos de nivel: ${skips.slice(0, 3).join("; ")}`);
  if (firstIsNotH1) hierarchyProblems.push(`el primer encabezado es un H${outline[0].level}, no un H1`);
  if (emptyHeadings) hierarchyProblems.push(`${emptyHeadings} encabezado(s) vacío(s)`);
  if (outline.length === 0) {
    add({ id: "hierarchy", category: "encabezados", title: "Jerarquía de encabezados", status: "warn", weight: 2, detail: "No hay encabezados.", fix: "Estructura el contenido con H2 y H3 para que se pueda leer y para que Google entienda los temas." });
  } else if (hierarchyProblems.length) {
    add({ id: "hierarchy", category: "encabezados", title: "Jerarquía de encabezados", status: "warn", weight: 2, detail: `Problemas: ${hierarchyProblems.join(" · ")}.`, fix: "Sigue el orden H1 → H2 → H3 sin saltarte niveles y sin encabezados vacíos." });
  } else {
    add({ id: "hierarchy", category: "encabezados", title: "Jerarquía de encabezados", status: "ok", weight: 2, detail: `${outline.length} encabezado(s) en orden correcto, sin saltos.` });
  }

  const h2Count = outline.filter((h) => h.level === 2).length;
  if (wordCount >= 600 && h2Count < 2) {
    add({ id: "sections", category: "encabezados", title: "Contenido dividido en secciones", status: "warn", weight: 1, detail: `Con ${wordCount} palabras solo hay ${h2Count} H2.`, fix: "Divide el texto en apartados con H2 descriptivos: se lee mejor y abre la puerta a más keywords." });
  }

  // ── 4. Palabra clave ────────────────────────────────────────────────────────
  if (!kwFlat) {
    add({ id: "kw-none", category: "keyword", title: "Palabra clave objetivo", status: "info", weight: 1, detail: "No has indicado una palabra clave.", fix: "Escribe la keyword para la que quieres posicionar esta URL y vuelve a analizar: se comprueba título, H1, URL, texto y densidad." });
  } else {
    const titleFlat = flat(title ?? "");
    const descFlat = flat(metaDescription ?? "");
    const h1Flat = flat(h1s[0] ?? "");
    const slugFlat = flat(decodeURIComponent(finalU.pathname).replace(/[-_/]/g, " "));

    const where = (f: string, label: string, weight: 1 | 2 | 3, idKey: string, fixText: string, severity: "fail" | "warn") => {
      if (countPhrase(f, kwFlat) > 0) {
        add({ id: idKey, category: "keyword", title: `La keyword está en ${label}`, status: "ok", weight, detail: `«${keyword}» aparece en ${label}.` });
      } else if (hasAllWords(f, kwFlat)) {
        add({ id: idKey, category: "keyword", title: `La keyword está en ${label}`, status: "warn", weight, detail: `Aparecen las palabras de «${keyword}» pero no la frase exacta en ${label}.`, fix: fixText });
      } else {
        add({ id: idKey, category: "keyword", title: `La keyword está en ${label}`, status: severity, weight, detail: `«${keyword}» no aparece en ${label}.`, fix: fixText });
      }
    };
    where(titleFlat, "el título", 3, "kw-title", "Incluye la keyword en el título, mejor cerca del principio.", "fail");
    where(h1Flat, "el H1", 3, "kw-h1", "Incluye la keyword en el H1 (de forma natural, no repetida).", "fail");
    where(descFlat, "la meta descripción", 1, "kw-desc", "Menciona la keyword en la descripción: Google la resalta en negrita.", "warn");
    where(slugFlat, "la URL", 1, "kw-slug", "Si puedes, incluye la keyword en la URL (con guiones). Si la página ya está posicionada, no la cambies sin redirigir.", "warn");

    const first100 = flat(wordList.slice(0, 100).join(" "));
    where(first100, "las primeras 100 palabras", 2, "kw-intro", "Nombra la keyword en el primer párrafo: ayuda a Google y al lector a confirmar el tema.", "warn");

    const occurrences = countPhrase(contentFlat, kwFlat);
    const density = wordCount > 0 ? (occurrences * kwFlat.trim().split(" ").length * 100) / wordCount : 0;
    if (occurrences === 0) {
      add({ id: "kw-density", category: "keyword", title: "Presencia en el texto", status: "fail", weight: 3, detail: `«${keyword}» no aparece ni una vez en el texto de la página.`, fix: "Escribe contenido que trate esta keyword y úsala de forma natural en el cuerpo." });
    } else if (density > 3 && wordCount >= 100) {
      add({ id: "kw-density", category: "keyword", title: "Presencia en el texto", status: "warn", weight: 2, detail: `Aparece ${occurrences} veces (${density.toFixed(1)} % del texto): puede parecer relleno.`, fix: "Reduce repeticiones y usa sinónimos y variantes; apunta a menos de un 3 %." });
    } else if (density < 0.3 && wordCount >= 300) {
      add({ id: "kw-density", category: "keyword", title: "Presencia en el texto", status: "warn", weight: 1, detail: `Aparece ${occurrences} ${occurrences === 1 ? "vez" : "veces"} (${density.toFixed(2)} % del texto): muy poco.`, fix: "Refuerza el tema con la keyword y sus variantes en los apartados relevantes." });
    } else {
      add({ id: "kw-density", category: "keyword", title: "Presencia en el texto", status: "ok", weight: 2, detail: wordCount >= 100 ? `Aparece ${occurrences} ${occurrences === 1 ? "vez" : "veces"} (${density.toFixed(1)} % del texto).` : `Aparece ${occurrences} ${occurrences === 1 ? "vez" : "veces"} (el texto es demasiado corto para medir la densidad).` });
    }
  }

  // ── 5. Contenido ────────────────────────────────────────────────────────────
  if (wordCount < 150) {
    add({ id: "words", category: "contenido", title: "Contenido suficiente", status: "fail", weight: 3, detail: `Solo ${wordCount} palabras de contenido.`, fix: "Es muy poco para posicionar. Amplía con contenido útil que responda por completo a lo que busca el usuario." });
  } else if (wordCount < 300) {
    add({ id: "words", category: "contenido", title: "Contenido suficiente", status: "warn", weight: 3, detail: `${wordCount} palabras de contenido: queda justo.`, fix: "Apunta al menos a 300 palabras útiles; en búsquedas informativas, bastante más. Mira qué cubre el top 10 en TF-IDF." });
  } else {
    add({ id: "words", category: "contenido", title: "Contenido suficiente", status: "ok", weight: 3, detail: `${wordCount} palabras de contenido.` });
  }

  const sentences = contentText.split(/[.!?]+\s/).map((s) => words(s).length).filter((n) => n > 0);
  const avgSentence = sentences.length ? sentences.reduce((a, b) => a + b, 0) / sentences.length : 0;
  if (wordCount >= 150) {
    add(
      avgSentence > 26
        ? { id: "readability", category: "contenido", title: "Frases fáciles de leer", status: "warn", weight: 1, detail: `Las frases tienen de media ${avgSentence.toFixed(0)} palabras: son largas.`, fix: "Divide las frases largas; lo ideal es una media de 15–20 palabras." }
        : { id: "readability", category: "contenido", title: "Frases fáciles de leer", status: "ok", weight: 1, detail: `Longitud media de frase: ${avgSentence.toFixed(0)} palabras.` }
    );
  }

  const scripts = $("script[src]").length;
  const emptyRoot = ["#root", "#app", "#__next", "#__nuxt"].some((sel) => $(sel).length > 0 && $(sel).text().trim().length < 50);
  if (wordCount < 100 && (scripts > 8 || emptyRoot)) {
    add({ id: "js", category: "contenido", title: "Contenido visible sin JavaScript", status: "warn", weight: 2, detail: "Casi no hay texto en el HTML inicial y la página carga muchos scripts: probablemente se pinta con JavaScript.", fix: "Google puede tardar en ver ese contenido. Usa renderizado en servidor (SSR) o pre-render para lo importante." });
  }

  // ── 6. Imágenes ─────────────────────────────────────────────────────────────
  const $imgs = cheerio.load(html);
  $imgs("script, style, noscript, svg").remove();
  let $scope: Cheerio = $imgs("main, [role=main]").first();
  if ($scope.length === 0) $scope = $imgs("article").first();
  if ($scope.length === 0) $scope = $imgs("body");
  const imgs = $scope.find("img").toArray().filter((el) => {
    const w = Number($imgs(el).attr("width"));
    const h = Number($imgs(el).attr("height"));
    return !(w > 0 && w <= 2 && h > 0 && h <= 2); // píxeles de seguimiento
  });
  const imagesTotal = imgs.length;
  const noAlt = imgs.filter((el) => $imgs(el).attr("alt") === undefined).length;
  const emptyAlt = imgs.filter((el) => $imgs(el).attr("alt") === "").length;
  const noSize = imgs.filter((el) => !$imgs(el).attr("width") || !$imgs(el).attr("height")).length;
  const lazy = imgs.filter((el) => $imgs(el).attr("loading") === "lazy").length;

  if (imagesTotal === 0) {
    if (wordCount >= 300) {
      add({ id: "img-none", category: "imagenes", title: "Imágenes en el contenido", status: "info", weight: 1, detail: "La página no tiene imágenes en el contenido.", fix: "Una o dos imágenes relevantes (con alt descriptivo) mejoran la experiencia y pueden traer visitas desde Google Imágenes." });
    }
  } else {
    add(
      noAlt === 0
        ? { id: "img-alt", category: "imagenes", title: "Texto alternativo (alt)", status: "ok", weight: 2, detail: `Las ${imagesTotal} imágenes tienen atributo alt${emptyAlt ? ` (${emptyAlt} vacío/s, válido si son decorativas)` : ""}.` }
        : { id: "img-alt", category: "imagenes", title: "Texto alternativo (alt)", status: noAlt / imagesTotal > 0.5 ? "fail" : "warn", weight: 2, detail: `${noAlt} de ${imagesTotal} imágenes no tienen atributo alt.`, fix: "Describe cada imagen en su alt (qué se ve, no «imagen1»). Si es decorativa, déjalo vacío: alt=\"\"." }
    );
    add(
      noSize === 0
        ? { id: "img-size", category: "imagenes", title: "Dimensiones declaradas", status: "ok", weight: 1, detail: "Todas las imágenes declaran ancho y alto." }
        : { id: "img-size", category: "imagenes", title: "Dimensiones declaradas", status: "warn", weight: 1, detail: `${noSize} de ${imagesTotal} imágenes no declaran width y height.`, fix: "Añade width y height: evita que el contenido «salte» al cargar (mejora el CLS)." }
    );
    if (imagesTotal > 5 && lazy === 0) {
      add({ id: "img-lazy", category: "imagenes", title: "Carga diferida", status: "warn", weight: 1, detail: `${imagesTotal} imágenes y ninguna con carga diferida.`, fix: "Añade loading=\"lazy\" a las que quedan por debajo de la primera pantalla." });
    }
    if (kwFlat) {
      const kwInAlt = imgs.some((el) => countPhrase(flat($imgs(el).attr("alt") ?? ""), kwFlat) > 0 || hasAllWords(flat($imgs(el).attr("alt") ?? ""), kwFlat));
      add(
        kwInAlt
          ? { id: "kw-alt", category: "keyword", title: "La keyword está en algún alt", status: "ok", weight: 1, detail: "Al menos una imagen menciona la keyword en su alt." }
          : { id: "kw-alt", category: "keyword", title: "La keyword está en algún alt", status: "info", weight: 1, detail: "Ninguna imagen menciona la keyword en su alt.", fix: "Si encaja, describe una imagen principal usando la keyword (sin forzarlo)." }
      );
    }
  }

  // ── 7. Datos estructurados ──────────────────────────────────────────────────
  const schemaTypes: string[] = [];
  let invalidJsonLd = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;
        const o = node as Record<string, unknown>;
        if (Array.isArray(o["@graph"])) stack.push(...(o["@graph"] as unknown[]));
        const t = o["@type"];
        if (typeof t === "string") schemaTypes.push(t);
        else if (Array.isArray(t)) schemaTypes.push(...t.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      invalidJsonLd++;
    }
  });
  const microdata = $("[itemscope]").length > 0;
  const uniqueTypes = [...new Set(schemaTypes)];
  if (invalidJsonLd > 0) {
    add({ id: "schema-valid", category: "datos", title: "JSON-LD válido", status: "fail", weight: 2, detail: `${invalidJsonLd} bloque(s) JSON-LD tienen errores de sintaxis y Google los ignorará.`, fix: "Corrígelos o genera uno nuevo en el módulo Schema." });
  }
  if (uniqueTypes.length === 0 && !microdata) {
    add({ id: "schema", category: "datos", title: "Datos estructurados", status: "warn", weight: 2, detail: "No hay datos estructurados (schema.org).", fix: "Añade JSON-LD adecuado al tipo de página: puede dar resultados enriquecidos. Genéralo en el módulo Schema." });
  } else if (uniqueTypes.length === 0) {
    add({ id: "schema", category: "datos", title: "Datos estructurados", status: "info", weight: 2, detail: "Hay microdatos (itemscope) pero ningún bloque JSON-LD.", fix: "Google recomienda JSON-LD; considera migrarlo." });
  } else {
    add({ id: "schema", category: "datos", title: "Datos estructurados", status: "ok", weight: 2, detail: `Tipos detectados: ${uniqueTypes.join(", ")}.` });
  }
  const isHome = finalU.pathname === "/" || finalU.pathname === "";
  const lowerTypes = uniqueTypes.map((t) => t.toLowerCase());
  const looksLikeArticle = $("article").length > 0 || $('meta[property="og:type"]').attr("content") === "article";
  if (isHome && uniqueTypes.length > 0 && !lowerTypes.some((t) => ["organization", "website", "localbusiness", "professionalservice"].includes(t) || t.endsWith("business"))) {
    add({ id: "schema-home", category: "datos", title: "Tipo adecuado para la home", status: "warn", weight: 1, detail: "La home no declara Organization, WebSite ni LocalBusiness.", fix: "Añade el esquema de la organización o del negocio local." });
  }
  if (!isHome && looksLikeArticle && uniqueTypes.length > 0 && !lowerTypes.some((t) => ["article", "blogposting", "newsarticle"].includes(t))) {
    add({ id: "schema-article", category: "datos", title: "Tipo adecuado para un artículo", status: "warn", weight: 1, detail: "Parece un artículo pero no declara Article ni BlogPosting.", fix: "Añade el esquema Article/BlogPosting con autor y fechas." });
  }

  // ── 8. Enlaces ──────────────────────────────────────────────────────────────
  const host = finalU.hostname.replace(/^www\./, "");
  let internal = 0;
  let external = 0;
  let genericAnchors = 0;
  let emptyAnchors = 0;
  $root.find("a[href]").each((_, el) => {
    const href = ($body(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    let u: URL;
    try {
      u = new URL(href, finalUrl);
    } catch {
      return;
    }
    if (u.hostname.replace(/^www\./, "") === host) internal++;
    else external++;
    const text = $body(el).text().replace(/\s+/g, " ").trim();
    const hasImgAlt = $body(el).find("img[alt]").filter((__, im) => ($body(im).attr("alt") ?? "").trim().length > 0).length > 0;
    if (!text && !hasImgAlt && !$body(el).attr("aria-label")) emptyAnchors++;
    else if (GENERIC_ANCHORS.has(flat(text).trim())) genericAnchors++;
  });
  if (wordCount >= 300) {
    add(
      internal >= 3
        ? { id: "links-internal", category: "enlaces", title: "Enlaces internos", status: "ok", weight: 2, detail: `${internal} enlaces internos en el contenido.` }
        : { id: "links-internal", category: "enlaces", title: "Enlaces internos", status: "warn", weight: 2, detail: `Solo ${internal} enlace(s) interno(s) en el contenido.`, fix: "Enlaza a 3 o más páginas relacionadas de tu web con anchors descriptivos. Las sugerencias de Auditoría → Enlaces te dicen cuáles." }
    );
  }
  if (genericAnchors > 0) {
    add({ id: "links-generic", category: "enlaces", title: "Anchors descriptivos", status: "warn", weight: 1, detail: `${genericAnchors} enlace(s) con texto genérico («aquí», «leer más»…).`, fix: "Usa como texto del enlace lo que encontrará el usuario al hacer clic." });
  }
  if (emptyAnchors > 0) {
    add({ id: "links-empty", category: "enlaces", title: "Enlaces con texto", status: "warn", weight: 1, detail: `${emptyAnchors} enlace(s) sin texto ni alt de imagen.`, fix: "Añade texto visible, aria-label o un alt a la imagen del enlace." });
  }
  add({ id: "links-broken", category: "enlaces", title: "Enlaces rotos", status: "info", weight: 1, detail: "Aquí no se comprueba si los enlaces funcionan.", fix: "La Auditoría rastrea todo el sitio y los detecta." });

  // ── 9. Móvil y redes sociales ───────────────────────────────────────────────
  add(
    $('meta[name="viewport" i]').length > 0
      ? { id: "viewport", category: "movil", title: "Adaptada a móvil (viewport)", status: "ok", weight: 2, detail: "Declara la etiqueta viewport." }
      : { id: "viewport", category: "movil", title: "Adaptada a móvil (viewport)", status: "fail", weight: 2, detail: "Falta la etiqueta viewport.", fix: "Añade <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">." }
  );
  add(
    lang
      ? { id: "lang", category: "movil", title: "Idioma declarado", status: "ok", weight: 1, detail: `Idioma: ${lang}.` }
      : { id: "lang", category: "movil", title: "Idioma declarado", status: "warn", weight: 1, detail: "La etiqueta <html> no declara el idioma.", fix: "Añade lang=\"es\" (o el que toque) a <html>." }
  );
  const og = ["og:title", "og:description", "og:image"].filter((p) => !$(`meta[property="${p}"]`).attr("content"));
  add(
    og.length === 0
      ? { id: "og", category: "movil", title: "Open Graph (redes sociales)", status: "ok", weight: 1, detail: "Tiene título, descripción e imagen para compartir." }
      : { id: "og", category: "movil", title: "Open Graph (redes sociales)", status: "warn", weight: 1, detail: `Faltan: ${og.join(", ")}.`, fix: "Añádelos para que se vea bien al compartir la URL en redes y mensajería." }
  );

  // Cuando algo no está bien, el título dice el PROBLEMA («Falta la keyword en el
  // título»), no el criterio («La keyword está en el título»), que leído en una
  // lista de errores sugería justo lo contrario.
  for (const c of checks) {
    if (c.status === "warn" || c.status === "fail") c.title = problemTitle(c);
  }

  // ── puntuación ──────────────────────────────────────────────────────────────
  const value = (s: CheckStatus) => (s === "ok" ? 1 : s === "warn" ? 0.5 : 0);
  const scored = checks.filter((c) => c.status !== "info");
  const totalW = scored.reduce((s, c) => s + c.weight, 0);
  const score = totalW > 0 ? Math.round((scored.reduce((s, c) => s + c.weight * value(c.status), 0) / totalW) * 100) : 0;

  const categories = (Object.keys(CATEGORY_LABELS) as CategoryId[])
    .map((id) => {
      const cs = checks.filter((c) => c.category === id);
      const sc = cs.filter((c) => c.status !== "info");
      const w = sc.reduce((s, c) => s + c.weight, 0);
      return {
        id,
        label: CATEGORY_LABELS[id],
        score: w > 0 ? Math.round((sc.reduce((s, c) => s + c.weight * value(c.status), 0) / w) * 100) : null,
        ok: cs.filter((c) => c.status === "ok").length,
        warn: cs.filter((c) => c.status === "warn").length,
        fail: cs.filter((c) => c.status === "fail").length,
      };
    })
    .filter((c) => checks.some((x) => x.category === c.id));

  return {
    url: input.url,
    finalUrl,
    status,
    loadMs: input.loadMs,
    redirects: input.redirects,
    keyword,
    score,
    categories,
    checks,
    facts: {
      title,
      metaDescription,
      canonical,
      h1s,
      outline,
      wordCount,
      imagesTotal,
      imagesMissingAlt: noAlt,
      schemaTypes: uniqueTypes,
      internalLinks: internal,
      externalLinks: external,
      htmlKb: Math.round(Buffer.byteLength(html, "utf-8") / 1024),
      lang,
    },
  };
}

function problemTitle(c: Check): string {
  const d = c.detail;
  const partial = d.includes("pero no la frase exacta");
  const kw = (where: string) => (partial ? `La frase exacta de la keyword no está en ${where}` : `Falta la keyword en ${where}`);
  switch (c.id) {
    case "status": return "La página no responde con código 200";
    case "redirects": return "La URL redirige a otra";
    case "https": return "La página no usa HTTPS";
    case "noindex": return "La página bloquea la indexación";
    case "canonical": return d.startsWith("No tiene") ? "Falta la etiqueta canonical" : "La canonical apunta a otra URL";
    case "slug": return "La URL no es limpia";
    case "speed": return "La página tarda en responder";
    case "title": return d.startsWith("La página no tiene") ? "Falta el título" : d.includes("es corto") ? "El título es demasiado corto" : "El título es demasiado largo";
    case "description": return d.startsWith("No tiene") ? "Falta la meta descripción" : d.includes("corta") ? "La meta descripción es demasiado corta" : "La meta descripción es demasiado larga";
    case "h1": return d.startsWith("La página no tiene") ? "Falta el H1" : d.includes("vacío") ? "El H1 está vacío" : "Hay más de un H1";
    case "hierarchy": return d.startsWith("No hay") ? "La página no tiene encabezados" : "La jerarquía de encabezados tiene problemas";
    case "sections": return "El contenido no está dividido en secciones";
    case "kw-title": return kw("el título");
    case "kw-h1": return kw("el H1");
    case "kw-desc": return kw("la meta descripción");
    case "kw-slug": return kw("la URL");
    case "kw-intro": return kw("las primeras 100 palabras");
    case "kw-density": return d.includes("no aparece ni una vez") ? "La keyword no aparece en el texto" : d.includes("relleno") ? "La keyword se repite demasiado" : "La keyword aparece muy poco en el texto";
    case "words": return c.status === "fail" ? "Hay muy poco contenido" : "El contenido es justo";
    case "readability": return "Las frases son demasiado largas";
    case "js": return "El contenido depende de JavaScript";
    case "img-alt": return "Hay imágenes sin texto alternativo (alt)";
    case "img-size": return "Hay imágenes sin ancho y alto declarados";
    case "img-lazy": return "Las imágenes no usan carga diferida";
    case "schema-valid": return "Hay JSON-LD con errores";
    case "schema": return "No hay datos estructurados";
    case "schema-home": return "La home no declara el tipo de esquema adecuado";
    case "schema-article": return "El artículo no declara el esquema Article";
    case "links-internal": return "Hay pocos enlaces internos";
    case "links-generic": return "Hay enlaces con texto genérico";
    case "links-empty": return "Hay enlaces sin texto";
    case "viewport": return "Falta la etiqueta viewport (móvil)";
    case "lang": return "Falta declarar el idioma de la página";
    case "og": return "Faltan etiquetas Open Graph";
    default: return c.title;
  }
}
