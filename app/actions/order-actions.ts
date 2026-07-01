"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { activatePaidOrder } from "@/lib/order-activation";
import { getAppUrl, getPayOS } from "@/lib/payos";
import { prisma } from "@/lib/prisma";

async function generateUniquePaymentCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const paymentCode = randomInt(100_000_000, 2_147_000_000);

    const existingOrder = await prisma.order.findUnique({
      where: {
        paymentCode,
      },
      select: {
        id: true,
      },
    });

    if (!existingOrder) {
      return paymentCode;
    }
  }

  throw new Error("Không tạo được mã thanh toán duy nhất. Hãy thử lại.");
}

function getPayOSDescription(paymentCode: number) {
  return `AIWRAP ${paymentCode}`.slice(0, 25);
}

async function getCurrentBillingUser() {
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

  if (user.status === "BANNED") {
    throw new Error("Tài khoản của bạn đã bị khóa.");
  }

  return user;
}

function getPaymentInfo(rawResponse: unknown) {
  const response = rawResponse as {
    data?: unknown;
    status?: unknown;
    amountPaid?: unknown;
    amountRemaining?: unknown;
    id?: unknown;
  };

  const nestedData = response.data as
    | {
        status?: unknown;
        amountPaid?: unknown;
        amountRemaining?: unknown;
        id?: unknown;
      }
    | undefined;

  const paymentData = nestedData?.status ? nestedData : response;

  return {
    status:
      typeof paymentData.status === "string"
        ? paymentData.status.toUpperCase()
        : "",
    amountPaid: Number(paymentData.amountPaid || 0),
    amountRemaining: Number(paymentData.amountRemaining || 0),
    paymentLinkId:
      typeof paymentData.id === "string" ? paymentData.id : undefined,
  };
}

export async function createOrder(planId: string, formData: FormData) {
  const termsAccepted = formData.get("termsAccepted") === "on";

  if (!termsAccepted) {
    throw new Error(
      "Bạn cần đồng ý Điều khoản dịch vụ trước khi thanh toán.",
    );
  }

  const user = await getCurrentBillingUser();

  const plan = await prisma.plan.findUnique({
    where: {
      id: planId,
    },
  });

  if (!plan || !plan.isActive) {
    throw new Error("Gói không tồn tại hoặc đã bị tắt.");
  }

  if (!Number.isInteger(plan.price) || plan.price <= 0) {
    throw new Error("Giá gói không hợp lệ.");
  }

  const appUrl = getAppUrl();
  const paymentCode = await generateUniquePaymentCode();

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      planId: plan.id,
      amount: plan.price,
      status: "PENDING",
      paymentMethod: "PAYOS",
      paymentProvider: "PAYOS",
      paymentCode,
      note: `Đơn PayOS cho ${plan.name}`,
    },
  });

  let checkoutUrl: string;

  try {
    const paymentLink = await getPayOS().paymentRequests.create({
      orderCode: paymentCode,
      amount: plan.price,
      description: getPayOSDescription(paymentCode),
      items: [
        {
          name: plan.name.slice(0, 100),
          quantity: 1,
          price: plan.price,
        },
      ],
      returnUrl: `${appUrl}/billing?payment=success&orderCode=${paymentCode}`,
      cancelUrl: `${appUrl}/billing?payment=cancel&orderCode=${paymentCode}`,
    });

    if (!paymentLink.checkoutUrl) {
      throw new Error("PayOS không trả về checkoutUrl.");
    }

    checkoutUrl = paymentLink.checkoutUrl;

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        paymentLinkId: paymentLink.paymentLinkId,
      },
    });
  } catch (error) {
    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: "CANCELLED",
        note: `Tạo link PayOS thất bại: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
    });

    throw error;
  }

  redirect(checkoutUrl);
}

export async function checkPendingOrder(formData: FormData) {
  const user = await getCurrentBillingUser();
  const orderId = formData.get("orderId");

  if (typeof orderId !== "string" || !orderId) {
    throw new Error("Thiếu mã đơn hàng.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: user.id,
    },
    select: {
      id: true,
      amount: true,
      status: true,
      paymentCode: true,
      paymentLinkId: true,
      note: true,
    },
  });

  if (!order) {
    throw new Error("Không tìm thấy đơn hàng.");
  }

  if (order.status === "PAID") {
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return;
  }

  if (!order.paymentCode) {
    throw new Error("Đơn hàng thiếu mã PayOS.");
  }

  const payOS = getPayOS() as unknown as {
    get: (path: string) => Promise<unknown>;
  };

  const rawPaymentInfo = await payOS.get(
    `/v2/payment-requests/${order.paymentCode}`,
  );

  const paymentInfo = getPaymentInfo(rawPaymentInfo);

  if (
    order.paymentLinkId &&
    paymentInfo.paymentLinkId &&
    paymentInfo.paymentLinkId !== order.paymentLinkId
  ) {
    throw new Error("Thông tin PayOS không khớp với đơn hàng.");
  }

  if (
    paymentInfo.status === "PAID" &&
    paymentInfo.amountPaid >= order.amount &&
    paymentInfo.amountRemaining <= 0
  ) {
    await activatePaidOrder(order.id, {
      sourcePrefix: "PAYOS_CHECK",
      paymentMethod: "PAYOS",
      paymentProvider: "PAYOS",
      note: order.note || "Kích hoạt sau khi người dùng bấm kiểm tra lại PayOS.",
      allowedCurrentStatuses: ["PENDING", "CANCELLED"],
    });
  } else if (
    paymentInfo.status === "CANCELLED" ||
    paymentInfo.status === "EXPIRED"
  ) {
    await prisma.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        note: `PayOS trả về trạng thái ${paymentInfo.status}.`,
      },
    });
  } else {
    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        note: `Đã kiểm tra PayOS, trạng thái hiện tại: ${
          paymentInfo.status || "UNKNOWN"
        }.`,
      },
    });
  }

  revalidatePath("/billing");
  revalidatePath("/dashboard");
}
