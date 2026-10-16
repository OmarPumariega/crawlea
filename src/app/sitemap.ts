import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Solo las páginas públicas; la herramienta (/app), el admin y la API no se indexan.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/funciones", "/precios", "/contacto", "/legal/aviso-legal", "/legal/privacidad", "/legal/terminos", "/legal/cookies", "/legal/condiciones-contratacion"];
  return paths.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "" || p === "/precios" || p === "/funciones" ? "weekly" : "yearly",
    priority: p === "" ? 1 : p === "/precios" ? 0.8 : 0.4,
  }));
}
