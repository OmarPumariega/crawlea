"use client";

import { usePathname } from "next/navigation";

// Extrae el projectId de la ruta /app/proyectos/[id]/... si aplica. Vive
// aparte (no en un layout) porque tanto AdminSidebar como el widget flotante
// del Copilot lo necesitan y ninguno de los dos recibe el proyecto por
// props/contexto — ambos lo deducen de la URL.
export function useProjectIdFromPath(): string | null {
  const pathname = usePathname();
  const m = pathname?.match(/^\/app\/proyectos\/([^/]+)(?:\/|$)/);
  // /app/proyectos/nuevo no es un proyecto.
  return m && m[1] !== "nuevo" ? m[1] : null;
}
