"use client";

import { Menu } from "lucide-react";
import Logo from "@/components/app/Logo";
import ThemeToggle from "@/components/app/ThemeToggle";

// Cabecera SOLO en móvil: abrir el menú, logo y tema. En escritorio no hay
// cabecera (el logo, el tema y la cuenta viven en el menú lateral).
export default function AdminHeader({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="md:hidden flex items-center justify-between gap-3 h-14 px-4 border-b border-line bg-surface/70 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <button className="text-ink-soft hover:text-ink transition-colors" onClick={onOpenNav} aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
        <Logo compact />
      </div>
      <ThemeToggle />
    </header>
  );
}
