"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { CONSENT_EVENT, OPEN_CONSENT_EVENT, readConsent, writeConsent, type ConsentState } from "@/lib/analytics/consent";
import { cn } from "@/lib/utils";

// Banner de cookies con tres caminos de igual peso (Aceptar, Rechazar,
// Configurar), como exige la AEPD: rechazar es tan fácil como aceptar y no
// hay casillas premarcadas. Se puede reabrir desde el pie («Configurar
// cookies»). Solo hay una categoría opcional: analítica.
export default function CookieBanner() {
  const [state, setState] = useState<ConsentState>("unset");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false); // panel de configuración
  const [forced, setForced] = useState(false); // reabierto desde el pie
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const sync = () => setState(readConsent());
    sync();
    setReady(true);
    const onOpen = () => {
      setAnalytics(readConsent() === "granted");
      setForced(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
    };
  }, []);

  if (!ready || (state !== "unset" && !forced)) return null;

  const decide = (value: boolean) => {
    writeConsent(value);
    setForced(false);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-[22px] border border-line bg-surface p-5 text-ink shadow-[0_20px_60px_-20px_rgba(17,20,43,0.45)] sm:p-6"
    >
      {forced && (
        <button type="button" onClick={() => { setForced(false); setOpen(false); }} aria-label="Cerrar" className="absolute right-4 top-4 text-ink-faint hover:text-ink">
          <X className="h-5 w-5" />
        </button>
      )}
      <h2 id="cookie-title" className="text-base font-extrabold">Tu privacidad, tú decides</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Usamos cookies técnicas, necesarias para que Crawlea funcione, y, solo si nos das permiso, cookies de analítica para saber qué partes se usan y mejorarlas. No usamos cookies de publicidad. Más información en la{" "}
        <Link href="/legal/cookies" className="font-semibold text-brand hover:underline">política de cookies</Link>.
      </p>

      {open && (
        <div className="mt-4 space-y-3 rounded-2xl bg-surface-muted p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">Necesarias</p>
              <p className="text-xs leading-snug text-ink-soft">Sesión, seguridad del acceso y tus preferencias (tema, cookies). Siempre activas.</p>
            </div>
            <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-xs font-bold text-accent-ink">Activas</span>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-line pt-3">
            <div>
              <p className="text-sm font-bold">Analítica</p>
              <p className="text-xs leading-snug text-ink-soft">Google Analytics, mediante Google Tag Manager: páginas visitadas, clics y uso de las funciones, sin datos personales identificables.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={analytics}
              aria-label="Cookies de analítica"
              onClick={() => setAnalytics((a) => !a)}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", analytics ? "bg-brand" : "bg-line")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", analytics ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {open ? (
          <button type="button" onClick={() => decide(analytics)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-strong">
            Guardar mi elección
          </button>
        ) : (
          <>
            <button type="button" onClick={() => { setAnalytics(readConsent() === "granted"); setOpen(true); }} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink hover:bg-surface-muted">
              Configurar
            </button>
            <button type="button" onClick={() => decide(false)} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-ink hover:bg-surface-muted">
              Rechazar
            </button>
            <button type="button" onClick={() => decide(true)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-strong">
              Aceptar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
