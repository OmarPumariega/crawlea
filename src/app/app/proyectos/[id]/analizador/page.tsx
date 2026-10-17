import AnalizadorView from "./AnalizadorView";

export default async function AnalizadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalizadorView projectId={id} />;
}
