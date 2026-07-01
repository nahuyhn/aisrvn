import Link from "next/link";

export default function MaintenancePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-8">
        <p className="text-sm text-zinc-400">AI SITIKI Admin</p>

        <h1 className="mt-2 text-3xl font-semibold text-white">
          Bảo trì hệ thống
        </h1>

        <p className="mt-2 text-sm text-zinc-400">
          Trang này dùng để kiểm tra và chạy các tác vụ bảo trì như dọn gói hết
          hạn, quyền model hết hạn và đơn hàng pending quá lâu.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold text-white">Maintenance API</h2>

        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Nếu bạn đã cấu hình <code className="text-zinc-200">CRON_SECRET</code>
          , có thể chạy bảo trì bằng API:
        </p>

        <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-4 text-sm text-zinc-200">
          {`/api/cron/maintenance?secret=<CRON_SECRET>`}
        </pre>

        <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          Không public secret này cho người khác. Chỉ admin hoặc cron job của
          Vercel nên dùng endpoint này.
        </div>

        <div className="mt-6">
          <Link
            href="/vault-hbn"
            className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Quay lại dashboard admin
          </Link>
        </div>
      </div>
    </main>
  );
}
