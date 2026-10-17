import VelocidadView from "./VelocidadView";

export default async function VelocidadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VelocidadView projectId={id} />;
}
