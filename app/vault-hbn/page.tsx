import Link from "next/link";
import { prisma } from "@/lib/prisma";

function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return value.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function AdminPage() {
  const todayStart = getTodayStart();

  const [
    userCount,
    orderCount,
    pendingOrderCount,
    activeSubscriptionCount,
    usageTodayCount,
    totalRevenue,
    todayRevenue,
    recentOrders,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        endAt: {
          gt: new Date(),
        },
      },
    }),
    prisma.usageLog.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    }),
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: {
        status: "PAID",
        paidAt: {
          gte: todayStart,
        },
      },
      _sum: { amount: true },
    }),
    prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, name: true } },
        plan: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        customerType: true,
        createdAt: true,
      },
    }),
  ]);

  const cards = [
    { label: "Người dùng", value: userCount.toLocaleString("vi-VN"), href: "/vault-hbn/users" },
    { label: "Đơn hàng", value: orderCount.toLocaleString("vi-VN"), href: "/vault-hbn/orders" },
    { label: "Đơn pending", value: pendingOrderCount.toLocaleString("vi-VN"), href: "/vault-hbn/orders" },
    { label: "Gói đang active", value: activeSubscriptionCount.toLocaleString("vi-VN"), href: "/vault-hbn/users" },
    { label: "Lượt chat hôm nay", value: usageTodayCount.toLocaleString("vi-VN"), href: "/vault-hbn/usage" },
    { label: "Doanh thu tổng", value: formatMoney(totalRevenue._sum.amount), href: "/vault-hbn/revenue" },
    { label: "Doanh thu hôm nay", value: formatMoney(todayRevenue._sum.amount), href: "/vault-hbn/revenue" },
    { label: "Quản lý gói", value: "Mở", href: "/vault-hbn/plans" },
    { label: "Free AI Router", value: "Mở", href: "/vault-hbn/free-ai" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-white/60">
          Bảng quản trị thật cho user, đơn hàng, doanh thu, gói dịch vụ và lượt sử dụng.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-400/40 hover:bg-white/[0.07]"
          >
            <p className="text-sm text-white/55">{card.label}</p>
            <h2 className="mt-3 text-2xl font-bold">{card.value}</h2>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Đơn hàng mới</h2>
            <Link href="/vault-hbn/orders" className="text-sm text-emerald-300 hover:text-emerald-200">
              Xem tất cả
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-white/35">
                <tr>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Gói</th>
                  <th className="py-2 pr-3">Tiền</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2 pr-3">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="text-white/75">
                    <td className="py-3 pr-3">{order.user.name || order.user.email}</td>
                    <td className="py-3 pr-3">{order.plan.name}</td>
                    <td className="py-3 pr-3">{formatMoney(order.amount)}</td>
                    <td className="py-3 pr-3">{order.status}</td>
                    <td className="py-3 pr-3">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">User mới</h2>
            <Link href="/vault-hbn/users" className="text-sm text-emerald-300 hover:text-emerald-200">
              Quản lý user
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentUsers.map((user) => (
              <div key={user.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="font-medium">{user.name || "Chưa có tên"}</div>
                <div className="mt-1 text-xs text-white/45">{user.email}</div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-2 py-1">{user.status}</span>
                  <span className="rounded-full bg-white/10 px-2 py-1">{user.customerType}</span>
                  <span className="rounded-full bg-white/10 px-2 py-1">{formatDate(user.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
