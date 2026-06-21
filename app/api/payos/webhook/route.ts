import { NextResponse } from "next/server";
import { getPayOS } from "@/lib/payos";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "PayOS webhook is running",
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Xác minh chữ ký webhook bằng Checksum Key
    const payment = await getPayOS().webhooks.verify(payload);

    const orderCode = Number(payment.orderCode);
    const paidAmount = Number(payment.amount);

    if (!Number.isSafeInteger(orderCode)) {
      return NextResponse.json({ success: true });
    }

    const order = await prisma.order.findUnique({
      where: {
        paymentCode: orderCode,
      },
      include: {
        plan: {
          include: {
            planModels: true,
          },
        },
      },
    });

    // PayOS có thể gửi dữ liệu mẫu lúc cài webhook
    if (!order) {
      console.log("Webhook PayOS: không tìm thấy order", orderCode);

      return NextResponse.json({
        success: true,
      });
    }

    // Không active nếu số tiền không đúng
    if (order.amount !== paidAmount) {
      console.error("Webhook PayOS: sai số tiền", {
        orderCode,
        expected: order.amount,
        received: paidAmount,
      });

      return NextResponse.json({
        success: true,
      });
    }

    // Kiểm tra đúng payment link đã tạo
    if (
      order.paymentLinkId &&
      payment.paymentLinkId !== order.paymentLinkId
    ) {
      console.error("Webhook PayOS: sai paymentLinkId", {
        orderCode,
      });

      return NextResponse.json({
        success: true,
      });
    }

    await prisma.$transaction(async (tx) => {
      // updateMany giúp webhook gửi lại cũng không tạo gói lần hai
      const updatedOrder = await tx.order.updateMany({
  where: {
    id: order.id,
    status: {
      in: ["PENDING", "CANCELLED"],
    },
  },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: "PAYOS",
          paymentProvider: "PAYOS",
        },
      });

      // Đơn đã xử lý trước đó
      if (updatedOrder.count === 0) {
        return;
      }

      const now = new Date();

      // Nếu đang còn gói thì nối tiếp từ ngày hết hạn
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

      endAt.setUTCDate(
        endAt.getUTCDate() + order.plan.durationDays
      );

      // Active gói
      await tx.subscription.create({
        data: {
          userId: order.userId,
          planId: order.planId,
          startAt,
          endAt,
          status: "ACTIVE",
        },
      });

      // Mở các model thuộc gói
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
            source: `PAYOS:${order.id}`,
          },
          update: {
            expiresAt: endAt,
            source: `PAYOS:${order.id}`,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("PayOS webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Webhook không hợp lệ",
      },
      {
        status: 400,
      }
    );
  }
}