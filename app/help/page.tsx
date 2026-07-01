import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trợ giúp | AI SITIKI",
  description: "Câu hỏi thường gặp khi dùng AI SITIKI.",
};

const faqs = [
  {
    question: "Thanh toán xong nhưng gói chưa active thì làm gì?",
    answer:
      "Vào trang Thanh toán, tìm đơn PENDING và bấm Kiểm tra lại. Nếu vẫn chưa được, gửi email hỗ trợ kèm mã đơn PayOS.",
  },
  {
    question: "Tài khoản miễn phí dùng được gì?",
    answer:
      "Tài khoản miễn phí dùng model free và có giới hạn lượt mỗi ngày. Gói trả phí mở thêm model theo cấu hình admin.",
  },
  {
    question: "Vì sao AI không đọc được ảnh hoặc file?",
    answer:
      "Model đang chọn phải hỗ trợ ảnh/file. File quá lớn, file scan ảnh hoặc file lỗi định dạng có thể không đọc được đầy đủ.",
  },
  {
    question: "Dữ liệu chat có chính xác tuyệt đối không?",
    answer:
      "Không. Nội dung AI tạo cần được kiểm tra lại, đặc biệt với nội dung pháp lý, y tế, tài chính hoặc quyết định quan trọng.",
  },
  {
    question: "Gói hết hạn thì sao?",
    answer:
      "Khi gói hết hạn, quyền dùng model trả phí sẽ dừng. Bạn vẫn có thể dùng model free hoặc mua thêm gói.",
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Trợ giúp</h1>
        <p className="mt-3 text-white/55">
          Một số lỗi thường gặp khi dùng AI SITIKI và cách xử lý nhanh.
        </p>

        <div className="mt-8 space-y-4">
          {faqs.map((faq) => (
            <section key={faq.question} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-lg font-semibold">{faq.question}</h2>
              <p className="mt-3 leading-7 text-white/65">{faq.answer}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/contact" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/10">
            Liên hệ hỗ trợ
          </Link>
          <Link href="/billing" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85">
            Kiểm tra gói
          </Link>
        </div>
      </div>
    </main>
  );
}
