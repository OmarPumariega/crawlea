// Contenido compartido de la web pública (home y /precios).
export const AUDIENCES = [
  {
    kicker: "Freelances y agencias", title: "Varios clientes, un solo sitio",
    text: "Cada cliente es un proyecto con su seguimiento, su auditoría y su lista de tareas.",
    points: ["Hasta 10 proyectos en el plan Pro", "Informe con tu nombre, logo y color", "Enlace de solo lectura y envío mensual por email al cliente"],
    href: "/precios", cta: "Ver el plan Pro",
  },
  {
    kicker: "Negocios locales", title: "Tu posición en el mapa",
    text: "Elige tu ficha de Google y el proyecto se configura como negocio local.",
    points: ["Mapa de calor de Google Maps, de 3×3 a 7×7 puntos", "Datos del negocio rellenados desde tu ficha", "Compara dos mediciones de la misma palabra"],
    href: "/funciones#seo-local", cta: "Ver el SEO local",
  },
  {
    kicker: "Tu propia web", title: "Empieza gratis, sin tarjeta",
    text: "Un proyecto, rastreo del sitio entero y una pista junto a cada dato para saber qué hacer.",
    points: ["Auditoría con tareas automáticas", "Seguimiento de posiciones y Search Console", "100 créditos al mes para consultas de pago"],
    href: "/registro", cta: "Empieza gratis",
  },
];

export const FAQ = [
  { q: "¿Necesito tarjeta para empezar?", a: "No. El plan Gratis no pide ningún dato de pago." },
  { q: "¿Qué son los créditos?", a: "Es tu bolsa mensual para las consultas de pago: posiciones en Google, palabras clave, competidores, backlinks y mapa de calor. Antes de cada acción ves cuántos créditos gasta. La auditoría de tu web, los títulos y el contenido con IA no gastan créditos. La bolsa se renueva el día 1 de cada mes; si se agota, esperas a la renovación o subes de plan." },
  { q: "¿De dónde salen los datos?", a: "De Search Console, Analytics, PageSpeed, los resultados de Google y el rastreo de tu web. Los volúmenes de búsqueda son estimaciones y los marcamos como tales." },
  { q: "¿Prometéis posiciones?", a: "No. Te mostramos qué ocurre en tu web y qué mejorar primero. Los resultados dependen de Google y de tu trabajo." },
  { q: "¿Qué incluye el plan Gratis?", a: "Un proyecto, 100 créditos al mes y todas las herramientas salvo competidores, backlinks, SEO local y visibilidad en IA, que son de pago. No pide tarjeta." },
  { q: "¿Puedo enviar informes a mis clientes?", a: "Sí. Cada proyecto tiene un informe con las secciones que elijas. Lo guardas en PDF o compartes un enlace de solo lectura que puedes revocar, con tu nombre, logo y color. También puede salir cada mes por email." },
  { q: "¿Necesito conectar mi cuenta de Google?", a: "Solo para ver Search Console y Analytics y para detectar canibalizaciones. El resto de herramientas funciona sin conectarla." },
  { q: "¿Sirve para negocios locales?", a: "Sí. El mapa de calor te dice en qué puntos de tu zona apareces en Google Maps y en cuáles no." },
];
