import { prisma } from "@/lib/prisma";
import { createOrder } from "@/app/actions/order-actions";

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

export default async function PricingPage() {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      durationDays: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm text-white/60">Pricing</p>
          <h1 className="mt-3 text-4xl font-bold">Bảng giá linh hoạt</h1>
          <p className="mt-4 text-white/60">
            Chọn gói theo ngày, không cần mua gói tháng đắt tiền.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-xl font-semibold">{plan.name}</h2>

              <p className="mt-4 text-3xl font-bold">
                {formatPrice(plan.price)}
              </p>

              <div className="mt-4 space-y-2 text-sm text-white/60">
                <p>Thời hạn: {plan.durationDays} ngày</p>
                <p>Lượt chat/ngày: {plan.messageLimitPerDay}</p>
              </div>

              <form
                action={async () => {
                  "use server";
                  await createOrder(plan.id);
                }}
              >
                <button
                  type="submit"
                  className="mt-6 w-full rounded-full bg-white px-4 py-3 font-medium text-black transition hover:bg-white/90"
                >
                  Chọn gói
                </button>
              </form>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href="/" className="text-sm text-white/60 hover:text-white">
            ← Quay lại trang chủ
          </a>
        </div>
      </div>
    </main>
  );
}