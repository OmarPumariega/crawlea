import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import InformeBuilder from "@/app/app/proyectos/[id]/informe/InformeBuilder";
import { loadInforme } from "@/app/app/proyectos/[id]/informe/load-report";

// Informe público de solo lectura: se abre con el enlace secreto que el
// propietario comparte con su cliente (sin sesión). El token (192 bits) es la
// única credencial; revocarlo desde el panel de compartir lo invalida al
// instante. noindex para que los buscadores no lo rastreen nunca.
export const metadata: Metadata = {
  title: "Informe SEO",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function InformePublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const project = await prisma.project.findUnique({
    where: { reportShareToken: token },
    select: { id: true, user: { select: { status: true } } },
  });
  if (!project || project.user.status !== "active") notFound();

  const props = await loadInforme(project.id, sp, `/informe/${token}`);
  // El gasto en APIs no sale del servidor hacia el cliente final.
  const data = { ...props.data, costs: { ...props.data.costs, monthCost: 0 } };
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 gap-6">
        <InformeBuilder {...props} data={data} />
      </div>
    </main>
  );
}
