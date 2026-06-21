"use server";

import { randomInt } from "crypto";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
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

export async function createOrder(
  planId: string,
  formData: FormData
) {const termsAccepted = formData.get("termsAccepted") === "on";

if (!termsAccepted) {
  throw new Error(
    "Bạn cần đồng ý Điều khoản dịch vụ trước khi thanh toán."
  );
}
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

// Quan trọng: redirect phải nằm ngoài try/catch
redirect(checkoutUrl);
}