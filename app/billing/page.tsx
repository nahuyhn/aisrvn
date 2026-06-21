import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { createOrder } from "@/app/actions/order-actions";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams: Promise<{
    payment?: string;
    orderCode?: string;
  }>;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

function formatDate(date: Date | string | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function getStatusText(status: string) {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";

    case "PENDING":
      return "Chờ thanh toán";

    case "CANCELLED":
      return "Đã hủy";

    case "EXPIRED":
      return "Đã hết hạn";

    default:
      return status;
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-500/20 text-green-300";

    case "PENDING":
      return "bg-yellow-500/20 text-yellow-300";

    case "CANCELLED":
    case "EXPIRED":
      return "bg-red-500/20 text-red-300";

    default:
      return "bg-white/10 text-white/70";
  }
}

export default async function BillingPage({
  searchParams,
}: BillingPageProps) {
  const params = await searchParams;
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
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="text-2xl font-bold text-red-300">
            Tài khoản đã bị khóa
          </h1>

          <p className="mt-3 text-sm text-red-100/80">
            Bạn không thể truy cập trang thanh toán.
          </p>
        </div>
      </main>
    );
  }

  const activeSubscription = await getActiveSubscription(user.id);

  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      durationDays: "asc",
    },
  });

  const orders = await prisma.order.findMany({
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
    take: 20,
  });

  const parsedOrderCode = Number(params.orderCode);

  const returnedOrder = Number.isSafeInteger(parsedOrderCode)
    ? await prisma.order.findFirst({
        where: {
          userId: user.id,
          paymentCode: parsedOrderCode,
        },
        select: {
          status: true,
        },
      })
    : null;

  const paymentSucceeded =
    params.payment === "success" && returnedOrder?.status === "PAID";

  const paymentProcessing =
    params.payment === "success" && returnedOrder?.status === "PENDING";

  const paymentCancelled = params.payment === "cancel";

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Tiêu đề */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Thanh toán</h1>

            <p className="mt-2 text-sm text-white/55">
              Quản lý gói và thanh toán qua PayOS.
            </p>
          </div>

          <Link
            href="#plans"
            className="w-fit rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
          >
            Mua thêm gói
          </Link>
        </div>

        {/* Thông báo thanh toán thành công */}
        {paymentSucceeded && (
          <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
            <p className="font-semibold text-green-300">
              Thanh toán thành công
            </p>

            <p className="mt-1 text-sm text-green-100/70">
              Gói của bạn đã được kích hoạt tự động.
            </p>
          </div>
        )}

        {/* Webhook chưa xử lý xong */}
        {paymentProcessing && (
          <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5">
            <p className="font-semibold text-yellow-300">
              Đang xác nhận thanh toán
            </p>

            <p className="mt-1 text-sm text-yellow-100/70">
              Hệ thống đang kích hoạt gói. Hãy tải lại trang sau vài giây.
            </p>
          </div>
        )}

        {/* Người dùng hủy thanh toán */}
        {paymentCancelled && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="font-semibold text-red-300">
              Thanh toán chưa hoàn tất
            </p>

            <p className="mt-1 text-sm text-red-100/70">
              Bạn đã hủy hoặc rời khỏi trang thanh toán PayOS.
            </p>
          </div>
        )}

        {/* Gói hiện tại */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Gói hiện tại</h2>

          {activeSubscription ? (
            <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-white/45">Tên gói</p>

                <p className="mt-1 font-medium text-white">
                  {activeSubscription.plan.name}
                </p>
              </div>

              <div>
                <p className="text-white/45">Giới hạn mỗi ngày</p>

                <p className="mt-1 font-medium text-white">
                  {activeSubscription.plan.messageLimitPerDay} tin nhắn
                </p>
              </div>

              <div>
                <p className="text-white/45">Ngày bắt đầu</p>

                <p className="mt-1 text-white">
                  {formatDate(activeSubscription.startAt)}
                </p>
              </div>

              <div>
                <p className="text-white/45">Ngày hết hạn</p>

                <p className="mt-1 text-white">
                  {formatDate(activeSubscription.endAt)}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-white/50">
                Bạn chưa có gói nào đang hoạt động.
              </p>

              <Link
                href="#plans"
                className="mt-4 inline-block text-sm font-medium text-white underline underline-offset-4"
              >
                Chọn gói
              </Link>
            </div>
          )}
        </section>

        {/* Danh sách gói */}
        <section
          id="plans"
          className="mt-8 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.04] p-6"
        >
          <div>
            <h2 className="text-xl font-semibold">Chọn gói</h2>

            <p className="mt-2 text-sm text-white/50">
              Thanh toán và kích hoạt tự động qua PayOS.
            </p>
          </div>

          {plans.length === 0 ? (
            <p className="mt-5 text-sm text-white/50">
              Hiện chưa có gói nào đang mở bán.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.id}
                  className="flex flex-col rounded-2xl border border-white/10 bg-black p-5"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>

                    <p className="mt-3 text-3xl font-bold">
                      {formatPrice(plan.price)}
                    </p>

                    <div className="mt-4 space-y-2 text-sm text-white/55">
                      <p>{plan.durationDays} ngày sử dụng</p>

                      <p>{plan.messageLimitPerDay} tin nhắn mỗi ngày</p>
                    </div>
                  </div>

                  <form
                    action={async (formData: FormData) => {
                      "use server";

                      await createOrder(plan.id, formData);
                    }}
                    className="mt-6"
                  >
                    <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/55">
                      <input
                        type="checkbox"
                        name="termsAccepted"
                        required
                        className="mt-1 h-4 w-4 shrink-0 accent-white"
                      />

                      <span>
                        Tôi đồng ý{" "}
                        <Link
                          href="/terms"
                          target="_blank"
                          rel="noreferrer"
                          className="text-white underline underline-offset-4"
                        >
                          Điều khoản dịch vụ
                        </Link>
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
                    >
                      Thanh toán PayOS
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Lịch sử đơn hàng */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Lịch sử đơn hàng</h2>

          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-white/50">
              Bạn chưa có đơn hàng nào.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-white/10 text-white/70">
                  <tr>
                    <th className="p-4">Mã đơn</th>
                    <th className="p-4">Gói</th>
                    <th className="p-4">Số tiền</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4">Ngày tạo</th>
                    <th className="p-4">Ngày thanh toán</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-t border-white/10"
                    >
                      <td className="p-4 font-mono text-xs text-white/70">
                        {order.paymentCode ?? "—"}
                      </td>

                      <td className="p-4">{order.plan.name}</td>

                      <td className="p-4">
                        {formatPrice(order.amount)}
                      </td>

                      <td className="p-4">
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {getStatusText(order.status)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap p-4">
                        {formatDate(order.createdAt)}
                      </td>

                      <td className="whitespace-nowrap p-4">
                        {formatDate(order.paidAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}