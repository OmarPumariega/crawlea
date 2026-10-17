// Datos de la web pública (Fase 4): URL canónica y nombre. La URL base sale
// de NEXTAUTH_URL (ya es env de runtime) para no añadir otra variable; en dev
// apunta a localhost, que es lo correcto para probar el sitemap.
export const SITE_NAME = "Crawlea";

export const SITE_URL = (process.env.NEXTAUTH_URL || "https://crawlea.com").replace(/\/$/, "");

export const SITE_DESCRIPTION =
  "Rastrea tu web, sigue tus posiciones en Google y aprende qué mejorar primero. Auditorías, backlinks, palabras clave y SEO local con los datos de Google y de tu propia web.";
