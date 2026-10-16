"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const SCOPE_LABELS: Record<string, string> = {
  "https://www.googleapis.com/auth/webmasters.readonly": "Search Console (solo lectura)",
  "https://www.googleapis.com/auth/analytics.readonly": "Google Analytics (solo lectura)",
  "https://www.googleapis.com/auth/userinfo.email": "Email de la cuenta",
};

type Connection = { googleEmail: string; scope: string; connectedAt: Date } | null;

export default function GoogleConnectionCard({
  connection,
  justConnected,
  errorMessage,
}: {
  connection: Connection;
  justConnected: boolean;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/google/oauth", { method: "DELETE" });
    setDisconnecting(false);
    setConfirmingDisconnect(false);
    router.refresh();
  }

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-[0_1px_2px_rgba(17,20,43,0.05),0_4px_16px_-6px_rgba(17,20,43,0.10)] p-5 space-y-4">
      {justConnected && (
        <div className="flex items-center gap-2 text-sm bg-accent-tint text-accent-ink px-3 py-2 rounded-lg">
          <CheckCircle2 className="h-4 w-4" />
          Conectado correctamente.
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 text-sm bg-alert-tint text-alert-ink px-3 py-2 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}

      {connection ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm text-ink-soft">Conectado como</p>
            <p className="text-base font-medium text-ink">{connection.googleEmail}</p>
          </div>
          <div>
            <p className="text-sm text-ink-soft mb-1">Permisos concedidos</p>
            <ul className="text-sm text-ink-soft list-disc list-inside">
              {connection.scope.split(" ").filter(Boolean).map((scope) => (
                <li key={scope}>{SCOPE_LABELS[scope] ?? scope}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-faint">
            Conectado desde {new Date(connection.connectedAt).toLocaleString("es-ES")}
          </p>

          {!confirmingDisconnect ? (
            <button
              onClick={() => setConfirmingDisconnect(true)}
              className="text-sm text-ink-faint hover:text-alert-ink"
            >
              Desconectar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-soft">¿Seguro que quieres desconectar?</span>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-alert rounded-lg hover:bg-alert disabled:opacity-50"
              >
                {disconnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Sí, desconectar
              </button>
              <button
                onClick={() => setConfirmingDisconnect(false)}
                className="px-3 py-1.5 text-sm text-ink-soft border border-line rounded-xl hover:bg-background"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Todavía no hay ninguna cuenta de Google conectada.
          </p>
          <a
            href="/api/google/oauth/authorize"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-full hover:bg-brand-strong"
          >
            Conectar con Google
          </a>
        </div>
      )}
    </div>
  );
}
