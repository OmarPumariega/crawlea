import { redirect } from "next/navigation";
import { requireSession, isAdmin } from "@/lib/auth-guards";

// El desglose de costes es solo del administrador de la plataforma.
export default async function CostesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session || !isAdmin(session)) redirect("/app");
  return <>{children}</>;
}
