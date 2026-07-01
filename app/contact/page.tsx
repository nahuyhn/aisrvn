import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Liên hệ hỗ trợ | AI SITIKI",
  description: "Thông tin hỗ trợ tài khoản, gói dịch vụ và thanh toán AI SITIKI.",
};

const supportEmail = process.env.SUPPORT_EMAIL || "support@aisitiki.vn";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Liên hệ hỗ trợ</h1>
        <p className="mt-3 text-white/55">
          Dùng trang này cho các vấn đề về đăng nhập, đơn PayOS, kích hoạt gói, lỗi chat hoặc yêu cầu kiểm tra tài khoản.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-white/45">Email hỗ trợ</p>
            <a className="mt-2 block break-all text-lg font-semibold underline underline-offset-4" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-white/45">Khi gửi yêu cầu</p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Gửi email tài khoản, mã đơn PayOS, ảnh lỗi nếu có và mô tả ngắn vấn đề.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">Mẫu nội dung hỗ trợ</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-black p-4 text-sm leading-6 text-white/70">
{`Email tài khoản:
Mã đơn PayOS:
Gói đã mua:
Thời điểm thanh toán:
Lỗi gặp phải:
Ảnh chụp màn hình nếu có:`}
          </pre>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/help" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/10">
            Xem trợ giúp
          </Link>
          <Link href="/chat" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85">
            Về Chat
          </Link>
        </div>
      </div>
    </main>
  );
}
