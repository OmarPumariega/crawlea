import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import ProjectEditView from "./ProjectEditView";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const hours = project.hours as { text?: string } | null;

  // Resumen del proyecto: datos ya guardados (sin coste), para ver su estado de un vistazo.
  const [lastAudit, rankCount, studyCount, competitorCount, openTasks, googleConn] = await Promise.all([
    prisma.auditRun.findFirst({
      where: { projectId: id, status: "completed", overallScore: { not: null } },
      orderBy: { triggeredAt: "desc" },
      select: { overallScore: true, triggeredAt: true },
    }),
    prisma.rankKeyword.count({ where: { projectId: id } }),
    prisma.keyword.count({ where: { study: { projectId: id } } }),
    prisma.competitor.count({ where: { projectId: id } }),
    prisma.todoItem.count({ where: { projectId: id, done: false } }),
    prisma.googleConnection.findUnique({ where: { userId: project.userId }, select: { googleEmail: true } }),
  ]);

  return (
    <ProjectEditView
      google={{ email: googleConn?.googleEmail ?? null, gscSelected: !!project.gscSiteUrl, ga4Selected: !!project.ga4PropertyId }}
      summary={{
        auditScore: lastAudit?.overallScore ?? null,
        auditDate: lastAudit?.triggeredAt.toISOString() ?? null,
        rankCount,
        studyCount,
        competitorCount,
        openTasks,
      }}
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        domain: project.domain ?? "",
        isLocalBusiness: project.isLocalBusiness,
        businessName: project.businessName ?? "",
        address: project.address ?? "",
        phone: project.phone ?? "",
        hours: hours?.text ?? "",
        lat: project.lat !== null ? String(project.lat) : "",
        lng: project.lng !== null ? String(project.lng) : "",
        gbpName: project.gbpName ?? "",
        gbpPlaceId: project.gbpPlaceId ?? "",
      }}
    />
  );
}
