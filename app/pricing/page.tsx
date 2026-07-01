import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatPrice(price: number) {
  return `${price.toLocaleString("vi-VN")}đ`;
}

export default async function PricingPage() {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ price: "asc" }, { durationDays: "asc" }],
  });

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">Bảng giá AI SITIKI</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            Gói miễn phí dùng để thử. Gói trả phí mở quyền dùng model nâng cấp và tăng giới hạn tin nhắn mỗi ngày.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {plans.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/55 md:col-span-3">
              Hiện chưa có gói nào đang mở bán.
            </div>
          ) : (
            plans.map((plan) => (
              <article key={plan.id} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <p className="mt-4 text-3xl font-black">{formatPrice(plan.price)}</p>
                  <ul className="mt-5 space-y-3 text-sm text-white/60">
                    <li>{plan.durationDays} ngày sử dụng</li>
                    <li>{plan.messageLimitPerDay} tin nhắn mỗi ngày</li>
                    <li>Thanh toán qua PayOS</li>
                    <li>Kích hoạt tự động khi đơn thành công</li>
                  </ul>
                </div>
                <Link
                  href="/billing#plans"
                  className="mt-6 inline-flex justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/85"
                >
                  Mua gói này
                </Link>
              </article>
            ))
          )}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-white/60">
          <p>
            Lưu ý: Nội dung do AI tạo có thể chưa chính xác tuyệt đối. Hãy kiểm tra lại trước khi dùng cho quyết định quan trọng.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/terms" className="underline underline-offset-4">Điều khoản</Link>
            <Link href="/privacy" className="underline underline-offset-4">Bảo mật</Link>
            <Link href="/refund" className="underline underline-offset-4">Hoàn tiền</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
