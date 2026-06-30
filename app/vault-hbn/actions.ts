"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getPositiveInt(formData: FormData, key: string) {
  const value = Number.parseInt(getString(formData, key), 10);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} không hợp lệ.`);
  }

  return value;
}

function revalidateAdmin() {
  revalidatePath("/vault-hbn");
  revalidatePath("/vault-hbn/orders");
  revalidatePath("/vault-hbn/users");
  revalidatePath("/vault-hbn/vip");
  revalidatePath("/vault-hbn/plans");
  revalidatePath("/vault-hbn/usage");
  revalidatePath("/vault-hbn/revenue");
}

export async function setUserStatus(formData: FormData) {
  await requireSuperAdmin();

  const userId = getString(formData, "userId");
  const status = getString(formData, "status") === "BANNED" ? "BANNED" : "ACTIVE";

  if (!userId) {
    throw new Error("Thiếu userId.");
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      status,
    },
  });

  revalidateAdmin();
}

export async function updateUserVip(formData: FormData) {
  await requireSuperAdmin();

  const userId = getString(formData, "userId");
  const customerType = getString(formData, "customerType") === "VIP" ? "VIP" : "NORMAL";
  const rawDiscount = getString(formData, "vipDiscount");
  const vipDiscount = rawDiscount
    ? Math.min(100, Math.max(0, Number.parseInt(rawDiscount, 10) || 0))
    : null;
  const vipNote = getString(formData, "vipNote") || null;

  if (!userId) {
    throw new Error("Thiếu userId.");
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      customerType,
      vipDiscount: customerType === "VIP" ? vipDiscount : null,
      vipNote: customerType === "VIP" ? vipNote : null,
    },
  });

  revalidateAdmin();
}

export async function createPlan(formData: FormData) {
  await requireSuperAdmin();

  const name = getString(formData, "name");
  const price = getPositiveInt(formData, "price");
  const durationDays = getPositiveInt(formData, "durationDays");
  const messageLimitPerDay = getPositiveInt(formData, "messageLimitPerDay");

  if (!name) {
    throw new Error("Tên gói không được để trống.");
  }

  if (durationDays <= 0 || messageLimitPerDay <= 0) {
    throw new Error("Thời hạn và lượt dùng phải lớn hơn 0.");
  }

  await prisma.plan.create({
    data: {
      name,
      price,
      durationDays,
      messageLimitPerDay,
      isActive: true,
    },
  });

  revalidateAdmin();
}

export async function updatePlan(formData: FormData) {
  await requireSuperAdmin();

  const planId = getString(formData, "planId");
  const name = getString(formData, "name");
  const price = getPositiveInt(formData, "price");
  const durationDays = getPositiveInt(formData, "durationDays");
  const messageLimitPerDay = getPositiveInt(formData, "messageLimitPerDay");
  const isActive = formData.get("isActive") === "on";

  if (!planId || !name) {
    throw new Error("Thiếu thông tin gói.");
  }

  if (durationDays <= 0 || messageLimitPerDay <= 0) {
    throw new Error("Thời hạn và lượt dùng phải lớn hơn 0.");
  }

  await prisma.plan.update({
    where: {
      id: planId,
    },
    data: {
      name,
      price,
      durationDays,
      messageLimitPerDay,
      isActive,
    },
  });

  revalidateAdmin();
}

export async function togglePlanStatus(formData: FormData) {
  await requireSuperAdmin();

  const planId = getString(formData, "planId");
  const isActive = getString(formData, "isActive") === "true";

  if (!planId) {
    throw new Error("Thiếu planId.");
  }

  await prisma.plan.update({
    where: {
      id: planId,
    },
    data: {
      isActive,
    },
  });

  revalidateAdmin();
}

export async function updatePlanModels(formData: FormData) {
  await requireSuperAdmin();

  const planId = getString(formData, "planId");
  const modelIds = Array.from(new Set(formData.getAll("modelIds").filter((value): value is string => typeof value === "string")));

  if (!planId) {
    throw new Error("Thiếu planId.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.planModel.deleteMany({
      where: {
        planId,
      },
    });

    for (const modelId of modelIds) {
      await tx.planModel.create({
        data: {
          planId,
          modelId,
        },
      });
    }
  });

  revalidateAdmin();
}

export async function setOrderStatus(formData: FormData) {
  await requireSuperAdmin();

  const orderId = getString(formData, "orderId");
  const status = getString(formData, "status");
  const adminNote = getString(formData, "adminNote");

  if (!orderId) {
    throw new Error("Thiếu orderId.");
  }

  if (status === "CANCELLED") {
    await prisma.order.updateMany({
      where: {
        id: orderId,
        status: {
          not: "PAID",
        },
      },
      data: {
        status: "CANCELLED",
        note: adminNote || "Admin hủy đơn thủ công.",
      },
    });

    revalidateAdmin();
    return;
  }

  if (status !== "PAID") {
    throw new Error("Trạng thái đơn không hợp lệ.");
  }

  await prisma.$transaction(async (tx) => {
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

    const updatedOrder = await tx.order.updateMany({
      where: {
        id: order.id,
        status: {
          not: "PAID",
        },
      },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: order.paymentMethod || "ADMIN",
        paymentProvider: order.paymentProvider || "ADMIN",
        note: adminNote || order.note || "Admin kích hoạt thủ công.",
      },
    });

    if (updatedOrder.count === 0) {
      return;
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
          source: `ADMIN:${order.id}`,
        },
        update: {
          expiresAt: endAt,
          source: `ADMIN:${order.id}`,
        },
      });
    }
  });

  revalidateAdmin();
}

export async function cancelSubscription(formData: FormData) {
  await requireSuperAdmin();

  const subscriptionId = getString(formData, "subscriptionId");

  if (!subscriptionId) {
    throw new Error("Thiếu subscriptionId.");
  }

  await prisma.subscription.update({
    where: {
      id: subscriptionId,
    },
    data: {
      status: "CANCELLED",
      endAt: new Date(),
    },
  });

  revalidateAdmin();
}
