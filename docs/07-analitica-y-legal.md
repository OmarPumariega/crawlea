# 07 — Analítica, consentimiento y textos legales

## Servicios de Google (proyecto Cloud «Crawlea», id `crawlea`)

- **GA4:** cuenta y propiedad «Crawlea», flujo web `crawlea.com`, ID de medición `G-JKM87HCRKL`.
  Medición mejorada DESACTIVADA (medimos nosotros). Retención de eventos: 14 meses.
  16 dimensiones personalizadas de evento (module, submodule, page_type, page_path, endpoint,
  location, section, link_text, link_url, plan, feature, question, form_id, method, percent,
  issues_count). Si se añade un parámetro nuevo a `track()`, hay que registrarlo ahí y como
  variable de capa de datos en GTM, o no saldrá en los informes.
- **GTM:** contenedor `GTM-MBZ2CDXB` (variable de runtime `GTM_ID` en `/opt/crawlea/.env`).
  Contiene: etiqueta de Google (GA4), una etiqueta genérica de evento (`{{Event}}` + 29
  parámetros `DLV - …`), disparadores `CE - Eventos Crawlea` / `CE - Identify` y un bloqueo
  `Bloqueo - usuario interno` (no mide al admin). Se versiona/exporta en Administrador →
  Exportar contenedor.
- **Search Console:** propiedad `https://crawlea.com/` verificada por meta (`layout.tsx`).
  Sitemap enviado. **Bing Webmaster Tools:** verificado por meta, sitemap enviado.
- **Google Auth Platform:** app en producción; clientes «Inicio de sesión» (`GOOGLE_AUTH_*`) y
  «Search Console y Analytics» (`GOOGLE_CLIENT_*`); scopes `webmasters.readonly` (no sensible) y
  `analytics.readonly` (sensible → requiere verificación). Clave PageSpeed restringida por IP.

## Cómo se mide (código)

- `src/lib/analytics/track.ts`: `track(evento, params)` — solo empuja a `dataLayer` con
  consentimiento. **Nunca** enviar emails, dominios de clientes, palabras clave ni textos del usuario.
- `src/components/analytics/AnalyticsProvider.tsx`: carga GTM tras el consentimiento; `page_view`
  por navegación, `scroll_depth`, clics delegados (web pública: todos; app/admin: solo
  `data-track`) y `app_action` por cada POST/PUT/PATCH/DELETE a `/api/...` (módulo + endpoint
  normalizado, sin cuerpo ni ids).
- `data-track="evento" data-track-<param>="valor"` etiqueta cualquier elemento.
- Identidad anónima: `AnalyticsIdentity` (HMAC del id de usuario, plan, `internal_user`).
- Consentimiento: cookie `crawlea_consent` (`v1:a1|a0`), banner `CookieBanner`, reabrible con
  «Configurar cookies» en el pie. Si cambia `CONSENT_VERSION` se vuelve a preguntar.

## Textos legales

Páginas en `/legal/{aviso-legal,privacidad,cookies,terminos,condiciones-contratacion}`. Los datos
del titular están en `src/lib/legal/company.ts` (valores entre corchetes = PENDIENTES; el aviso de
«texto en revisión» desaparece solo al rellenarlos). Al cambiar el contenido de forma
sustancial, subir `LEGAL_VERSION`: el modal `TermsGate` volverá a pedir aceptación y se registra
en `User.termsAcceptedAt/termsVersion`. Los textos son borradores: revisarlos con un abogado.
