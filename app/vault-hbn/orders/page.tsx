import { setOrderStatus } from "@/app/vault-hbn/actions";
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

function statusClass(status: string) {
  if (status === "PAID") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "PENDING") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

export default async function AdminOrdersPage() {
  const [orders, paidTotal, pendingCount, paidCount, cancelledCount] = await Promise.all([
    prisma.order.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            durationDays: true,
            messageLimitPerDay: true,
          },
        },
      },
    }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.order.count({ where: { status: "CANCELLED" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Đơn hàng</h1>
        <p className="mt-2 text-white/60">
          Theo dõi PayOS, xử lý đơn pending và kích hoạt gói thủ công khi webhook lỗi.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Tổng doanh thu paid</p>
          <h2 className="mt-2 text-2xl font-bold">{formatMoney(paidTotal._sum.amount)}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Pending</p>
          <h2 className="mt-2 text-2xl font-bold text-yellow-200">{pendingCount}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Paid</p>
          <h2 className="mt-2 text-2xl font-bold text-emerald-200">{paidCount}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/55">Cancelled</p>
          <h2 className="mt-2 text-2xl font-bold text-red-200">{cancelledCount}</h2>
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(order.status)}`}>
                    {order.status}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                    {order.paymentProvider || order.paymentMethod || "Chưa rõ cổng"}
                  </span>
                  {order.paymentCode ? (
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/55">
                      Mã: {order.paymentCode}
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-3 text-xl font-semibold">{order.plan.name}</h2>
                <p className="mt-1 text-sm text-white/55">
                  {formatMoney(order.amount)} · {order.plan.durationDays} ngày · {order.plan.messageLimitPerDay} lượt/ngày
                </p>

                <div className="mt-4 grid gap-3 text-sm text-white/65 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-white/35">Người mua</p>
                    <p className="mt-1 truncate">{order.user.name || order.user.email}</p>
                    <p className="truncate text-xs text-white/40">{order.user.email}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-white/35">Tạo đơn</p>
                    <p className="mt-1">{formatDate(order.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-white/35">Thanh toán</p>
                    <p className="mt-1">{formatDate(order.paidAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-white/35">Payment link</p>
                    {order.checkoutUrl ? (
                      <a href={order.checkoutUrl} target="_blank" className="mt-1 block truncate text-emerald-300 hover:text-emerald-200">
                        Mở link PayOS
                      </a>
                    ) : (
                      <p className="mt-1">-</p>
                    )}
                  </div>
                </div>

                {order.note ? (
                  <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/55">
                    Ghi chú: {order.note}
                  </p>
                ) : null}
              </div>

              <div className="w-full shrink-0 space-y-3 xl:w-72">
                {order.status !== "PAID" ? (
                  <form action={setOrderStatus} className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value="PAID" />
                    <textarea
                      name="adminNote"
                      placeholder="Ghi chú kích hoạt thủ công..."
                      className="h-20 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    />
                    <button className="mt-2 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
                      Đánh dấu PAID + active gói
                    </button>
                  </form>
                ) : null}

                {order.status !== "CANCELLED" && order.status !== "PAID" ? (
                  <form action={setOrderStatus} className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <input
                      name="adminNote"
                      placeholder="Lý do hủy đơn..."
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    />
                    <button className="mt-2 w-full rounded-lg border border-red-400/40 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-400/10">
                      Hủy đơn
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
