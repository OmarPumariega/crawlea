"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { track } from "@/lib/analytics/track";

// Modal bloqueante: hasta aceptar los términos y la política de privacidad
// vigentes no se usa la herramienta. Se muestra a cuentas nuevas y, si cambia
// LEGAL_VERSION, a las existentes. La aceptación queda registrada en la BD
// (User.termsAcceptedAt/termsVersion).
export default function TermsGate() {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) return null;

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/perfil/terminos", { method: "POST" });
      if (!res.ok) throw new Error();
      track("terms_accepted");
      setDone(true);
    } catch {
      setError("No hemos podido guardar tu aceptación. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="w-full max-w-md rounded-[24px] border border-line bg-surface p-7 text-ink shadow-xl">
        <h2 id="terms-title" className="text-xl font-extrabold tracking-[-0.02em]">Antes de empezar</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Para usar Crawlea necesitamos que aceptes cómo funciona el servicio y cómo tratamos tus datos.
        </p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-snug">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#4F5CF5]" />
          <span>
            He leído y acepto los{" "}
            <Link href="/legal/terminos" target="_blank" className="font-semibold text-brand hover:underline">Términos de uso</Link> y la{" "}
            <Link href="/legal/privacidad" target="_blank" className="font-semibold text-brand hover:underline">Política de privacidad</Link>.
          </span>
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-alert-ink">{error}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-surface-muted">
            No acepto, salir
          </button>
          <button type="button" disabled={!checked || busy} onClick={accept} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Acepto y continúo
          </button>
        </div>
      </div>
    </div>
  );
}
