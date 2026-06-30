import { prisma } from "@/lib/prisma";

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

function getDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export default async function AdminUsagePage() {
  const todayStart = getTodayStart();
  const last7Days = getDaysAgo(7);

  const [usageToday, usage7Days, totalUsage, recentLogs, byModel, byUserToday] = await Promise.all([
    prisma.usageLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.usageLog.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.usageLog.count(),
    prisma.usageLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            status: true,
            customerType: true,
          },
        },
      },
    }),
    prisma.usageLog.groupBy({
      by: ["provider", "model"],
      _count: { _all: true },
      _sum: {
        inputTextLength: true,
        outputTextLength: true,
      },
    }),
    prisma.usageLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: todayStart } },
      _count: { _all: true },
      _sum: {
        inputTextLength: true,
        outputTextLength: true,
      },
    }),
  ]);

  const topUsers = byUserToday
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 10);

  const topUserRecords = await prisma.user.findMany({
    where: {
      id: {
        in: topUsers.map((item) => item.userId),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      customerType: true,
      status: true,
    },
  });

  const topUserMap = new Map(topUserRecords.map((user) => [user.id, user]));
  const topModels = byModel.sort((a, b) => b._count._all - a._count._all).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usage</h1>
        <p className="mt-2 text-white/60">
          Theo dõi lượt chat, model được dùng nhiều và user dùng nhiều trong ngày.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Hôm nay</p>
          <h2 className="mt-2 text-2xl font-bold">{usageToday.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">7 ngày gần nhất</p>
          <h2 className="mt-2 text-2xl font-bold">{usage7Days.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Tổng usage log</p>
          <h2 className="mt-2 text-2xl font-bold">{totalUsage.toLocaleString("vi-VN")}</h2>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold">Top user hôm nay</h2>
          <div className="mt-4 space-y-2">
            {topUsers.length === 0 ? <p className="text-sm text-white/45">Chưa có lượt dùng hôm nay.</p> : null}
            {topUsers.map((item) => {
              const user = topUserMap.get(item.userId);

              return (
                <div key={item.userId} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{user?.name || user?.email || item.userId}</p>
                      <p className="truncate text-xs text-white/40">{user?.email || "Không tìm thấy user"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{item._count._all}</p>
                      <p className="text-xs text-white/35">lượt</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    Input {item._sum.inputTextLength || 0} ký tự · Output {item._sum.outputTextLength || 0} ký tự
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold">Top model</h2>
          <div className="mt-4 space-y-2">
            {topModels.map((item) => (
              <div key={`${item.provider}-${item.model}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.model}</p>
                    <p className="truncate text-xs text-white/40">{item.provider}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{item._count._all}</p>
                    <p className="text-xs text-white/35">lượt</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-white/40">
                  Input {item._sum.inputTextLength || 0} ký tự · Output {item._sum.outputTextLength || 0} ký tự
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold">Log gần đây</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-white/35">
              <tr>
                <th className="py-2 pr-3">Thời gian</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Input</th>
                <th className="py-2 pr-3">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentLogs.map((log) => (
                <tr key={log.id} className="text-white/70">
                  <td className="py-3 pr-3">{formatDate(log.createdAt)}</td>
                  <td className="py-3 pr-3">
                    <div className="max-w-64 truncate">{log.user.name || log.user.email}</div>
                    <div className="max-w-64 truncate text-xs text-white/35">{log.user.email}</div>
                  </td>
                  <td className="py-3 pr-3">{log.provider}/{log.model}</td>
                  <td className="py-3 pr-3">{log.inputTextLength}</td>
                  <td className="py-3 pr-3">{log.outputTextLength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
