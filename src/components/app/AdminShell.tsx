"use client";

import { useState } from "react";
import AdminSidebar from "@/components/app/AdminSidebar";
import AdminHeader from "@/components/app/AdminHeader";
import CopilotWidget from "@/components/app/CopilotWidget";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    // La app ocupa todo el viewport, sin marco ni márgenes exteriores.
    <div className="h-screen bg-background overflow-hidden">
      <div className="h-full flex overflow-hidden bg-surface">
        <AdminSidebar navOpen={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <AdminHeader onOpenNav={() => setNavOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
      {/* Vive aquí (no dentro de <main>) porque AdminShell se monta una sola
          vez para todo /admin — no remonta al navegar entre módulos de un
          proyecto, así que el widget conserva su estado (abierto/minimizado,
          hilo activo) sin Context ni librería de estado nueva. */}
      <CopilotWidget />
    </div>
  );
}
