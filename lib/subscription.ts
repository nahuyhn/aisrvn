import { prisma } from "@/lib/prisma";

export async function getActiveSubscription(userId: string) {
  const now = new Date();

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      startAt: {
        lte: now,
      },
      endAt: {
        gt: now,
      },
    },
    include: {
      plan: true,
    },
    orderBy: {
      endAt: "desc",
    },
  });

  return subscription;
}

export async function hasActiveSubscription(userId: string) {
  const subscription = await getActiveSubscription(userId);

  return Boolean(subscription);
}

export async function createSubscriptionFromOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      plan: true,
    },
  });

  if (!order) {
    throw new Error("Không tìm thấy đơn hàng.");
  }

  if (order.status !== "PAID") {
    throw new Error("Đơn hàng chưa được thanh toán.");
  }

  const startAt = new Date();
  const endAt = new Date(startAt);

  endAt.setDate(endAt.getDate() + order.plan.durationDays);

  const subscription = await prisma.subscription.create({
    data: {
      userId: order.userId,
      planId: order.planId,
      startAt,
      endAt,
      status: "ACTIVE",
    },
    include: {
      plan: true,
    },
  });

  return subscription;
}