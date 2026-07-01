import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatPrice(price: number) {
  return `${price.toLocaleString("vi-VN")}đ`;
}

export default async function HomePage() {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ price: "asc" }, { durationDays: "asc" }],
    take: 3,
  });

  const features = [
    "Chat AI tiếng Việt dễ dùng trên điện thoại và máy tính.",
    "Gói miễn phí để thử, gói trả phí mở thêm model mạnh hơn.",
    "Hỗ trợ ảnh/file theo model, lưu lịch sử trò chuyện theo tài khoản.",
    "Thanh toán PayOS, kích hoạt gói tự động sau khi hệ thống xác nhận.",
  ];

  const steps = [
    "Đăng nhập bằng Google.",
    "Dùng thử AI miễn phí hoặc chọn gói phù hợp.",
    "Thanh toán PayOS và quay lại trang Chat để sử dụng.",
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <p className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/55">
            AI SITIKI · AI siêu tiết kiệm
          </p>

          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Trợ lý AI gọn nhẹ cho học tập, công việc và xử lý tài liệu.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
            Một web AI wrapper đơn giản: chat nhanh, có lịch sử, có gói miễn phí/trả phí, quản lý thanh toán và phân quyền model theo tài khoản.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-black transition hover:bg-white/85"
            >
              Bắt đầu chat
            </Link>
            <Link
              href="/pricing"
              className="rounded-2xl border border-white/15 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Xem bảng giá
            </Link>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-white/60 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.45)]">
          <div className="rounded-[1.5rem] border border-white/10 bg-black p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-semibold">AI SITIKI Chat</p>
                <p className="mt-1 text-xs text-white/40">Giao diện tối giản, dùng được trên mobile</p>
              </div>
              <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-300">
                Online
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="max-w-[86%] rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/75">
                Hãy tóm tắt file này và gợi ý 5 ý chính để tôi đưa vào báo cáo.
              </div>
              <div className="ml-auto max-w-[86%] rounded-2xl bg-white p-4 text-sm leading-6 text-black">
                Mình sẽ đọc nội dung, rút ý chính, sau đó trình bày theo bố cục báo cáo sinh viên dễ hiểu.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-white/40">Lịch sử</p>
                  <p className="mt-1 text-sm font-semibold">Lưu theo tài khoản</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-white/40">Gói Pro</p>
                  <p className="mt-1 text-sm font-semibold">Mở model nâng cấp</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-black p-5">
              <p className="text-sm text-white/35">Bước {index + 1}</p>
              <h2 className="mt-3 text-lg font-bold">{step}</h2>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Gói đang mở bán</h2>
            <p className="mt-2 text-white/55">Chọn gói theo nhu cầu, có thể mua thêm khi sắp hết hạn.</p>
          </div>
          <Link href="/billing" className="text-sm font-semibold text-white underline underline-offset-4">
            Vào trang thanh toán
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/55 md:col-span-3">
              Hiện chưa có gói nào đang mở bán. Admin có thể tạo gói trong trang quản trị.
            </div>
          ) : (
            plans.map((plan) => (
              <article key={plan.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="mt-4 text-3xl font-black">{formatPrice(plan.price)}</p>
                <div className="mt-4 space-y-2 text-sm text-white/55">
                  <p>{plan.durationDays} ngày sử dụng</p>
                  <p>{plan.messageLimitPerDay} tin nhắn mỗi ngày</p>
                </div>
                <Link
                  href="/billing#plans"
                  className="mt-6 inline-flex w-full justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/85"
                >
                  Chọn gói
                </Link>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
