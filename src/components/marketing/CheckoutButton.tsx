"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/analytics/track";

// Botón de plan de pago para usuarios con sesión: crea la sesión de Stripe
// Checkout y redirige. El plan lo confirma el webhook, no este botón.
export default function CheckoutButton({
  plan,
  priceEur,
  className,
  children,
  autoStart = false,
}: {
  plan: string;
  autoStart?: boolean;
  priceEur: number;
  className: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  async function go() {
    setError("");
    setLoading(true);
    track("begin_checkout", { plan, value: priceEur, currency: "EUR" });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo iniciar el pago.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
      setLoading(false);
    }
  }

  // Vuelta del registro con ?plan=: lanza el pago una sola vez.
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void go();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <>
      <button type="button" onClick={go} disabled={loading} className={className + " disabled:opacity-60"}>
        {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : children}
      </button>
      {error && <p className="mt-2 text-center text-xs text-alert-ink">{error}</p>}
    </>
  );
}
