"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createOrder(planId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const plan = await prisma.plan.findUnique({
    where: {
      id: planId,
    },
  });

  if (!plan || !plan.isActive) {
    throw new Error("Gói không tồn tại hoặc đã bị tắt.");
  }

  await prisma.order.create({
    data: {
      userId: user.id,
      planId: plan.id,
      amount: plan.price,
      status: "PENDING",
      paymentMethod: "BANK_TRANSFER",
      note: "Đơn hàng tạo từ trang pricing",
    },
  });

  redirect("/billing");
}