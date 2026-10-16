import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AuthPanel from "@/components/auth/AuthPanel";
import { signupCallback } from "@/lib/analyzer/callback";

export const metadata = {
  title: "Crear cuenta · Crawlea",
  robots: { index: false },
};

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ web?: string }> }) {
  const { web } = await searchParams;
  // Ya autenticado: directo al panel.
  const session = await getServerSession(authOptions);
  if (session) redirect(signupCallback(web));

  return <AuthPanel variant="registro" callbackUrl={signupCallback(web)} />;
}
