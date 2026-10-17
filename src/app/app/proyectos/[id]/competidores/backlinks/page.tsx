import { requireSession, canUseModule } from "@/lib/auth-guards";
import UpgradeWall from "@/components/app/UpgradeWall";
import BacklinksView from "./BacklinksView";

export default async function BacklinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (session && !(await canUseModule(session, "backlinks"))) return <UpgradeWall modulo="Backlinks" />;
  return <BacklinksView projectId={id} />;
}
