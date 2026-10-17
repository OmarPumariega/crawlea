import OportunidadesView from "../OportunidadesView";

export default async function PerdidasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OportunidadesView projectId={id} vista="perdidas" />;
}
