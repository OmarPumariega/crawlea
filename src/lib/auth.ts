import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginIpLimiter, loginEmailLimiter, getClientIp } from "@/lib/rate-limit";

// Login de la plataforma. Dos vías:
// - Google OAuth: la vía de registro pública del SaaS. En el primer login se
//   crea la cuenta (role "user", plan "free"); los posteriores solo entran.
// - Credentials (email+contraseña): exclusiva del admin de la plataforma
//   (herencia del single-tenant); los usuarios de Google no tienen password.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/acceso" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim();
        if (!email || !credentials?.password) return null;

        // Rate limit: frena fuerza bruta por IP y por email.
        const headers = ((req as { headers?: Record<string, string> })?.headers) ?? {};
        const ip = getClientIp(headers);
        try {
          await loginIpLimiter.consume(ip || "unknown", 1);
        } catch {
          return null;
        }
        try {
          await loginEmailLimiter.consume(email, 1);
        } catch {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        // password null = cuenta creada vía Google: no puede entrar por aquí.
        if (!user?.password) return null;

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) return null;

        try {
          await loginEmailLimiter.delete(email);
        } catch {
          // noop
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
    // Solo se registra si hay credenciales de OAuth de login configuradas —
    // así el dev server sigue funcionando sin ellas. Es un OAuth client
    // DISTINTO del que usa el Módulo 6 (GSC/GA4): scopes básicos de perfil
    // y email, sin acceso a Search Console ni Analytics.
    ...(process.env.GOOGLE_AUTH_CLIENT_ID && process.env.GOOGLE_AUTH_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_AUTH_CLIENT_ID,
            clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    // Puerta de entrada común a ambas vías. Para el login con Google es el
    // único sitio donde se puede crear la cuenta al vuelo y rechazar
    // suspendidos ANTES de emitir token.
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;

      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing) {
        // Cuenta suspendida desde el panel de administración: no entra.
        if (existing.status === "suspended") return false;
        // Refresca nombre/avatar si cambiaron en Google (solo si la cuenta
        // no tiene password: el admin conserva sus datos tal cual).
        if (!existing.password && (existing.name !== (user.name ?? null) || existing.image !== (user.image ?? null))) {
          await prisma.user
            .update({
              where: { id: existing.id },
              data: { name: user.name ?? null, image: user.image ?? null },
            })
            .catch(() => {});
        }
        return true;
      }

      await prisma.user.create({
        data: {
          email: user.email,
          password: null,
          name: user.name ?? null,
          image: user.image ?? null,
          emailVerified: user.emailVerified ?? new Date(),
          role: "user",
          plan: "free",
        },
      });
      return true;
    },
    async jwt({ token, user, account }) {
      // Al (re)emitir token: pilla el estado fresco de la cuenta. Si el plan
      // o el rol cambiaron (webhook de Stripe, panel de admin), el siguiente
      // login lo recoge; la UI no puede fiarse del JWT para límites —
      // esos checks leen la BD en cada petición (auth-guards/plans).
      const email = token.email ?? user?.email;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, plan: true, status: true, name: true, image: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.plan = dbUser.plan;
          token.status = dbUser.status;
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      } else if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.plan = token.plan;
      session.user.status = token.status;
      return session;
    },
  },
};
