"use client";

import { useEffect } from "react";
import { CONSENT_EVENT, readConsent } from "@/lib/analytics/consent";
import { track } from "@/lib/analytics/track";

// Identifica (de forma anónima) a la persona dentro de la app: `userKey` es un
// HMAC del id de usuario calculado en el servidor, no el id real ni el email.
// Sirve para contar usuarios únicos y seguir su uso de módulos en GA4 (user_id).
// `internal` marca al admin de la plataforma para excluirlo de las métricas.
export default function AnalyticsIdentity({
  userKey,
  plan,
  internal,
  justCreated,
}: {
  userKey: string;
  plan: string;
  internal: boolean;
  justCreated: boolean;
}) {
  useEffect(() => {
    const push = () => {
      if (readConsent() !== "granted") return;
      track("identify", { user_id: userKey, user_plan: plan, internal_user: internal });
      if (justCreated) {
        try {
          if (!localStorage.getItem("crawlea:signupTracked")) {
            localStorage.setItem("crawlea:signupTracked", "1");
            track("sign_up", { method: "google" });
          }
        } catch {
          /* sin almacenamiento: no se mide */
        }
      }
    };
    push();
    window.addEventListener(CONSENT_EVENT, push);
    return () => window.removeEventListener(CONSENT_EVENT, push);
  }, [userKey, plan, internal, justCreated]);
  return null;
}
