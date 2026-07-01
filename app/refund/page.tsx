import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách hoàn tiền | AI SITIKI",
  description: "Quy định xử lý hoàn tiền và lỗi thanh toán của AI SITIKI.",
};

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Chính sách hoàn tiền</h1>
        <p className="mt-2 text-sm text-white/50">Cập nhật ngày 30/06/2026</p>

        <div className="mt-8 space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <section>
            <h2 className="text-lg font-semibold">1. Trường hợp được xem xét</h2>
            <p className="mt-3 leading-7 text-white/65">
              AI SITIKI xem xét hoàn tiền khi giao dịch đã bị trừ tiền nhưng gói không được kích hoạt, hệ thống gặp lỗi nghiêm trọng khiến người dùng không thể sử dụng, hoặc giao dịch bị ghi nhận sai.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Trường hợp thường không hoàn tiền</h2>
            <p className="mt-3 leading-7 text-white/65">
              Các gói đã sử dụng nhiều lượt, hết thời hạn, vi phạm điều khoản hoặc yêu cầu hoàn tiền do thay đổi nhu cầu cá nhân có thể không được hoàn tiền toàn bộ.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Cách gửi yêu cầu</h2>
            <p className="mt-3 leading-7 text-white/65">
              Người dùng cần cung cấp email tài khoản, mã đơn PayOS, thời điểm thanh toán và mô tả lỗi. Admin sẽ kiểm tra đơn hàng, trạng thái webhook và lịch sử kích hoạt gói.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Thời gian xử lý</h2>
            <p className="mt-3 leading-7 text-white/65">
              Thời gian xử lý phụ thuộc vào đối soát giao dịch và cổng thanh toán. Khi cần, admin có thể kích hoạt thủ công thay vì hoàn tiền nếu giao dịch hợp lệ.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/billing" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/10">
            Xem thanh toán
          </Link>
          <Link href="/contact" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85">
            Gửi yêu cầu hỗ trợ
          </Link>
        </div>
      </div>
    </main>
  );
}
