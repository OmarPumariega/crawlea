import { callRoute, McpToolError, type RouteLoader } from "@/lib/mcp/invoke";
import { buildProjectContext } from "@/lib/copilot/context";

// Catálogo de herramientas del MCP de Crawlea. Cada una es una envoltura fina
// sobre un handler de la API de la web (invoke.ts): la lógica, las validaciones
// y los guards de gasto son los de siempre. Aquí solo se decide qué se expone,
// cómo se llama y qué avisa su descripción sobre el coste.
//
// Regla: una herramienta que gasta (DataForSEO / OpenRouter) lo dice en su
// descripción con el coste aproximado, para que Claude lo tenga en cuenta antes
// de lanzarla. El tope de gasto del proyecto y la bolsa de créditos de la
// cuenta se aplican igualmente en el servidor.

type Args = Record<string, unknown>;
type JsonSchema = Record<string, unknown>;

export type McpTool = {
  name: string;
  description: string;
  properties: Record<string, JsonSchema>;
  required: string[];
  /** true → exige `projectId` y el dispatcher comprueba que es de la cuenta. */
  project: boolean;
  run: (args: Args, pid: string) => Promise<unknown>;
};

// Loaders perezosos: el endpoint /api/mcp no carga los ~30 módulos de ruta
// hasta que una herramienta los necesita.
const R = {
  projects: () => import("@/app/api/proyectos/route"),
  project: () => import("@/app/api/proyectos/[id]/route"),
  todos: () => import("@/app/api/proyectos/[id]/todos/route"),
  todo: () => import("@/app/api/proyectos/[id]/todos/[todoId]/route"),
  notes: () => import("@/app/api/proyectos/[id]/notas/route"),
  studies: () => import("@/app/api/proyectos/[id]/keywords/estudios/route"),
  study: () => import("@/app/api/proyectos/[id]/keywords/estudios/[studyId]/route"),
  suggestions: () => import("@/app/api/proyectos/[id]/keywords/estudios/[studyId]/sugerencias/route"),
  studyKeywords: () => import("@/app/api/proyectos/[id]/keywords/estudios/[studyId]/keywords/route"),
  structure: () => import("@/app/api/proyectos/[id]/keywords/estudios/[studyId]/estructura/route"),
  rankKeywords: () => import("@/app/api/proyectos/[id]/rank/keywords/route"),
  rankCheck: () => import("@/app/api/proyectos/[id]/rank/keywords/[kwId]/check/route"),
  rankHistory: () => import("@/app/api/proyectos/[id]/rank/keywords/[kwId]/historico/route"),
  rankImport: () => import("@/app/api/proyectos/[id]/rank/importar/route"),
  rankVisibility: () => import("@/app/api/proyectos/[id]/rank/visibilidad/route"),
  geogrid: () => import("@/app/api/proyectos/[id]/geogrid/route"),
  geogridRun: () => import("@/app/api/proyectos/[id]/geogrid/[runId]/route"),
  audits: () => import("@/app/api/proyectos/[id]/auditorias/route"),
  audit: () => import("@/app/api/proyectos/[id]/auditorias/[auditId]/route"),
  opportunities: () => import("@/app/api/proyectos/[id]/oportunidades/route"),
  competitors: () => import("@/app/api/proyectos/[id]/competidores/route"),
  competitorAnalyze: () => import("@/app/api/proyectos/[id]/competidores/analizar/route"),
  competitorGap: () => import("@/app/api/proyectos/[id]/competidores/[competitorId]/content-gap/route"),
  backlinks: () => import("@/app/api/proyectos/[id]/backlinks/route"),
  backlinksAnalyze: () => import("@/app/api/proyectos/[id]/backlinks/analizar/route"),
  gsc: () => import("@/app/api/proyectos/[id]/google/search-console/route"),
  ga4: () => import("@/app/api/proyectos/[id]/google/analytics/route"),
  tfidf: () => import("@/app/api/proyectos/[id]/tfidf/route"),
  titleMeta: () => import("@/app/api/proyectos/[id]/titulos-meta/route"),
  content: () => import("@/app/api/proyectos/[id]/contenido/route"),
  analyzer: () => import("@/app/api/proyectos/[id]/analizador/route"),
  speed: () => import("@/app/api/proyectos/[id]/velocidad/route"),
  aiOverview: () => import("@/app/api/proyectos/[id]/ia/overview/comprobar/route"),
  measurements: () => import("@/app/api/proyectos/[id]/mediciones/route"),
} satisfies Record<string, RouteLoader>;

