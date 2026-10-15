"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, TriangleAlert } from "lucide-react";

// Zona de peligro del perfil: borrar la cuenta (con todos sus proyectos y
// datos, en cascada). Confirmación explícita escribiendo BORRAR.
export default function DeleteAccountButton() {
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/perfil", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo borrar la cuenta");
        setLoading(false);
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("No se pudo borrar la cuenta");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-red-700 hover:text-red-800 underline underline-offset-4"
      >
        Borrar mi cuenta y todos mis datos
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 leading-relaxed">
        Se borrarán <strong>todos tus proyectos</strong> con sus auditorías, keywords,
        informes y historial. Esta acción no se puede deshacer.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Escribe "BORRAR" para confirmar'
          className="flex-1 px-3 py-2 border border-line rounded-xl text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 bg-white"
        />
        <button
          onClick={handleDelete}
          disabled={confirmText !== "BORRAR" || loading}
          className="px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-xl hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TriangleAlert className="h-4 w-4" />}
          Borrar definitivamente
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setConfirmText("");
            setError("");
          }}
          disabled={loading}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
