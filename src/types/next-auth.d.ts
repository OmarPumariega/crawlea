import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    role: string;
    emailVerified?: Date | null;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      plan: string;
      status: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    plan: string;
    status: string;
  }
}
