// Bloques ("features") que puede tener una página de resultados de Google, con
// su nombre en español. Client-safe. Los tipos son los `type` reales que
// devuelve DataForSEO en serp_item_types / items.

export const SERP_FEATURE_LABELS: Record<string, string> = {
  organic: "Resultados orgánicos",
  paid: "Anuncios",
  featured_snippet: "Snippet destacado",
  answer_box: "Respuesta directa",
  people_also_ask: "La gente también pregunta",
  related_searches: "Búsquedas relacionadas",
  people_also_search: "La gente también busca",
  knowledge_graph: "Panel de conocimiento",
  google_reviews: "Reseñas de Google",
  local_pack: "Pack local (mapa)",
  map: "Mapa",
  video: "Vídeos",
  short_videos: "Vídeos cortos",
  images: "Imágenes",
  top_stories: "Noticias",
  shopping: "Shopping",
  google_flights: "Vuelos",
  hotels_pack: "Hoteles",
  jobs: "Empleo",
  discussions_and_forums: "Foros y debates",
  ai_overview: "AI Overview",
  ai_overview_reference: "Cita en AI Overview",
  find_results_on: "Buscar en…",
  twitter: "X / Twitter",
  carousel: "Carrusel",
  multi_carousel: "Carrusel",
  popular_products: "Productos populares",
  recipes: "Recetas",
  events: "Eventos",
  math_solver: "Calculadora",
  currency_box: "Conversor",
  stocks_box: "Bolsa",
  perspectives: "Perspectivas",
  explore_brands: "Marcas",
  refine_products: "Filtrar productos",
  visual_stories: "Historias visuales",
  questions_and_answers: "Preguntas y respuestas",
  commercial_units: "Unidades comerciales",
  third_party_reviews: "Reseñas de terceros",
};

// Bloques que importan de un vistazo (los orgánicos y de apoyo no aportan nada
// al ser siempre iguales); el resto se muestra bajo demanda.
const HIDDEN = new Set(["organic", "related_searches"]);

export function serpFeatureLabel(type: string): string {
  return SERP_FEATURE_LABELS[type] ?? type.replace(/_/g, " ");
}

export function interestingSerpFeatures(types: string[] | null | undefined): string[] {
  return (types ?? []).filter((t) => !HIDDEN.has(t));
}
