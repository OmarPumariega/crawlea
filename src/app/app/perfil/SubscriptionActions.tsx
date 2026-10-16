"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/analytics/track";

// Acciones de suscripción del perfil: con suscripción activa abre el portal de
// Stripe (cambiar plan, método de pago, facturas, cancelar); sin ella, enlaza a
// los planes.
export default function SubscriptionActions({ hasCustomer, paid, pagoOk = false, plan }: { hasCustomer: boolean; paid: boolean; pagoOk?: boolean; plan: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Vuelta de Stripe Checkout: evento de compra (sin importes de terceros).
  useEffect(() => {
    if (pagoOk) track("purchase", { plan, currency: "EUR" });
  }, [pagoOk, plan]);

  async function openPortal() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo abrir el portal.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el portal.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {paid || hasCustomer ? (
        <button
          type="button"
          onClick={openPortal}
          disabled={loading}
          data-track="manage_subscription_click"
          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Gestionar suscripción
        </button>
      ) : null}
      {!paid && (
        <Link
          href="/precios"
          data-track="upgrade_click"
          data-track-location="perfil"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          Mejorar plan
        </Link>
      )}
      {error && <p className="text-xs text-alert-ink">{error}</p>}
    </div>
  );
}
