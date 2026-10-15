import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AuthPanel from "@/components/auth/AuthPanel";

export const metadata = {
  title: "Acceso · SEO Ciro",
};

export default async function AccesoPage() {
  // Ya autenticado: directo al panel.
  const session = await getServerSession(authOptions);
  if (session) redirect("/app");

  return <AuthPanel variant="acceso" />;
}
