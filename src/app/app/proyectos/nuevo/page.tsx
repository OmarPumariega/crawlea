import ProjectWizard from "@/components/app/ProjectWizard";

// Dominio opcional por query (?dominio=ejemplo.es): llega desde el analizador
// de la web pública tras crear la cuenta. Solo se acepta algo con forma de
// dominio; cualquier otra cosa se ignora.
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ dominio?: string }> }) {
  const { dominio } = await searchParams;
  const initialDomain = dominio && DOMAIN_RE.test(dominio) ? dominio.toLowerCase() : "";
  return <ProjectWizard initialDomain={initialDomain} />;
}
