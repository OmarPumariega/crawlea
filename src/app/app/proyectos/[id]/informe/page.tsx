import { requireSession } from "@/lib/auth-guards";
import { prisma } from "@/lib/db/prisma";
import InformeBuilder from "./InformeBuilder";
import { loadInforme } from "./load-report";

export default async function InformePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const props = await loadInforme(id, sp, `/app/proyectos/${id}/informe`);
  const session = await requireSession();
  const project = await prisma.project.findUnique({
    where: { id },
    select: { reportShareToken: true, reportEmailTo: true },
  });
  return (
    <InformeBuilder
      {...props}
      share={{
        token: project?.reportShareToken ?? null,
        emailTo: project?.reportEmailTo ?? null,
        ownBrand: session
          ? await prisma.user
              .findUnique({ where: { id: session.user.id }, select: { brandName: true, brandLogo: true, brandColor: true } })
              .then((u) => u ?? { brandName: null, brandLogo: null, brandColor: null })
          : { brandName: null, brandLogo: null, brandColor: null },
      }}
    />
  );
}
