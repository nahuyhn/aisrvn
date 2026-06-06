import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL || "huynhbinhan.n@gmail.com";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || "";
}

export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);

  const sessionEmail = normalizeEmail(session?.user?.email);
  const superAdminEmail = normalizeEmail(SUPER_ADMIN_EMAIL);

  if (!sessionEmail) {
    redirect("/login");
  }

  if (sessionEmail !== superAdminEmail) {
    redirect("/chat");
  }

  const user = await prisma.user.findUnique({
    where: {
      email: sessionEmail,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      customerType: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.status !== UserStatus.ACTIVE) {
    redirect("/login");
  }

  return user;
}

export async function getSuperAdminUser() {
  const session = await getServerSession(authOptions);

  const sessionEmail = normalizeEmail(session?.user?.email);
  const superAdminEmail = normalizeEmail(SUPER_ADMIN_EMAIL);

  if (!sessionEmail) {
    return null;
  }

  if (sessionEmail !== superAdminEmail) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email: sessionEmail,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      customerType: true,
    },
  });

  if (!user) {
    return null;
  }

  if (user.status !== UserStatus.ACTIVE) {
    return null;
  }

  return user;
}