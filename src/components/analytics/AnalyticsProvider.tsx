"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CONSENT_EVENT,
  clearAnalyticsCookies,
  readConsent,
  type ConsentState,
} from "@/lib/analytics/consent";
import { describePath, normalizePath, track } from "@/lib/analytics/track";

// Carga Google Tag Manager solo con consentimiento de analítica y mide:
//   - page_view en cada navegación (App Router no recarga la página)
//   - scroll_depth (25/50/75/90 %)
//   - clics: en la web pública, todos los enlaces/botones; en la app y el
//     admin, solo los elementos con data-track (para no leer textos del
//     usuario). Atributos: data-track="nombre" y data-track-<param>="valor".
// Sin NEXT GTM_ID configurado no hace nada.
export default function AnalyticsProvider({ gtmId }: { gtmId?: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>("unset");
  const loaded = useRef(false);
  const sent = useRef<Set<number>>(new Set());

  // Estado de consentimiento (cookie) + cambios.
  useEffect(() => {
    const sync = () => {
      const next = readConsent();
      setConsent((prev) => {
        if (prev === "granted" && next !== "granted") {
          clearAnalyticsCookies();
          // La forma segura de detener el tag ya cargado es recargar.
          setTimeout(() => location.reload(), 50);
        }
        return next;
      });
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  // Carga de GTM tras el consentimiento.
  useEffect(() => {
    if (consent !== "granted" || !gtmId || loaded.current) return;
    loaded.current = true;
    const dl = (window.dataLayer = window.dataLayer || []);
    function gtag(...args: unknown[]) {
      dl.push(args as unknown as Record<string, unknown>);
    }
    gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    dl.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
    document.head.appendChild(s);
  }, [consent, gtmId]);

  // page_view por navegación (y al conceder el consentimiento).
  useEffect(() => {
    if (consent !== "granted") return;
    sent.current = new Set();
    track("page_view", {
      page_path: normalizePath(pathname),
      page_location: location.origin + normalizePath(pathname),
      ...describePath(pathname),
    });
  }, [pathname, consent]);

  // Scroll por profundidad.
  useEffect(() => {
    if (consent !== "granted") return;
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      if (total <= 0) return;
      const pct = ((h.scrollTop || document.body.scrollTop) / total) * 100;
      for (const mark of [25, 50, 75, 90]) {
        if (pct >= mark && !sent.current.has(mark)) {
          sent.current.add(mark);
          track("scroll_depth", { percent: mark, page_path: normalizePath(location.pathname) });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname, consent]);

  // Acciones de la app: cada petición de escritura (POST/PUT/PATCH/DELETE) a
  // /api/proyectos/... se mide como app_action, sin cuerpo ni identificadores.
  // Así queda cubierto TODO lo que se hace en los módulos sin etiquetar a mano
  // cada botón. Solo se mide dentro de /app y /admin.
  useEffect(() => {
    if (consent !== "granted") return;
    const original = window.fetch;
    window.fetch = async function patched(input: RequestInfo | URL, init?: RequestInit) {
      const res = await original.call(window, input, init);
      try {
        const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
        const raw = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
        const url = new URL(raw, location.origin);
        const kind = describePath(location.pathname).page_type;
        if (method !== "GET" && url.origin === location.origin && url.pathname.startsWith("/api/") && (kind === "app" || kind === "admin")) {
          const endpoint = normalizePath(url.pathname);
          const m = endpoint.match(/^\/api\/proyectos\/:id\/([^/]+)/);
          track("app_action", {
            module: m ? m[1] : endpoint.split("/")[2] || "api",
            endpoint,
            method,
            ok: res.ok,
            status: res.status,
          });
        }
      } catch {
        /* la medición nunca debe romper una petición */
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, [consent]);

  // Clics delegados.
  useEffect(() => {
    if (consent !== "granted") return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;

      const tagged = target.closest<HTMLElement>("[data-track]");
      if (tagged) {
        const params: Record<string, string> = {};
        for (const [k, v] of Object.entries(tagged.dataset)) {
          if (k.startsWith("track") && k !== "track" && v) {
            const key = k.slice(5).replace(/^./, (c) => c.toLowerCase()).replace(/([A-Z])/g, "_$1").toLowerCase();
            params[key] = v;
          }
        }
        track(tagged.dataset.track!, { ...params, page_path: normalizePath(location.pathname) });
        return;
      }

      // Auto-etiquetado solo en la web pública, legales y acceso.
      const kind = describePath(location.pathname).page_type;
      if (kind !== "marketing" && kind !== "legal" && kind !== "auth") return;
      const el = target.closest<HTMLElement>("a, button");
      if (!el) return;
      const section = el.closest<HTMLElement>("[data-section]")?.dataset.section;
      const text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (el instanceof HTMLAnchorElement && el.href) {
        const url = new URL(el.href, location.href);
        const external = url.origin !== location.origin;
        track(external ? "outbound_click" : "link_click", {
          link_text: text,
          link_url: external ? url.hostname : url.pathname + url.hash,
          section,
          page_path: normalizePath(location.pathname),
        });
      } else {
        track("button_click", { link_text: text, section, page_path: normalizePath(location.pathname) });
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [consent]);

  return null;
}
