import { prisma } from "@/lib/prisma";

type MaintenanceOptions = {
  now?: Date;
  pendingOrderMaxAgeHours?: number;
};

function getStaleOrderCutoff(now: Date, hours: number) {
  const cutoff = new Date(now);
  cutoff.setHours(cutoff.getHours() - hours);
  return cutoff;
}

export async function expireOldSubscriptions(now = new Date()) {
  const [expiredSubscriptions, expiredModelAccesses] = await Promise.all([
    prisma.subscription.updateMany({
      where: {
        status: "ACTIVE",
        endAt: {
          lte: now,
        },
      },
      data: {
        status: "EXPIRED",
      },
    }),
    prisma.userModelAccess.updateMany({
      where: {
        expiresAt: {
          lte: now,
        },
        source: {
          not: "EXPIRED",
        },
      },
      data: {
        source: "EXPIRED",
      },
    }),
  ]);

  return {
    expiredSubscriptions: expiredSubscriptions.count,
    expiredModelAccesses: expiredModelAccesses.count,
  };
}

export async function cancelStalePendingOrders(
  now = new Date(),
  pendingOrderMaxAgeHours = 24,
) {
  const cutoff = getStaleOrderCutoff(now, pendingOrderMaxAgeHours);

  const result = await prisma.order.updateMany({
    where: {
      status: "PENDING",
      createdAt: {
        lt: cutoff,
      },
    },
    data: {
      status: "CANCELLED",
      note: `Tự động hủy vì quá ${pendingOrderMaxAgeHours} giờ chưa thanh toán.`,
    },
  });

  return {
    cancelledPendingOrders: result.count,
    cutoff,
  };
}

export async function runMaintenance(options: MaintenanceOptions = {}) {
  const now = options.now || new Date();
  const pendingOrderMaxAgeHours = options.pendingOrderMaxAgeHours || 24;

  const [subscriptionResult, orderResult] = await Promise.all([
    expireOldSubscriptions(now),
    cancelStalePendingOrders(now, pendingOrderMaxAgeHours),
  ]);

  return {
    ...subscriptionResult,
    ...orderResult,
    ranAt: now,
    pendingOrderMaxAgeHours,
  };
}
