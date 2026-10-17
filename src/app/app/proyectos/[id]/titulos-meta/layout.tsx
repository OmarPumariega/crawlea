import ModuleTabs from "@/components/app/ModuleTabs";

// Barra superior común a todos los módulos: nombre del módulo a la izquierda y
// el historial (si lo tiene) a la derecha.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <ModuleTabs title="Título y Meta" hint="Títulos y descripciones con IA" />
      {children}
    </div>
  );
}
