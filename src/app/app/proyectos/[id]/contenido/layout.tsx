import ModuleTabs from "@/components/app/ModuleTabs";

// Pestañas del módulo Contenido. TF-IDF (análisis de términos de la SERP)
// vive aquí como pestaña desde la fusión de módulos — antes era una ruta
// propia /tfidf. El hand-off "Enviar a Contenido" sigue funcionando igual
// (sessionStorage), ahora sin recarga de página.
export default async function ContenidoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = `/app/proyectos/${id}`;
  return (
    <div className="space-y-4">
      <ModuleTabs
        tabs={[
          { href: `${base}/contenido`, label: "Contenido", hint: "Genera y optimiza textos" },
          { href: `${base}/contenido/tfidf`, label: "TF-IDF", hint: "Términos del top 10 de Google" },
        ]}
      />
      {children}
    </div>
  );
}
