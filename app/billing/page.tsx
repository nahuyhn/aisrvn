import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type BillingOrder = {
  id: string;
  amount: number;
  status: string;
  createdAt: Date | string;
  plan: {
    name: string;
  };
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function BillingPage() {
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

  const orders: BillingOrder[] = await prisma.order.findMany({
  include: {
    plan: {
      select: {
        name: true,
      },
    },
  },
  orderBy: {
    createdAt: "desc",
  },
});

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Thanh toán</h1>

        <p className="mt-2 text-white/60">
          Quản lý gói hiện tại và lịch sử đơn hàng.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Thông tin chuyển khoản</h2>

          <div className="mt-4 rounded-xl border border-white/10 bg-black p-4 text-sm text-white/70">
            <p>Ngân hàng: MB Bank / Vietcombank / tùy bạn sửa sau</p>
            <p>Số tài khoản: 0000000000</p>
            <p>Chủ tài khoản: TEN CUA BAN</p>
            <p>Nội dung: email đăng nhập + tên gói</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Lịch sử đơn hàng</h2>

          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-white/50">Chưa có đơn hàng.</p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/10 text-white/70">
                  <tr>
                    <th className="p-4">Gói</th>
                    <th className="p-4">Giá</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4">Ngày tạo</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order: BillingOrder) => (
                    <tr key={order.id} className="border-t border-white/10">
                      <td className="p-4">{order.plan.name}</td>
                      <td className="p-4">{formatPrice(order.amount)}</td>
                      <td className="p-4">
                        <span
                          className={
                            order.status === "PAID"
                              ? "rounded-full bg-green-500/20 px-3 py-1 text-green-300"
                              : order.status === "PENDING"
                                ? "rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300"
                                : "rounded-full bg-red-500/20 px-3 py-1 text-red-300"
                          }
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}