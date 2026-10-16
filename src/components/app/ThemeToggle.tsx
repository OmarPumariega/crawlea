"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Alternar claro/oscuro (guía §2): recuerda la elección y respeta el sistema.
// No se pinta hasta estar montado para no discrepar con el HTML del servidor.
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setMontado(true));
  }, []);
  if (!montado) return <span className="h-8 w-8" aria-hidden="true" />;
  const oscuro = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(oscuro ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-soft hover:text-ink hover:bg-surface-muted transition-colors"
      aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={oscuro ? "Tema claro" : "Tema oscuro"}
    >
      {oscuro ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

