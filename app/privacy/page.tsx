import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | AI SITIKI",
  description: "Cách AI SITIKI xử lý dữ liệu tài khoản, thanh toán, chat và file.",
};

const sections = [
  {
    title: "1. Dữ liệu được thu thập",
    content:
      "AI SITIKI có thể lưu email, tên hiển thị, ảnh đại diện Google, lịch sử đơn hàng, trạng thái gói, lịch sử chat và dữ liệu kỹ thuật cần thiết để vận hành dịch vụ.",
  },
  {
    title: "2. Mục đích sử dụng",
    content:
      "Dữ liệu được dùng để đăng nhập, kích hoạt gói, kiểm tra lượt sử dụng, lưu lịch sử trò chuyện, hỗ trợ khách hàng và bảo vệ hệ thống khỏi lạm dụng.",
  },
  {
    title: "3. Nội dung chat và file",
    content:
      "Người dùng không nên gửi mật khẩu, mã OTP, số thẻ, giấy tờ nhạy cảm hoặc dữ liệu bí mật vào khung chat. File/tài liệu được xử lý để tạo phản hồi AI theo yêu cầu của người dùng.",
  },
  {
    title: "4. Thanh toán",
    content:
      "Thông tin thanh toán được xử lý qua PayOS. AI SITIKI lưu trạng thái đơn, mã giao dịch, số tiền và thời điểm thanh toán để kích hoạt gói và hỗ trợ đối soát.",
  },
  {
    title: "5. Chia sẻ dữ liệu",
    content:
      "AI SITIKI không bán dữ liệu cá nhân của người dùng. Một số dữ liệu cần thiết có thể được gửi đến nhà cung cấp đăng nhập, thanh toán, lưu trữ hoặc AI để vận hành dịch vụ.",
  },
  {
    title: "6. Lưu trữ và xóa dữ liệu",
    content:
      "Dữ liệu được lưu trong thời gian cần thiết cho vận hành, hỗ trợ và nghĩa vụ đối soát. Người dùng có thể liên hệ để yêu cầu hỗ trợ xóa hoặc kiểm tra dữ liệu tài khoản.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Chính sách bảo mật</h1>
        <p className="mt-2 text-sm text-white/50">Cập nhật ngày 30/06/2026</p>

        <div className="mt-8 space-y-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-3 leading-7 text-white/65">{section.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/terms" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/10">
            Điều khoản
          </Link>
          <Link href="/contact" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85">
            Liên hệ hỗ trợ
          </Link>
        </div>
      </div>
    </main>
  );
}
