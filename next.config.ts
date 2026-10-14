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
  // Rutas legacy de la fusión de módulos (Arquitectura→Keywords, TF-IDF→
  // Contenido, Enlaces/Canibalizaciones→Auditoría): bookmarks e historial
  // siguen funcionando. Los query params (?estudio=, ?keyword=) se
  // preservan automáticamente al no aparecer en el destination.
  async redirects() {
    return [
      {
        source: "/admin/proyectos/:id/arquitectura",
        destination: "/admin/proyectos/:id/keywords/arquitectura",
        permanent: false,
      },
      {
        source: "/admin/proyectos/:id/tfidf",
        destination: "/admin/proyectos/:id/contenido/tfidf",
        permanent: false,
      },
      {
        source: "/admin/proyectos/:id/enlaces",
        destination: "/admin/proyectos/:id/auditoria/enlaces",
        permanent: false,
      },
      {
        source: "/admin/proyectos/:id/canibalizaciones",
        destination: "/admin/proyectos/:id/auditoria/canibalizaciones",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
