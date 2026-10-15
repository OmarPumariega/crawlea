import { withAuth } from "next-auth/middleware";

// Capa de páginas: /app requiere sesión; /admin (panel de administración de
// la plataforma) exige además role admin. Las rutas API NO pasan por aquí —
// cada handler hace su propio requireSession()/projectForSession()
// (src/lib/auth-guards.ts), que verifica la suspensión contra BD en cada
// petición; esta capa es solo primera línea para las páginas.
export default withAuth({
  pages: {
    signIn: "/acceso",
  },
  callbacks: {
    authorized({ req, token }) {
      if (req.nextUrl.pathname.startsWith("/admin")) {
        return token?.role === "admin";
      }
      return !!token;
    },
  },
});

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
