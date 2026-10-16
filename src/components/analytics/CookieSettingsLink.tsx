"use client";

import { OPEN_CONSENT_EVENT } from "@/lib/analytics/consent";

// Reabre el banner para cambiar o retirar el consentimiento (obligatorio:
// retirarlo debe ser tan fácil como darlo).
export default function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Configurar cookies
    </button>
  );
}
