import { notFound } from "next/navigation";
import { requireSession, projectForSession } from "@/lib/auth-guards";
import MedicionesView from "./MedicionesView";

export default async function MedicionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!session) notFound();
  if (!(await projectForSession(session, id, { id: true }))) notFound();
  return <MedicionesView projectId={id} />;
}
