import { requireSession, canUseModule } from "@/lib/auth-guards";
import UpgradeWall from "@/components/app/UpgradeWall";
import CompetidoresView from "./CompetidoresView";

export default async function CompetidoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  if (session && !(await canUseModule(session, "competidores"))) return <UpgradeWall modulo="Competidores" />;
  return <CompetidoresView projectId={id} />;
}
