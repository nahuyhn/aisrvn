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

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AdminRevenuePage() {
  const today = startOfToday();
  const last7 = daysAgo(7);
  const last30 = daysAgo(30);

  const [totalPaid, todayPaid, sevenPaid, thirtyPaid, paidOrders, revenueByPlan] = await Promise.all([
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: "PAID", paidAt: { gte: today } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: "PAID", paidAt: { gte: last7 } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: "PAID", paidAt: { gte: last30 } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.findMany({
      where: { status: "PAID", paidAt: { gte: last30 } },
      orderBy: { paidAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true } },
      },
    }),
    prisma.order.groupBy({
      by: ["planId"],
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const planIds = revenueByPlan.map((item) => item.planId);
  const plans = await prisma.plan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, name: true },
  });
  const planMap = new Map(plans.map((plan) => [plan.id, plan.name]));

  const dailyMap = new Map<string, { revenue: number; count: number }>();

  for (let i = 29; i >= 0; i--) {
    const date = daysAgo(i);
    dailyMap.set(dayKey(date), { revenue: 0, count: 0 });
  }

  for (const order of paidOrders) {
    const paidAt = order.paidAt || order.updatedAt;
    const key = dayKey(paidAt);
    const current = dailyMap.get(key) || { revenue: 0, count: 0 };
    current.revenue += order.amount;
    current.count += 1;
    dailyMap.set(key, current);
  }

  const dailyRows = Array.from(dailyMap.entries()).reverse();
  const topPlanRows = revenueByPlan
    .sort((a, b) => (b._sum.amount || 0) - (a._sum.amount || 0))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Doanh thu</h1>
        <p className="mt-2 text-white/60">
          Tổng hợp doanh thu paid, số đơn và doanh thu theo ngày/gói.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Tổng paid</p>
          <h2 className="mt-2 text-2xl font-bold">{formatMoney(totalPaid._sum.amount)}</h2>
          <p className="mt-1 text-xs text-white/40">{totalPaid._count._all} đơn</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Hôm nay</p>
          <h2 className="mt-2 text-2xl font-bold">{formatMoney(todayPaid._sum.amount)}</h2>
          <p className="mt-1 text-xs text-white/40">{todayPaid._count._all} đơn</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">7 ngày</p>
          <h2 className="mt-2 text-2xl font-bold">{formatMoney(sevenPaid._sum.amount)}</h2>
          <p className="mt-1 text-xs text-white/40">{sevenPaid._count._all} đơn</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">30 ngày</p>
          <h2 className="mt-2 text-2xl font-bold">{formatMoney(thirtyPaid._sum.amount)}</h2>
          <p className="mt-1 text-xs text-white/40">{thirtyPaid._count._all} đơn</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold">Doanh thu theo gói</h2>
          <div className="mt-4 space-y-2">
            {topPlanRows.length === 0 ? <p className="text-sm text-white/45">Chưa có đơn paid.</p> : null}
            {topPlanRows.map((item) => (
              <div key={item.planId} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{planMap.get(item.planId) || item.planId}</span>
                  <span className="font-bold">{formatMoney(item._sum.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-white/40">{item._count._all} đơn paid</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold">30 ngày gần nhất</h2>
          <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {dailyRows.map(([date, value]) => (
              <div key={date} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span>{date}</span>
                  <span className="font-semibold">{formatMoney(value.revenue)}</span>
                </div>
                <p className="mt-1 text-xs text-white/40">{value.count} đơn</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold">Đơn paid gần đây</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-white/35">
              <tr>
                <th className="py-2 pr-3">PaidAt</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Gói</th>
                <th className="py-2 pr-3">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {paidOrders.slice(0, 100).map((order) => (
                <tr key={order.id} className="text-white/70">
                  <td className="py-3 pr-3">{formatDate(order.paidAt)}</td>
                  <td className="py-3 pr-3">
                    <div className="max-w-64 truncate">{order.user.name || order.user.email}</div>
                    <div className="max-w-64 truncate text-xs text-white/35">{order.user.email}</div>
                  </td>
                  <td className="py-3 pr-3">{order.plan.name}</td>
                  <td className="py-3 pr-3">{formatMoney(order.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
