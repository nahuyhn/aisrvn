import { setUserStatus, updateUserVip } from "@/app/vault-hbn/actions";
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

export default async function AdminVipPage() {
  const vipUsers = await prisma.user.findMany({
    where: {
      OR: [
        { customerType: "VIP" },
        { vipDiscount: { not: null } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      _count: {
        select: {
          orders: true,
          usageLogs: true,
        },
      },
      subscriptions: {
        take: 1,
        orderBy: { endAt: "desc" },
        include: { plan: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">VIP</h1>
        <p className="mt-2 text-white/60">
          Danh sách khách VIP, giảm giá riêng và ghi chú chăm sóc khách hàng.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm text-white/55">Tổng VIP</p>
        <h2 className="mt-2 text-2xl font-bold">{vipUsers.length}</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {vipUsers.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white/55">
            Chưa có user VIP. Vào trang Người dùng để chuyển khách sang VIP.
          </p>
        ) : null}

        {vipUsers.map((user) => {
          const latestSubscription = user.subscriptions[0];

          return (
            <article key={user.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-medium text-yellow-100">
                  {user.customerType}
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                  {user.status}
                </span>
                {user.vipDiscount !== null ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Giảm {user.vipDiscount}%
                  </span>
                ) : null}
              </div>

              <h2 className="mt-3 truncate text-xl font-semibold">{user.name || "Chưa có tên"}</h2>
              <p className="mt-1 truncate text-sm text-white/55">{user.email}</p>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase text-white/35">Orders</p>
                  <p className="mt-1 text-lg font-semibold">{user._count.orders}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase text-white/35">Usage</p>
                  <p className="mt-1 text-lg font-semibold">{user._count.usageLogs}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase text-white/35">Gói gần nhất</p>
                  <p className="mt-1 text-sm font-semibold">
                    {latestSubscription ? latestSubscription.plan.name : "Chưa có"}
                  </p>
                  {latestSubscription ? (
                    <p className="mt-1 text-xs text-white/40">Hết hạn {formatDate(latestSubscription.endAt)}</p>
                  ) : null}
                </div>
              </div>

              {user.vipNote ? (
                <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                  {user.vipNote}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
                <form action={updateUserVip} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      name="customerType"
                      defaultValue={user.customerType}
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="VIP">VIP</option>
                    </select>
                    <input
                      name="vipDiscount"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={user.vipDiscount ?? ""}
                      placeholder="Giảm %"
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    />
                    <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/85">
                      Lưu
                    </button>
                  </div>
                  <textarea
                    name="vipNote"
                    defaultValue={user.vipNote || ""}
                    placeholder="Ghi chú VIP..."
                    className="mt-3 h-20 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                  />
                </form>

                <form action={setUserStatus} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="status" value={user.status === "ACTIVE" ? "BANNED" : "ACTIVE"} />
                  <button className={`h-full w-full rounded-lg px-3 py-2 text-sm font-semibold ${user.status === "ACTIVE" ? "border border-red-400/40 text-red-100 hover:bg-red-400/10" : "bg-emerald-500 text-black hover:bg-emerald-400"}`}>
                    {user.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
