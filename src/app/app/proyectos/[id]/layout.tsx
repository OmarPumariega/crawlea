import { notFound } from "next/navigation";
import { requireSession, projectForSession } from "@/lib/auth-guards";

// Layout de las páginas de un proyecto. La navegación entre módulos va ahora
// en el sidebar principal (debajo de Configuración), no como pestañas aquí —
// así no se rompe por el número de módulos. Aquí validamos que el proyecto
// existe Y pertenece al usuario (el admin de la plataforma ve todos): es el
// choke point de acceso de todas las páginas de módulo de un proyecto.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) notFound();

  const project = await projectForSession(session, id, { id: true });
  if (!project) notFound();

  return <div className="space-y-6">{children}</div>;
}
