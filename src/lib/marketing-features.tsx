import type { ReactNode } from "react";
import { Bars, CompetitorBars, ContentMini, Donut, GeoHeat, KeywordRows, Pill, RankLine, BacklinksMini } from "@/components/marketing/mockups";
import {
  AiOverviewMini, CannibalMini, ChatMini, InternalLinksMini, NotesMini, ProjectMini, ReportMini,
  SearchConsoleMini, SerpPreviewMini, TasksMini, TermsMini, TreeMini, UrlChecksMini,
} from "@/components/marketing/mockups-extra";

// Única lista de funciones de la web pública: la usan el carrusel de la home y
// /funciones. Una entrada por herramienta de la app, en el orden de su menú.
// `paid` marca las que el plan Gratis no incluye (PAID_MODULES en plans.ts).
export type Feature = {
  id: string;
  kicker: string;
  title: string;
  text: string;
  points: string[];
  paid?: boolean;
  visual: ReactNode;
};

export const FEATURES: Feature[] = [
  {
    id: "palabras-clave", kicker: "Palabras clave", title: "Descubre qué busca tu gente",
    text: "Siembra una palabra y la herramienta te trae las relacionadas con sus datos ya resueltos. Tú eliges cuáles te interesan y ese conjunto es tu estudio.",
    points: ["Volumen mensual estimado, competencia y coste por clic", "Intención de búsqueda: informativa, comercial o mixta", "Estacionalidad de los últimos 12 meses", "También puedes pegar tu propia lista de palabras"],
    visual: <KeywordRows />,
  },
  {
    id: "arquitectura", kicker: "Arquitectura de URLs", title: "Qué páginas crear y cómo enlazarlas",
    text: "A partir de tu estudio de palabras clave, propone la estructura de tu web como un árbol: qué páginas merecen URL propia y cuáles palabras reclama cada una.",
    points: ["La jerarquía sale de la longitud y el volumen de cada palabra", "Volumen sumado por rama, de mayor a menor", "H1, encabezados y etiqueta de menú sugeridos por página", "Cada rama se expande y muestra la URL completa"],
    visual: <TreeMini />,
  },
  {
    id: "analizador", kicker: "Analizador de URL", title: "Revisa cualquier página al momento",
    text: "Pega la URL de una página, tuya o de la competencia, y obtén un diagnóstico de todo lo que influye en su posicionamiento y cómo arreglarlo. No gasta créditos.",
    points: ["Indexación, título, meta, encabezados, imágenes, enlaces y datos estructurados", "Comprobaciones sobre tu palabra clave objetivo", "Puntuación de 0 a 100 por categoría y lista de qué arreglar primero", "Historial por URL para comparar con el análisis anterior"],
    visual: <UrlChecksMini />,
  },
  {
    id: "titulo-meta", kicker: "Título y meta", title: "Títulos y descripciones que sí se leen",
    text: "Leemos tu página y te proponemos tres variantes de título y meta descripción, ajustadas a los límites de caracteres de Google.",
    points: ["Tres variantes por página, con el recuento de caracteres", "Parte del contenido de tu URL, no de una plantilla", "Palabra clave objetivo opcional", "Historial de lo generado"],
    visual: <SerpPreviewMini />,
  },
  {
    id: "contenido", kicker: "Contenido con IA", title: "Textos a partir de tu proyecto",
    text: "Escribe contenido para blog, página, producto o novedad de ficha de Google, y optimiza las páginas que ya tienes con una lista de cambios concretos.",
    points: ["Encabezados, tono y longitud a tu medida", "Versiones guardadas por tema: compara, restaura o regenera", "Optimizar una URL existente: qué título, meta, H1 o texto tocar y por qué", "Usa el cruce con el TF-IDF y los competidores si los tienes"],
    visual: <ContentMini />,
  },
  {
    id: "tfidf", kicker: "TF-IDF", title: "Qué términos usan los que ya están arriba",
    text: "Analizamos el top 10 de Google para una palabra clave y sacamos los términos que más pesan en esas páginas, para que sepas qué temas cubrir.",
    points: ["El top 10 de Google, con el título y el texto que muestra cada resultado", "Por ubicación, con el mismo selector que el seguimiento de posiciones", "Sin coste extra si esa palabra ya se consultó hace poco", "Un botón lleva los términos al generador de contenido"],
    visual: <TermsMini />,
  },
  {
    id: "auditoria", kicker: "Auditoría técnica", title: "Encuentra qué corregir primero",
    text: "Rastreamos tu web entera, respetando robots.txt, y ordenamos los problemas por importancia.",
    points: ["Hasta 5.000 páginas por rastreo, empezando por el sitemap", "Enlaces rotos, HTTPS, canonicals, títulos, descripciones, H1 e imágenes sin alt", "PageSpeed de la home y puntuación de 0 a 100 en 5 categorías explicadas", "Aviso por email al terminar y rastreo mensual programable"],
    visual: (<div className="flex items-center gap-5"><Donut value={82} className="w-28 shrink-0" /><ul className="space-y-2 text-[13px] text-ink-soft"><li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-alert" />38 enlaces rotos</li><li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand" />4 páginas sin título</li><li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-200" />9 imágenes sin alt</li></ul></div>),
  },
  {
    id: "enlaces-internos", kicker: "Enlaces internos", title: "Qué páginas enlazar entre sí",
    text: "Con el mapa de enlaces de tu último rastreo calculamos la fuerza interna de cada página y te decimos desde dónde enlazar las que están flojas.",
    points: ["PageRank interno: páginas huérfanas y las que más peso reciben", "Sugerencias de qué páginas enlazar, desde cuál y con qué texto", "Prioriza las que ya posicionan entre el 4 y el 30", "Si no encontramos relación entre dos páginas, no la inventamos"],
    visual: <InternalLinksMini />,
  },
  {
    id: "canibalizaciones", kicker: "Canibalizaciones", title: "Páginas que compiten entre sí",
    text: "Detecta las búsquedas en las que varias URLs de tu web se disputan la misma posición, con datos de tu Search Console.",
    points: ["Las consultas de los últimos 90 días con más de una URL posicionada", "Posición de cada página para esa consulta", "Requiere conectar Search Console", "No gasta créditos"],
    visual: <CannibalMini />,
  },
  {
    id: "posiciones", kicker: "Rank tracking", title: "Sigue dónde sales en Google",
    text: "Comprueba la posición de tus palabras clave por ubicación y mira cómo evolucionan.",
    points: ["Profundidad de 10, 30, 50 o 100 resultados", "Frecuencia diaria, semanal o mensual", "Ubicación por comunidad, provincia, ciudad o municipio", "Histórico, mejor posición y aviso por email si caes 10 puestos o más"],
    visual: (<><p className="text-[11px] font-semibold text-ink-faint">Posición media</p><p className="flex items-center gap-2 text-3xl font-extrabold tracking-[-0.03em] tabular-nums">8,4 <Pill>▲ 1,2 pts</Pill></p><RankLine className="mt-2 text-ink" /></>),
  },
  {
    id: "google", kicker: "Search Console y Analytics", title: "Lo que pasa en tu web, junto al resto",
    text: "Conecta tu cuenta de Google y verás tus datos de Search Console y Analytics dentro del proyecto, sin cambiar de pestaña.",
    points: ["Clics, impresiones, CTR y posición, con las consultas y páginas principales", "Desglose por dispositivo y país, y evolución de 12 meses", "Sesiones, canales de tráfico y páginas de aterrizaje de Analytics", "Importa las consultas por las que ya te encuentran como semilla de un estudio de palabras"],
    visual: (<><SearchConsoleMini /><Bars values={[40, 52, 47, 60, 66, 74, 90]} className="mt-3 h-16" /></>),
  },
  {
    id: "competidores", kicker: "Competidores", title: "Mídete con quien compite contigo",
    text: "Compara tu visibilidad con la de cualquier dominio y descubre las palabras que ellos posicionan y tú no.",
    points: ["Tráfico orgánico estimado y número de palabras posicionadas", "Distribución en top 3, top 10 y top 100, con tendencia", "Palabras que ellos posicionan y tú no, con el texto que muestran en Google", "Añádelas a tu estudio o a tu seguimiento con un clic"],
    paid: true,
    visual: <CompetitorBars />,
  },
  {
    id: "backlinks", kicker: "Backlinks", title: "Quién te enlaza y cuánto pesa",
    text: "Los enlaces de otras webs que apuntan a la tuya y a la de tus competidores, junto a su ficha en Competidores.",
    points: ["Autoridad, backlinks totales y dominios de referencia", "Dofollow, nofollow y enlaces rotos, con anchor y fechas", "Páginas tuyas más enlazadas y enlaces de mayor autoridad", "Dominios que enlazan a tu competidor y todavía no a ti"],
    paid: true,
    visual: <BacklinksMini />,
  },
  {
    id: "seo-local", kicker: "SEO local", title: "Tu posición en el mapa, punto a punto",
    text: "Para negocios locales: un mapa de calor de Google Maps alrededor de tu ubicación. Eliges tu ficha de Google y el proyecto se configura como negocio local.",
    points: ["Rejilla de 3×3, 5×5 o 7×7 puntos y radio configurable", "La posición de tu negocio en cada punto, por palabra clave", "Histórico y comparación entre dos mediciones", "Nombre, dirección, teléfono y horario se rellenan desde tu ficha"],
    paid: true,
    visual: <GeoHeat className="mx-auto max-w-[190px]" />,
  },
  {
    id: "visibilidad-ia", kicker: "Visibilidad en IA", title: "Si Google y la IA te citan",
    text: "Sobre tus palabras clave seguidas, mira si Google muestra una respuesta con IA (AI Overview), qué fuentes cita y si tú eres una de ellas.",
    points: ["AI Overview por palabra clave, con histórico", "Se alimenta solo con el seguimiento de posiciones", "Preguntas de cliente lanzadas a ChatGPT y Perplexity como muestra puntual", "Si Google no lo muestra para esa búsqueda, te lo decimos"],
    paid: true,
    visual: <AiOverviewMini />,
  },
  {
    id: "informes", kicker: "Informes", title: "Un informe claro para tu cliente",
    text: "Un informe por proyecto con las secciones que elijas, listo para imprimir o guardar en PDF, o para compartir con un enlace.",
    points: ["Auditoría, posiciones, palabras clave, arquitectura, Google, backlinks y visibilidad en IA", "Enlace público de solo lectura que puedes revocar", "Marca blanca: tu nombre, logo y color", "Envío mensual del enlace por email a tu cliente"],
    visual: <ReportMini />,
  },
  {
    id: "tareas", kicker: "Tareas", title: "Tu lista de qué hacer, siempre al día",
    text: "Cada proyecto tiene su lista de tareas. Las escribes tú, o las crea la auditoría con lo que ha encontrado.",
    points: ["Tareas manuales con fecha límite opcional", "La auditoría crea una tarea por cada tipo de problema accionable", "La siguiente auditoría cierra las que ya no aplican", "Tus tareas manuales nunca se tocan"],
    visual: <TasksMini />,
  },
  {
    id: "ficha", kicker: "Ficha y notas", title: "Todo lo del cliente, en un sitio",
    text: "La ficha guarda los datos del proyecto y un cuaderno de notas internas con texto enriquecido y fotos.",
    points: ["Dominio y datos del negocio, rellenados desde tu ficha de Google", "Poner en marcha el proyecto: importa palabras y analiza a los competidores", "Notas con formato y hasta 8 fotos cada una", "Las notas son internas: no salen en el informe"],
    visual: (<div className="space-y-2"><ProjectMini /><NotesMini /></div>),
  },
  {
    id: "asistente", kicker: "Asistente con IA", title: "Pregunta por tu proyecto",
    text: "Un chat flotante, disponible en cualquier página del proyecto, que responde con los datos que ya tienes (auditoría, posiciones, Search Console...).",
    points: ["Varias conversaciones por proyecto, con historial", "Solo lectura: no modifica nada de tu proyecto", "No gasta créditos"],
    visual: <ChatMini />,
  },
];
