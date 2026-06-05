import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: user.email,
        },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            image: user.image,
          },
        });
      } else {
        await prisma.user.update({
          where: {
            email: user.email,
          },
          data: {
            name: user.name,
            image: user.image,
          },
        });
      }

      return true;
    },

    async session({ session }) {
      if (!session.user?.email) {
        return session;
      }

      const dbUser = await prisma.user.findUnique({
        where: {
          email: session.user.email,
        },
      });

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.role = dbUser.role;
        session.user.status = dbUser.status;
      }

      return session;
    },
  },
};