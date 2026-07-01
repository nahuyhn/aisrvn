import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSubscription } from "@/lib/subscription";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const FREE_USER_DAILY_LIMIT = 20;

function formatDate(date: Date | string | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

function getTodayStart() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function getOrderStatusText(status: string) {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PENDING":
      return "Chờ thanh toán";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      customerType: true,
      vipDiscount: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.status === "BANNED") {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="text-2xl font-bold text-red-300">
            Tài khoản đã bị khóa
          </h1>

          <p className="mt-3 text-sm text-red-100/80">
            Bạn không thể sử dụng dashboard. Vui lòng liên hệ hỗ trợ nếu đây là nhầm lẫn.
          </p>
        </div>
      </main>
    );
  }

  const [activeSubscription, usedToday, latestOrder, chatSessionCount] =
    await Promise.all([
      getActiveSubscription(user.id),
      prisma.usageLog.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: getTodayStart(),
          },
        },
      }),
      prisma.order.findFirst({
        where: {
          userId: user.id,
        },
        select: {
          id: true,
          amount: true,
          status: true,
          paymentCode: true,
          createdAt: true,
          paidAt: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.chatSession.count({
        where: {
          userId: user.id,
        },
      }),
    ]);

  const dailyLimit =
    activeSubscription?.plan.messageLimitPerDay || FREE_USER_DAILY_LIMIT;

  const remainingToday = Math.max(0, dailyLimit - usedToday);

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>

            <p className="mt-2 text-white/60">
              Xin chào, {user.name || user.email}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/chat"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              Vào Chat
            </Link>

            <Link
              href="/billing#plans"
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Mua / gia hạn gói
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-white/60">Gói hiện tại</p>

            <h2 className="mt-3 text-2xl font-bold">
              {activeSubscription ? activeSubscription.plan.name : "Gói miễn phí"}
            </h2>

            <p className="mt-2 text-sm text-white/50">
              {activeSubscription
                ? `Hết hạn: ${formatDate(activeSubscription.endAt)}`
                : "Bạn đang dùng lượt miễn phí. Nâng cấp để mở model trả phí."}
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-white/60">Lượt hôm nay</p>

            <h2 className="mt-3 text-2xl font-bold">
              {remainingToday}/{dailyLimit}
            </h2>

            <p className="mt-2 text-sm text-white/50">
              Đã dùng {usedToday} lượt trong ngày hôm nay.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-white/60">Cuộc trò chuyện</p>

            <h2 className="mt-3 text-2xl font-bold">{chatSessionCount}</h2>

            <p className="mt-2 text-sm text-white/50">
              Số cuộc trò chuyện đã lưu trong tài khoản.
            </p>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-semibold">Tài khoản</h2>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <span className="text-white/45">Email</span>
                <span className="text-right text-white">{user.email}</span>
              </div>

              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <span className="text-white/45">Role</span>
                <span className="text-right text-white">{user.role}</span>
              </div>

              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <span className="text-white/45">Loại khách hàng</span>
                <span className="text-right text-white">
                  {user.customerType === "VIP"
                    ? `VIP${user.vipDiscount ? ` · giảm ${user.vipDiscount}%` : ""}`
                    : "NORMAL"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/45">Ngày tạo</span>
                <span className="text-right text-white">{formatDate(user.createdAt)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Đơn hàng gần nhất</h2>

              <Link
                href="/billing"
                className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
              >
                Xem billing
              </Link>
            </div>

            {latestOrder ? (
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-white/45">Mã đơn</span>
                  <span className="font-mono text-white">
                    {latestOrder.paymentCode ?? "—"}
                  </span>
                </div>

                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-white/45">Gói</span>
                  <span className="text-white">{latestOrder.plan.name}</span>
                </div>

                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-white/45">Số tiền</span>
                  <span className="text-white">{formatPrice(latestOrder.amount)}</span>
                </div>

                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                  <span className="text-white/45">Trạng thái</span>
                  <span className="text-white">{getOrderStatusText(latestOrder.status)}</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Ngày tạo</span>
                  <span className="text-white">{formatDate(latestOrder.createdAt)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/50">
                Bạn chưa có đơn hàng nào.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