const str = (description: string): JsonSchema => ({ type: "string", description });
const num = (description: string): JsonSchema => ({ type: "number", description });
const strList = (description: string): JsonSchema => ({
  type: "array",
  items: { type: "string" },
  description,
});

const LOCATION = num(
  "Código de ubicación de DataForSEO. 2724 = España (nacional, por defecto). Otros: 2840 EE. UU., 2484 México, 2032 Argentina, 2170 Colombia."
);
const LANGUAGE = str("Código de idioma de 2 letras (por defecto «es»).");

function s(a: Args, key: string): string | undefined {
  const v = a[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function need(a: Args, key: string): string {
  const v = s(a, key);
  if (!v) throw new McpToolError(`Falta el parámetro «${key}»`);
  return v;
}
function pick(a: Args, keys: string[]): Args {
  const out: Args = {};
  for (const k of keys) if (a[k] !== undefined) out[k] = a[k];
  return out;
}
function escapeHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tool(
  name: string,
  description: string,
  opts: {
    properties?: Record<string, JsonSchema>;
    required?: string[];
    project?: boolean;
    run: McpTool["run"];
  }
): McpTool {
  const project = opts.project ?? true;
  return {
    name,
    description,
    project,
    properties: {
      ...(project ? { projectId: str("ID del proyecto (lo da list_projects).") } : {}),
      ...(opts.properties ?? {}),
    },
    required: [...(project ? ["projectId"] : []), ...(opts.required ?? [])],
    run: opts.run,
  };
}

export const TOOLS: McpTool[] = [
  // ───────────── Proyectos ─────────────
  tool("list_projects", "Lista los proyectos de la cuenta (id, nombre, dominio, si es negocio local, Search Console/GA4 conectados). Empieza siempre por aquí para conseguir el projectId.", {
    project: false,
    run: async () => {
      const rows = (await callRoute(R.projects, "GET")) as Array<Record<string, unknown>>;
      return rows.map((p) =>
        pick(p, ["id", "name", "domain", "isLocalBusiness", "businessName", "address", "lat", "lng", "gscSiteUrl", "ga4PropertyId", "createdAt"])
      );
    },
  }),
  tool("get_project_overview", "Resumen en texto de los datos REALES del proyecto: última auditoría, posiciones, Search Console, GA4, competidores, backlinks, SEO local, velocidad y gasto del mes. Es la mejor primera lectura de un proyecto.", {
    run: async (_a, pid) => ({ overview: await buildProjectContext(pid) }),
  }),
  tool("create_project", "Crea un proyecto (cliente/dominio). Respeta el límite de proyectos del plan.", {
    project: false,
    properties: {
      name: str("Nombre del proyecto"),
      domain: str("Dominio sin https:// (ej. ejemplo.com)"),
      isLocalBusiness: { type: "boolean", description: "true si es un negocio local (activa SEO local/geogrid)" },
      businessName: str("Nombre del negocio (NAP)"),
      address: str("Dirección (NAP)"),
      phone: str("Teléfono (NAP)"),
      lat: num("Latitud del negocio (necesaria para geogrid)"),
      lng: num("Longitud del negocio (necesaria para geogrid)"),
    },
    required: ["name"],
    run: async (a) =>
      callRoute(R.projects, "POST", {
        body: pick(a, ["name", "domain", "isLocalBusiness", "businessName", "address", "phone", "lat", "lng"]),
      }),
  }),
  tool("update_project", "Edita datos del proyecto (solo los campos que envíes). Útil para fijar lat/lng y activar el SEO local antes de lanzar un geogrid, o para fijar la propiedad de Search Console/GA4.", {
    properties: {
      name: str("Nombre"),
      domain: str("Dominio"),
      isLocalBusiness: { type: "boolean", description: "Es negocio local" },
      businessName: str("Nombre del negocio"),
      address: str("Dirección"),
      phone: str("Teléfono"),
      lat: num("Latitud"),
      lng: num("Longitud"),
      gscSiteUrl: str("Propiedad de Search Console"),
      ga4PropertyId: str("ID de propiedad de GA4"),
    },
    run: async (a, pid) =>
      callRoute(R.project, "PATCH", {
        params: { id: pid },
        body: pick(a, ["name", "domain", "isLocalBusiness", "businessName", "address", "phone", "lat", "lng", "gscSiteUrl", "ga4PropertyId"]),
      }),
  }),

  // ───────────── Tareas y notas ─────────────
  tool("list_tasks", "Lista las tareas del proyecto (manuales y generadas por auditoría), pendientes primero.", {
    run: async (_a, pid) => callRoute(R.todos, "GET", { params: { id: pid } }),
  }),
  tool("create_task", "Crea una tarea manual en el proyecto.", {
    properties: {
      title: str("Título de la tarea"),
      detail: str("Detalle opcional"),
      priority: { type: "string", enum: ["baja", "media", "alta"], description: "Prioridad (por defecto media)" },
      dueDate: str("Fecha límite ISO (YYYY-MM-DD), opcional"),
    },
    required: ["title"],
    run: async (a, pid) =>
      callRoute(R.todos, "POST", { params: { id: pid }, body: pick(a, ["title", "detail", "priority", "dueDate"]) }),
  }),
  tool("update_task", "Edita o completa una tarea (done=true la marca como hecha).", {
    properties: {
      taskId: str("ID de la tarea (lo da list_tasks)"),
      title: str("Nuevo título"),
      detail: str("Nuevo detalle"),
      priority: { type: "string", enum: ["baja", "media", "alta"] },
      dueDate: str("Fecha límite ISO o vacío para quitarla"),
      done: { type: "boolean", description: "Marcar como hecha / pendiente" },
    },
    required: ["taskId"],
    run: async (a, pid) =>
      callRoute(R.todo, "PATCH", {
        params: { id: pid, todoId: need(a, "taskId") },
        body: pick(a, ["title", "detail", "priority", "dueDate", "done"]),
      }),
  }),
  tool("list_notes", "Lista los apuntes internos del proyecto (acuerdos, contactos, cosas a recordar).", {
    run: async (_a, pid) => callRoute(R.notes, "GET", { params: { id: pid } }),
  }),
  tool("create_note", "Añade un apunte interno al proyecto. El contenido es texto plano (los saltos de línea se respetan).", {
    properties: { title: str("Título opcional"), content: str("Texto del apunte") },
    required: ["content"],
    run: async (a, pid) => {
      const html = need(a, "content")
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
      return callRoute(R.notes, "POST", { params: { id: pid }, body: { title: s(a, "title") ?? "", content: html } });
    },
  }),

  // ───────────── Keywords (Módulo 1) ─────────────
  tool("list_keyword_studies", "Lista los estudios de keywords del proyecto (el estudio «General» recoge las importaciones automáticas).", {
    run: async (_a, pid) => callRoute(R.studies, "GET", { params: { id: pid } }),
  }),
  tool("get_keyword_study", "Devuelve un estudio con todas sus keywords (volumen, competición, CPC, intención, dificultad, prioridad, estacionalidad).", {
    properties: { studyId: str("ID del estudio") },
    required: ["studyId"],
    run: async (a, pid) => callRoute(R.study, "GET", { params: { id: pid, studyId: need(a, "studyId") } }),
  }),
  tool("create_keyword_study", "Crea un estudio de keywords. Sin «keywords» crea uno vacío (gratis) para llenarlo con suggest_keywords + add_keywords_to_study. Con «keywords» resuelve sus métricas en DataForSEO: desde 0,012 $ + 0,00012 $ por keyword (gratis las que ya estén en caché; máx. 300).", {
    properties: {
      name: str("Nombre del estudio"),
      keywords: strList("Keywords a resolver (opcional)"),
      languageCode: LANGUAGE,
      locationCode: LOCATION,
    },
    required: ["name"],
    run: async (a, pid) =>
      callRoute(R.studies, "POST", {
        params: { id: pid },
        body: {
          name: s(a, "name"),
          keywords: Array.isArray(a.keywords) ? (a.keywords as unknown[]).filter((k) => typeof k === "string").join("\n") : "",
          languageCode: a.languageCode,
          locationCode: a.locationCode,
        },
      }),
  }),
  tool("suggest_keywords", "Busca keywords relacionadas con una semilla (DataForSEO Labs) con volumen, competición, CPC, intención y estacionalidad. NO las guarda: usa add_keywords_to_study con los ítems que interesen. Coste ≈ 0,012 $ + 0,00012 $ por resultado (100 resultados ≈ 0,024 $; 500 ≈ 0,07 $). Usa el idioma y la ubicación del estudio.", {
    properties: {
      studyId: str("ID del estudio donde se añadirán después (define idioma/ubicación)"),
      seed: str("Keyword semilla"),
      limit: num("Cuántas sugerencias traer (1-500, por defecto 100)"),
    },
    required: ["studyId", "seed"],
    run: async (a, pid) =>
      callRoute(R.suggestions, "GET", {
        params: { id: pid, studyId: need(a, "studyId") },
        query: { seed: need(a, "seed"), limit: typeof a.limit === "number" ? a.limit : undefined },
      }),
  }),
  tool("add_keywords_to_study", "Añade keywords a un estudio (gratis). Pasa los ítems tal cual los devolvió suggest_keywords para conservar sus métricas; las duplicadas se ignoran y las prioridades se recalculan.", {
    properties: {
      studyId: str("ID del estudio"),
      items: {
        type: "array",
        description: "Ítems de suggest_keywords (mínimo {keyword}).",
        items: { type: "object", properties: { keyword: { type: "string" } }, required: ["keyword"], additionalProperties: true },
      },
    },
    required: ["studyId", "items"],
    run: async (a, pid) =>
      callRoute(R.studyKeywords, "POST", { params: { id: pid, studyId: need(a, "studyId") }, body: { items: a.items } }),
  }),
  tool("generate_url_structure", "Genera con IA (OpenRouter, coste mínimo) la estructura de URLs del estudio: jerarquía real de páginas, h1, encabezados y keywords por página. Se guarda en el estudio.", {
    properties: { studyId: str("ID del estudio") },
    required: ["studyId"],
    run: async (a, pid) => callRoute(R.structure, "POST", { params: { id: pid, studyId: need(a, "studyId") } }),
  }),

  // ───────────── Rank Tracking (Módulo 5) ─────────────
  tool("list_rank_keywords", "Lista las keywords que se siguen en Rank Tracking con su posición actual, mejor posición y tendencia.", {
    run: async (_a, pid) => callRoute(R.rankKeywords, "GET", { params: { id: pid } }),
  }),
  tool("add_rank_keywords", "Añade keywords a Rank Tracking Y comprueba su posición ahora (DataForSEO SERP de Google). Coste por keyword: ≈0,002 $ con depth 10, ≈0,006 $ con 30, más con 50/100. Las ya existentes se ignoran.", {
    properties: {
      keywords: strList("Keywords a seguir"),
      locationCode: LOCATION,
      locationName: str("Nombre de la ubicación (solo si locationCode no es 2724)"),
      languageCode: LANGUAGE,
      device: { type: "string", enum: ["desktop", "mobile"], description: "Dispositivo (por defecto desktop)" },
      depth: { type: "number", enum: [10, 30, 50, 100], description: "Resultados a revisar (por defecto 30)" },
      frequency: { type: "string", enum: ["manual", "daily", "weekly", "monthly", "quarterly"], description: "Frecuencia automática (por defecto manual)" },
      group: str("Grupo opcional para organizar"),
    },
    required: ["keywords"],
    run: async (a, pid) => {
      const list = Array.isArray(a.keywords) ? (a.keywords as unknown[]).filter((k): k is string => typeof k === "string") : [];
      return callRoute(R.rankKeywords, "POST", {
        params: { id: pid },
        body: { ...pick(a, ["locationCode", "locationName", "languageCode", "device", "depth", "frequency", "group"]), keywords: list.join("\n") },
      });
    },
  }),
  tool("import_study_to_rank_tracking", "Importa a Rank Tracking todas las keywords de un estudio y comprueba su posición. Cuesta como add_rank_keywords por cada keyword nueva: revisa antes el tamaño del estudio.", {
    properties: {
      studyId: str("ID del estudio"),
      depth: { type: "number", enum: [10, 30, 50, 100] },
      device: { type: "string", enum: ["desktop", "mobile"] },
      frequency: { type: "string", enum: ["manual", "daily", "weekly", "monthly", "quarterly"] },
      group: str("Grupo opcional"),
    },
    required: ["studyId"],
    run: async (a, pid) =>
      callRoute(R.rankImport, "POST", { params: { id: pid }, body: pick(a, ["studyId", "depth", "device", "frequency", "group"]) }),
  }),
  tool("check_rank_keyword", "Vuelve a comprobar la posición de una keyword seguida (≈0,002-0,02 $ según depth). Solo se paga el primer chequeo de cada día natural; los siguientes devuelven la posición ya fijada gratis.", {
    properties: { keywordId: str("ID de la keyword de rank (lo da list_rank_keywords)") },
    required: ["keywordId"],
    run: async (a, pid) => callRoute(R.rankCheck, "POST", { params: { id: pid, kwId: need(a, "keywordId") } }),
  }),
  tool("get_rank_history", "Histórico de posiciones de una keyword seguida (gratis).", {
    properties: { keywordId: str("ID de la keyword de rank") },
    required: ["keywordId"],
    run: async (a, pid) => callRoute(R.rankHistory, "GET", { params: { id: pid, kwId: need(a, "keywordId") } }),
  }),
  tool("get_rank_visibility", "Cuota de visibilidad del proyecto frente a sus competidores a partir de las posiciones ya medidas (gratis).", {
    properties: { group: str("Filtrar por grupo (opcional)") },
    run: async (a, pid) => callRoute(R.rankVisibility, "GET", { params: { id: pid }, query: { group: s(a, "group") } }),
  }),

  // ───────────── SEO local / Geogrid (Módulo 9) ─────────────
  tool("list_geogrid_runs", "Lista los últimos mapas de calor de SEO local (geogrid) del proyecto con su estado y resumen.", {
    run: async (_a, pid) => callRoute(R.geogrid, "GET", { params: { id: pid } }),
  }),
  tool("get_geogrid_run", "Devuelve un geogrid completo: posición del negocio en cada punto de la rejilla y los competidores locales. Si sigue «pending»/«running», vuelve a llamarlo en unos segundos.", {
    properties: { runId: str("ID del run (lo da list_geogrid_runs / run_geogrid)") },
    required: ["runId"],
    run: async (a, pid) => callRoute(R.geogridRun, "GET", { params: { id: pid, runId: need(a, "runId") } }),
  }),
  tool("run_geogrid", "Lanza un geogrid (Maps SERP de Google en cada punto de una rejilla alrededor del negocio). Requiere proyecto de negocio local con lat/lng y módulo geogrid en el plan. Se procesa en segundo plano: devuelve el run «pending»; consulta get_geogrid_run después. Coste ≈ nº de puntos × 0,0035 $ (3×3 = 9 puntos, 5×5 = 25, 7×7 = 49).", {
    properties: {
      keyword: str("Keyword a medir (ej. «dentista gijón»)"),
      gridSize: { type: "number", enum: [3, 5, 7], description: "Lado de la rejilla (por defecto 5)" },
      radiusKm: num("Radio en km (0-50, por defecto 3)"),
    },
    required: ["keyword"],
    run: async (a, pid) => callRoute(R.geogrid, "POST", { params: { id: pid }, body: pick(a, ["keyword", "gridSize", "radiusKm"]) }),
  }),

  // ───────────── Auditoría (Módulo 8) ─────────────
  tool("list_audits", "Lista las últimas auditorías técnicas del proyecto con su puntuación y estado.", {
    run: async (_a, pid) => callRoute(R.audits, "GET", { params: { id: pid } }),
  }),
  tool("get_audit", "Devuelve una auditoría completa: puntuaciones por categoría, hallazgos y páginas rastreadas.", {
    properties: { auditId: str("ID de la auditoría (lo da list_audits)") },
    required: ["auditId"],
    run: async (a, pid) => callRoute(R.audit, "GET", { params: { id: pid, auditId: need(a, "auditId") } }),
  }),
  tool("run_audit", "Lanza una auditoría técnica del sitio entero (crawler propio, sin coste de API salvo PageSpeed gratis). Se procesa en segundo plano; consulta list_audits/get_audit después. Genera también las tareas automáticas.", {
    run: async (_a, pid) => callRoute(R.audits, "POST", { params: { id: pid } }),
  }),

  // ───────────── Oportunidades y Google ─────────────
  tool("get_opportunities", "Oportunidades a partir de Search Console (gratis): «quickwins» = páginas/queries en página 2 o cerca del top 3 con CTR bajo; «perdidas» = páginas que bajan. Requiere Search Console conectado.", {
    properties: { vista: { type: "string", enum: ["quickwins", "perdidas"], description: "Por defecto quickwins" } },
    run: async (a, pid) => callRoute(R.opportunities, "GET", { params: { id: pid }, query: { vista: s(a, "vista") } }),
  }),
  tool("get_search_console", "Panel de Search Console: clics, impresiones, CTR, posición, top queries y páginas, dispositivos, países y evolución (gratis, cuota de Google). Requiere propiedad conectada.", {
    properties: { range: str("Periodo: 28d, 3m, 6m o 12m (por defecto 3m)") },
    run: async (a, pid) => callRoute(R.gsc, "GET", { params: { id: pid }, query: { range: s(a, "range") } }),
  }),
  tool("get_analytics", "Panel de Google Analytics 4: sesiones, canales, landing pages, dispositivos y evolución (gratis). Requiere propiedad GA4 conectada.", {
    properties: { range: str("Periodo: 28d, 3m, 6m o 12m (por defecto 3m)") },
    run: async (a, pid) => callRoute(R.ga4, "GET", { params: { id: pid }, query: { range: s(a, "range") } }),
  }),

  // ───────────── Competidores y backlinks ─────────────
  tool("list_competitors", "Lista los competidores trackeados con su último análisis de visibilidad (tráfico estimado, keywords, posición media) y backlinks.", {
    run: async (_a, pid) => callRoute(R.competitors, "GET", { params: { id: pid } }),
  }),
  tool("add_competitor", "Añade un dominio competidor al proyecto (gratis; no lo analiza).", {
    properties: { domain: str("Dominio del competidor") },
    required: ["domain"],
    run: async (a, pid) => callRoute(R.competitors, "POST", { params: { id: pid }, body: { domain: need(a, "domain") } }),
  }),
  tool("analyze_competitor", "Analiza la visibilidad orgánica de un dominio (DataForSEO Labs): tráfico estimado, keywords, distribución de posiciones y top keywords. Coste ≈ 0,012 $ + 0,00012 $ por keyword devuelta (limit 100 ≈ 0,024 $).", {
    properties: { domain: str("Dominio a analizar (propio o competidor)"), limit: num("Top keywords a traer (por defecto el del módulo)"), locationCode: LOCATION, languageCode: LANGUAGE },
    required: ["domain"],
    run: async (a, pid) => callRoute(R.competitorAnalyze, "POST", { params: { id: pid }, body: pick(a, ["domain", "limit", "locationCode", "languageCode"]) }),
  }),
  tool("get_competitor_content_gap", "Content gap: keywords por las que posiciona el competidor y el proyecto no (DataForSEO Labs domain_intersection), con volumen, CPC, dificultad y la URL/snippet del competidor. Coste ≈ 0,012 $ + 0,00012 $ por keyword (limit 100 ≈ 0,024 $).", {
    properties: { competitorId: str("ID del competidor (lo da list_competitors)"), limit: num("Máximo de keywords"), locationCode: LOCATION, languageCode: LANGUAGE },
    required: ["competitorId"],
    run: async (a, pid) =>
      callRoute(R.competitorGap, "POST", { params: { id: pid, competitorId: need(a, "competitorId") }, body: pick(a, ["limit", "locationCode", "languageCode"]) }),
  }),
  tool("get_backlinks", "Último análisis de backlinks guardado del proyecto y de sus competidores (autoridad, dominios de referencia, listado). Gratis: solo lee lo ya analizado.", {
    run: async (_a, pid) => callRoute(R.backlinks, "GET", { params: { id: pid } }),
  }),
  tool("analyze_backlinks", "Analiza el perfil de backlinks de un dominio (API de Backlinks de DataForSEO, gasto aparte). Con limit 50 ≈ 0,03-0,05 $; «all» pagina hasta el total del dominio y puede salir caro: úsalo solo si se pide.", {
    properties: { domain: str("Dominio a analizar"), limit: { description: "20, 50, 100, 200, 500 o «all»", anyOf: [{ type: "number" }, { type: "string", enum: ["all"] }] } },
    required: ["domain"],
    run: async (a, pid) => callRoute(R.backlinksAnalyze, "POST", { params: { id: pid }, body: pick(a, ["domain", "limit"]) }),
  }),

  // ───────────── Contenido y on-page ─────────────
  tool("get_tfidf_results", "Lista los análisis TF-IDF ya hechos del proyecto (términos que usa el top-10 de cada keyword). Gratis.", {
    run: async (_a, pid) => callRoute(R.tfidf, "GET", { params: { id: pid } }),
  }),
  tool("run_tfidf", "Calcula el TF-IDF de una keyword: top-10 orgánico real, scraping de cada resultado y términos más relevantes. Gratis si Rank Tracking ya consultó esa keyword/ubicación; si no, una llamada SERP (≈0,002 $).", {
    properties: { keyword: str("Keyword"), locationCode: LOCATION, languageCode: LANGUAGE },
    required: ["keyword"],
    run: async (a, pid) => callRoute(R.tfidf, "POST", { params: { id: pid }, body: pick(a, ["keyword", "locationCode", "languageCode"]) }),
  }),
  tool("analyze_url", "Analizador de URL (gratis, sin LLM): descarga la página y la puntúa 0-100 en indexación, título/meta, encabezados, keyword, contenido, imágenes, datos estructurados, enlaces y móvil, con cómo arreglar cada punto. Sirve para páginas propias y de la competencia.", {
    properties: { url: str("URL completa"), keyword: str("Keyword objetivo (opcional)") },
    required: ["url"],
    run: async (a, pid) => callRoute(R.analyzer, "POST", { params: { id: pid }, body: pick(a, ["url", "keyword"]) }),
  }),
  tool("run_pagespeed", "Mide una URL con PageSpeed Insights de Google (gratis; necesita PAGESPEED_API_KEY configurada).", {
    properties: { url: str("URL completa"), strategy: { type: "string", enum: ["mobile", "desktop"] } },
    required: ["url"],
    run: async (a, pid) => callRoute(R.speed, "POST", { params: { id: pid }, body: pick(a, ["url", "strategy"]) }),
  }),
  tool("generate_title_meta", "Genera 3 variantes de título y meta descripción para una URL real (scrapea la página y usa OpenRouter; coste de céntimos de céntimo).", {
    properties: { url: str("URL completa"), keyword: str("Keyword objetivo (opcional)") },
    required: ["url"],
    run: async (a, pid) => callRoute(R.titleMeta, "POST", { params: { id: pid }, body: pick(a, ["url", "keyword"]) }),
  }),
  tool("generate_content", "Genera un texto SEO con IA (OpenRouter, céntimos). No inventa enlaces: solo usa los que pases.", {
    properties: {
      type: { type: "string", enum: ["blog", "pagina", "producto", "novedad_gbp"], description: "Tipo de contenido" },
      topic: str("Tema o título del contenido"),
      keyword: str("Keyword objetivo"),
      targetWords: num("Longitud objetivo en palabras"),
      targetUrl: str("URL de destino (opcional)"),
      internalLinks: str("Enlaces internos a incluir, uno por línea (opcional)"),
      tfidfTerms: str("Términos TF-IDF a cubrir (opcional)"),
    },
    required: ["type", "topic"],
    run: async (a, pid) =>
      callRoute(R.content, "POST", { params: { id: pid }, body: pick(a, ["type", "topic", "keyword", "targetWords", "targetUrl", "internalLinks", "tfidfTerms"]) }),
  }),
  tool("check_ai_overview", "Comprueba si Google muestra AI Overview para keywords de Rank Tracking y si cita al proyecto (≈0,004 $ por keyword). Módulo de pago «Visibilidad IA».", {
    properties: { rankKeywordIds: strList("IDs de keywords de rank (list_rank_keywords)") },
    required: ["rankKeywordIds"],
    run: async (a, pid) => callRoute(R.aiOverview, "POST", { params: { id: pid }, body: { rankKeywordIds: a.rankKeywordIds } }),
  }),

  // ───────────── Mediciones programadas ─────────────
  tool("get_scheduled_measurements", "Estado de las mediciones programadas del proyecto (Rank Tracking, SEO local, Auditoría, Velocidad, Competidores, Backlinks): si están activas, frecuencia, última ejecución y coste.", {
    run: async (_a, pid) => callRoute(R.measurements, "GET", { params: { id: pid } }),
  }),
  tool("set_scheduled_measurement", "Activa/desactiva una medición programada y fija su frecuencia. Activarla no gasta nada: la primera ejecución automática llega una frecuencia después.", {
    properties: {
      module: { type: "string", enum: ["rank", "geogrid", "audit", "velocidad", "competidores", "backlinks"], description: "Medición a programar" },
      enabled: { type: "boolean" },
      frequency: { type: "string", enum: ["weekly", "monthly", "quarterly"] },
    },
    required: ["module", "enabled"],
    run: async (a, pid) => callRoute(R.measurements, "PUT", { params: { id: pid }, body: pick(a, ["module", "enabled", "frequency"]) }),
  }),
  tool("run_measurement_now", "Ejecuta ya una medición programada («Medir ahora»). Gasta lo que cueste esa medición (ver get_scheduled_measurements).", {
    properties: { module: { type: "string", enum: ["rank", "geogrid", "audit", "velocidad", "competidores", "backlinks"], description: "Medición a ejecutar" } },
    required: ["module"],
    run: async (a, pid) => callRoute(R.measurements, "POST", { params: { id: pid }, body: { module: need(a, "module") } }),
  }),
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
