import { Suspense } from "react";
import ClustersView from "./ClustersView";

export default async function ClustersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ClustersView projectId={id} />
    </Suspense>
  );
}
