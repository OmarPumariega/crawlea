import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

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
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
  // Redirects legacy del paso a SaaS: el panel interno vivía en /admin/* y
  // ahora es /app/* (en /admin vivirá el panel de administración de la
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
        source: "/app/proyectos/:id/canibalizaciones",
        destination: "/app/proyectos/:id/auditoria/canibalizaciones",
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: "/app/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
