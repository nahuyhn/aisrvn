import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ActivatePaidOrderOptions = {
  sourcePrefix?: string;
  note?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  paidAt?: Date;
  allowedCurrentStatuses?: Array<"PENDING" | "CANCELLED">;
};

export async function activatePaidOrder(
  orderId: string,
  options: ActivatePaidOrderOptions = {},
) {
  return prisma.$transaction((tx) => activatePaidOrderInTx(tx, orderId, options));
}

export async function activatePaidOrderInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  options: ActivatePaidOrderOptions = {},
) {
  const order = await tx.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      plan: {
        include: {
          planModels: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Không tìm thấy đơn hàng.");
  }

  const allowedCurrentStatuses = options.allowedCurrentStatuses || [
    "PENDING",
    "CANCELLED",
  ];

  const updatedOrder = await tx.order.updateMany({
    where: {
      id: order.id,
      status: {
        in: allowedCurrentStatuses,
      },
    },
    data: {
      status: "PAID",
      paidAt: options.paidAt || new Date(),
      paymentMethod: options.paymentMethod || order.paymentMethod || "PAYOS",
      paymentProvider: options.paymentProvider || order.paymentProvider || "PAYOS",
      note: options.note || order.note,
    },
  });

  if (updatedOrder.count === 0) {
    return {
      activated: false,
      orderId: order.id,
      userId: order.userId,
      planId: order.planId,
      endAt: null,
    };
  }

  const now = new Date();

  const currentSubscription = await tx.subscription.findFirst({
    where: {
      userId: order.userId,
      status: "ACTIVE",
      endAt: {
        gt: now,
      },
    },
    orderBy: {
      endAt: "desc",
    },
  });

  const startAt = currentSubscription?.endAt ?? now;
  const endAt = new Date(startAt);
  endAt.setUTCDate(endAt.getUTCDate() + order.plan.durationDays);

  await tx.subscription.create({
    data: {
      userId: order.userId,
      planId: order.planId,
      startAt,
      endAt,
      status: "ACTIVE",
    },
  });

  const sourcePrefix = options.sourcePrefix || "ORDER";

  for (const planModel of order.plan.planModels) {
    await tx.userModelAccess.upsert({
      where: {
        userId_modelId: {
          userId: order.userId,
          modelId: planModel.modelId,
        },
      },
      create: {
        userId: order.userId,
        modelId: planModel.modelId,
        expiresAt: endAt,
        source: `${sourcePrefix}:${order.id}`,
      },
      update: {
        expiresAt: endAt,
        source: `${sourcePrefix}:${order.id}`,
      },
    });
  }

  return {
    activated: true,
    orderId: order.id,
    userId: order.userId,
    planId: order.planId,
    endAt,
  };
}
