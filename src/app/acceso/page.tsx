import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AuthPanel from "@/components/auth/AuthPanel";
import { signupCallback } from "@/lib/analyzer/callback";

export const metadata = {
  title: "Acceso · Crawlea",
  robots: { index: false },
};

// Único destino `next` aceptado: volver a la pantalla de consentimiento del
// conector MCP tras iniciar sesión. Se exige la ruta interna exacta para que no
// sirva de redirección abierta.
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/oauth/authorize?") && !next.includes("//") ? next : null;
}

export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ web?: string; plan?: string; next?: string }>;
}) {
  const { web, plan, next } = await searchParams;
  const destino = safeNext(next) ?? signupCallback(web, plan);
  // Ya autenticado: directo al panel (o a la pantalla de consentimiento).
  const session = await getServerSession(authOptions);
  if (session) redirect(destino);

  return <AuthPanel variant="acceso" callbackUrl={destino} />;
}
