import CambiosView from "./CambiosView";

export default async function CambiosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CambiosView projectId={id} />;
}
