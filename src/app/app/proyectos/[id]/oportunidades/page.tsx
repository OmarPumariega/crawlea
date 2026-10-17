import OportunidadesView from "./OportunidadesView";

export default async function OportunidadesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OportunidadesView projectId={id} vista="quickwins" />;
}
