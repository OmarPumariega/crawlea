import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Solo las páginas públicas; la herramienta (/app), el admin y la API no se indexan.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/precios", "/contacto", "/legal/privacidad", "/legal/terminos", "/legal/cookies"];
  return paths.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "" || p === "/precios" ? "weekly" : "yearly",
    priority: p === "" ? 1 : p === "/precios" ? 0.8 : 0.4,
  }));
}
