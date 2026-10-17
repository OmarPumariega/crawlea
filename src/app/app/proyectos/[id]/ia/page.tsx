import { requireSession, canUseModule } from "@/lib/auth-guards";
import UpgradeWall from "@/components/app/UpgradeWall";
import IaView from "./IaView";

export default async function IaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (session && !(await canUseModule(session, "ia"))) return <UpgradeWall modulo="Visibilidad en IA" />;
  return <IaView projectId={id} />;
}
