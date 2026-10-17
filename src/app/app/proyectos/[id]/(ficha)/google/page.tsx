import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireSession, projectForSession } from "@/lib/auth-guards";
import GoogleConnectionCard from "@/components/app/GoogleConnectionCard";
import GoogleView from "./GoogleView";

// Pestaña Google de la Ficha: conectar la cuenta (Search Console, Analytics y lo
// que venga) y ver los datos de ESTE proyecto, todo en el mismo sitio.
export default async function ProjectGooglePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireSession();
  if (!session) notFound();
  const project = await projectForSession(session, id);
  if (!project) notFound();

  const connection = await prisma.googleConnection.findUnique({
    where: { userId: project.userId },
    select: { googleEmail: true, scope: true, connectedAt: true },
  });

  const errorMessage =
    query.error === "cancelado" ? "Has cancelado la conexión con Google."
    : query.error === "configuracion_incompleta" ? "La conexión con Google no está configurada todavía."
    : query.error ? "No se pudo conectar con Google. Inténtalo de nuevo."
    : null;

  return (
    <div className="space-y-6">
      <GoogleConnectionCard
        connection={connection}
        justConnected={query.connected === "1"}
        errorMessage={errorMessage}
        returnTo={`/app/proyectos/${id}/google`}
      />
      {connection && (
        <GoogleView
          projectId={project.id}
          initialGscSiteUrl={project.gscSiteUrl}
          initialGa4PropertyId={project.ga4PropertyId}
        />
      )}
    </div>
  );
}
