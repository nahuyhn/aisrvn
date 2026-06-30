import { cancelSubscription, setUserStatus, updateUserVip } from "@/app/vault-hbn/actions";
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

function statusClass(status: string) {
  if (status === "ACTIVE") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          orders: true,
          chatSessions: true,
          usageLogs: true,
        },
      },
      subscriptions: {
        take: 3,
        orderBy: { endAt: "desc" },
        include: {
          plan: {
            select: {
              name: true,
              messageLimitPerDay: true,
            },
          },
        },
      },
      modelAccesses: {
        take: 5,
        orderBy: { expiresAt: "desc" },
        include: {
          model: {
            select: {
              displayName: true,
              provider: true,
              model: true,
            },
          },
        },
      },
    },
  });

  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const bannedUsers = users.filter((user) => user.status === "BANNED").length;
  const vipUsers = users.filter((user) => user.customerType === "VIP").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Người dùng</h1>
        <p className="mt-2 text-white/60">
          Quản lý tài khoản, khóa/mở user, đánh dấu VIP và xem gói đang dùng.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">User đang hiển thị</p>
          <h2 className="mt-2 text-2xl font-bold">{users.length}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Active / Banned</p>
          <h2 className="mt-2 text-2xl font-bold">{activeUsers} / {bannedUsers}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">VIP</p>
          <h2 className="mt-2 text-2xl font-bold">{vipUsers}</h2>
        </div>
      </div>

      <div className="space-y-4">
        {users.map((user) => {
          const activeSubscription = user.subscriptions.find(
            (subscription) => subscription.status === "ACTIVE" && subscription.endAt > new Date(),
          );

          return (
            <article key={user.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(user.status)}`}>
                      {user.status}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                      {user.customerType}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                      Tạo: {formatDate(user.createdAt)}
                    </span>
                  </div>

                  <h2 className="mt-3 truncate text-xl font-semibold">{user.name || "Chưa có tên"}</h2>
                  <p className="mt-1 truncate text-sm text-white/55">{user.email}</p>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase text-white/35">Orders</p>
                      <p className="mt-1 text-lg font-semibold">{user._count.orders}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase text-white/35">Chat sessions</p>
                      <p className="mt-1 text-lg font-semibold">{user._count.chatSessions}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase text-white/35">Usage logs</p>
                      <p className="mt-1 text-lg font-semibold">{user._count.usageLogs}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase text-white/35">Gói hiện tại</p>
                      <p className="mt-1 text-sm font-semibold">
                        {activeSubscription ? activeSubscription.plan.name : "Chưa active"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-sm font-medium">Subscription gần nhất</p>
                      <div className="mt-3 space-y-2 text-sm text-white/60">
                        {user.subscriptions.length === 0 ? <p>Chưa có gói.</p> : null}
                        {user.subscriptions.map((subscription) => (
                          <div key={subscription.id} className="rounded-lg bg-white/[0.04] p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span>{subscription.plan.name}</span>
                              <span>{subscription.status}</span>
                            </div>
                            <div className="mt-1 text-xs text-white/40">
                              {formatDate(subscription.startAt)} → {formatDate(subscription.endAt)}
                            </div>
                            {subscription.status === "ACTIVE" ? (
                              <form action={cancelSubscription} className="mt-2">
                                <input type="hidden" name="subscriptionId" value={subscription.id} />
                                <button className="rounded-lg border border-red-400/30 px-2 py-1 text-xs text-red-100 hover:bg-red-400/10">
                                  Hủy gói này
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-sm font-medium">Model access</p>
                      <div className="mt-3 space-y-2 text-sm text-white/60">
                        {user.modelAccesses.length === 0 ? <p>Chưa mở model trả phí.</p> : null}
                        {user.modelAccesses.map((access) => (
                          <div key={access.id} className="rounded-lg bg-white/[0.04] p-2">
                            <div>{access.model.displayName}</div>
                            <div className="mt-1 text-xs text-white/40">
                              {access.model.provider}/{access.model.model} · hết hạn {formatDate(access.expiresAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <form action={setUserStatus} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="status" value={user.status === "ACTIVE" ? "BANNED" : "ACTIVE"} />
                    <button className={`w-full rounded-lg px-3 py-2 text-sm font-semibold ${user.status === "ACTIVE" ? "border border-red-400/40 text-red-100 hover:bg-red-400/10" : "bg-emerald-500 text-black hover:bg-emerald-400"}`}>
                      {user.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                    </button>
                  </form>

                  <form action={updateUserVip} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <input type="hidden" name="userId" value={user.id} />
                    <label className="text-xs uppercase text-white/35">Loại khách</label>
                    <select
                      name="customerType"
                      defaultValue={user.customerType}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="VIP">VIP</option>
                    </select>

                    <label className="mt-3 block text-xs uppercase text-white/35">Giảm giá VIP (%)</label>
                    <input
                      name="vipDiscount"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={user.vipDiscount ?? ""}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                    />

                    <label className="mt-3 block text-xs uppercase text-white/35">Ghi chú VIP</label>
                    <textarea
                      name="vipNote"
                      defaultValue={user.vipNote || ""}
                      className="mt-1 h-20 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                    />

                    <button className="mt-3 w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/85">
                      Lưu VIP
                    </button>
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
