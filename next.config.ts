import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// CSP real (Fase 4). Next.js inyecta scripts y estilos en línea, así que
// script-src/style-src necesitan 'unsafe-inline' (un nonce por petición
// exigiría renderizado dinámico de toda la web). Lo que sí se restringe: orígenes
// externos (solo imágenes https para avatares de Google y teselas de OpenStreetMap,
// y conexiones al propio origen), base-uri, objetos y framing. No se pone
// form-action: el acceso con Google hace un POST same-origin que redirige a
// accounts.google.com y Chrome bloquearía esa redirección.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com${isDev ? " ws: wss:" : ""}`,
  "frame-src https://www.googletagmanager.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // El build corre en un VPS Contabo compartido y muy cargado. Limitar los
  // CPUs de Next reduce los workers de Turbopack/SSG y, por tanto, el pico de
  // RAM que disparaba el OOM kill del contenedor de build de Coolify.
  experimental: {
    cpus: 2,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  // Redirects legacy del paso a SaaS: el panel interno vivía en /admin/* y
  // ahora es /app/* (en /admin vive el panel de administración de la
  // plataforma, Fase 2). Además siguen vigentes los de la fusión de módulos
  // (Arquitectura→Keywords, TF-IDF→Contenido, Enlaces/Canibalizaciones→
  // Auditoría): bookmarks e historial siguen funcionando. Los query params
  // (?estudio=, ?keyword=) se preservan automáticamente al no aparecer en el
  // destination. Orden: los específicos antes del catch-all de /admin.
  async redirects() {
    return [
      {
        source: "/admin/acceso",
        destination: "/acceso",
        permanent: false,
      },
      {
        source: "/app/proyectos/:id/arquitectura",
        destination: "/app/proyectos/:id/keywords/arquitectura",
        permanent: false,
      },
      {
        source: "/app/proyectos/:id/tfidf",
        destination: "/app/proyectos/:id/contenido/tfidf",
        permanent: false,
      },
      {
        source: "/app/proyectos/:id/enlaces",
        destination: "/app/proyectos/:id/auditoria/enlaces",
        permanent: false,
      },
      {
        source: "/app/proyectos/:id/backlinks",
        destination: "/app/proyectos/:id/competidores/backlinks",
        permanent: false,
      },
      {
        source: "/app/proyectos/:id/canibalizaciones",
        destination: "/app/proyectos/:id/auditoria/canibalizaciones",
        permanent: false,
      },
      // Rutas del antiguo panel interno (single-tenant). /admin, /admin/usuarios
      // y /admin/costes son ahora el panel de administración de la plataforma.
      {
        source: "/admin/proyectos/:path*",
        destination: "/app/proyectos/:path*",
        permanent: false,
      },
      {
        source: "/admin/configuracion",
        destination: "/app/configuracion",
        permanent: false,
      },
      {
        source: "/admin/perfil",
        destination: "/app/perfil",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
