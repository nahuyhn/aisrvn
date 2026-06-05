export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 rounded-full border border-white/20 px-4 py-2 text-sm text-white/70">
          AI Wrapper SaaS
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Dùng AI linh hoạt theo ngày
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-white/70">
          Đăng nhập bằng Google, chọn gói phù hợp và sử dụng AI ngay trên nền
          tảng web riêng của bạn.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <a
            href="/login"
            className="rounded-full bg-white px-6 py-3 font-medium text-black"
          >
            Bắt đầu dùng thử
          </a>

          <a
            href="/pricing"
            className="rounded-full border border-white/20 px-6 py-3 font-medium text-white"
          >
            Xem bảng giá
          </a>
        </div>

        <div className="mt-14 grid w-full gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <h3 className="font-semibold">Đăng nhập Google</h3>
            <p className="mt-2 text-sm text-white/60">
              Người dùng đăng nhập nhanh, không cần tạo tài khoản thủ công.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <h3 className="font-semibold">Gói linh hoạt</h3>
            <p className="mt-2 text-sm text-white/60">
              Hỗ trợ gói 1 ngày, 3 ngày, 7 ngày hoặc 30 ngày.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <h3 className="font-semibold">Chat AI</h3>
            <p className="mt-2 text-sm text-white/60">
              Giai đoạn đầu dùng Gemini API, sau này thay bằng OpenAI.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}