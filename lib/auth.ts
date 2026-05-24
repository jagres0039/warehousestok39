import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/zod-schemas";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      locale: string;
    } & DefaultSession["user"];
    activeOrganizationId: string | null;
    activeRole: Role | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    locale: string;
    activeOrganizationId: string | null;
    activeRole: Role | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: {
            memberships: {
              include: { organization: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        });
        if (!user) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        const firstMembership = user.memberships[0];
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          locale: user.locale,
          activeOrganizationId: firstMembership?.organizationId ?? null,
          activeRole: firstMembership?.role ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as typeof user & {
          locale?: string;
          activeOrganizationId?: string | null;
          activeRole?: Role | null;
        };
        token.userId = u.id ?? token.userId;
        token.locale = u.locale ?? token.locale ?? "id";
        token.activeOrganizationId = u.activeOrganizationId ?? token.activeOrganizationId ?? null;
        token.activeRole = u.activeRole ?? token.activeRole ?? null;
      }

      if (trigger === "update" && session) {
        const patch = session as Partial<{
          activeOrganizationId: string;
          activeRole: Role;
          locale: string;
        }>;
        if (patch.activeOrganizationId) token.activeOrganizationId = patch.activeOrganizationId;
        if (patch.activeRole) token.activeRole = patch.activeRole;
        if (patch.locale) token.locale = patch.locale;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.locale = token.locale ?? "id";
      session.activeOrganizationId = token.activeOrganizationId ?? null;
      session.activeRole = token.activeRole ?? null;
      return session;
    },
  },
});
