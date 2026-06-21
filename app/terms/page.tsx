import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Điều khoản dịch vụ | AI SITIKI",
  description: "Điều khoản sử dụng dịch vụ AI SITIKI",
};

const updatedAt = "21/06/2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Điều khoản dịch vụ
          </h1>

          <p className="mt-2 text-sm text-white/50">
            Cập nhật ngày {updatedAt}
          </p>
        </div>

        <div className="space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <section>
            <h2 className="text-lg font-semibold">1. Dịch vụ</h2>

            <p className="mt-3 leading-7 text-white/65">
              AI SITIKI cung cấp công cụ trò chuyện AI theo gói miễn phí và
              trả phí. Tính năng, model, số lượt sử dụng và thời hạn phụ
              thuộc vào từng gói.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Nội dung do AI tạo</h2>

            <p className="mt-3 leading-7 text-white/65">
              Nội dung do AI tạo có thể chưa chính xác hoặc chưa đầy đủ.
              Người dùng cần tự kiểm tra trước khi sử dụng cho các quyết
              định quan trọng, đặc biệt trong lĩnh vực pháp lý, y tế và tài
              chính.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Thanh toán</h2>

            <p className="mt-3 leading-7 text-white/65">
              Gói trả phí được kích hoạt tự động sau khi hệ thống xác nhận
              thanh toán thành công qua PayOS. Thời hạn và giới hạn sử dụng
              được hiển thị trên trang Thanh toán.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Hoàn tiền</h2>

            <p className="mt-3 leading-7 text-white/65">
              Yêu cầu hoàn tiền được xem xét khi giao dịch bị trừ tiền nhưng
              gói không được kích hoạt, hệ thống gặp lỗi nghiêm trọng hoặc
              theo yêu cầu bắt buộc của pháp luật. Các lượt đã sử dụng có
              thể được tính khi xử lý hoàn tiền.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Sử dụng hợp pháp</h2>

            <p className="mt-3 leading-7 text-white/65">
              Không sử dụng AI SITIKI để lừa đảo, phát tán mã độc, xâm phạm
              quyền riêng tư, vi phạm bản quyền, tạo nội dung trái pháp luật
              hoặc gây hại cho người khác.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Tài khoản</h2>

            <p className="mt-3 leading-7 text-white/65">
              Người dùng chịu trách nhiệm bảo vệ tài khoản của mình. AI
              SITIKI có thể giới hạn hoặc khóa tài khoản khi phát hiện hành
              vi lạm dụng, gian lận thanh toán hoặc vi phạm điều khoản.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Dữ liệu</h2>

            <p className="mt-3 leading-7 text-white/65">
              Thông tin tài khoản, lịch sử thanh toán và dữ liệu cần thiết
              được xử lý để vận hành dịch vụ. Người dùng không nên gửi mật
              khẩu, số thẻ, mã OTP hoặc dữ liệu bí mật vào khung chat.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Thay đổi dịch vụ</h2>

            <p className="mt-3 leading-7 text-white/65">
              AI SITIKI có thể cập nhật model, giới hạn sử dụng, giá gói
              hoặc điều khoản. Thay đổi quan trọng sẽ được thông báo trên
              website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Chấp thuận</h2>

            <p className="mt-3 leading-7 text-white/65">
              Khi đăng ký, sử dụng hoặc thanh toán, bạn xác nhận đã đọc và
              đồng ý với Điều khoản dịch vụ này.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">10. Hỗ trợ</h2>

            <p className="mt-3 leading-7 text-white/65">
              Khi cần hỗ trợ giao dịch hoặc tài khoản, vui lòng liên hệ qua
              thông tin hỗ trợ được công bố trên AI SITIKI.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/chat"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/10"
          >
            Quay lại Chat
          </Link>

          <Link
            href="/billing"
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
          >
            Xem gói dịch vụ
          </Link>
        </div>

        <p className="mt-8 text-xs leading-5 text-white/35">
          Nội dung này là điều khoản vận hành cơ bản, không thay thế tư vấn
          pháp lý chuyên nghiệp.
        </p>
      </div>
    </main>
  );
}