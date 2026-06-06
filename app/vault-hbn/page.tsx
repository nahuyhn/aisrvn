export default function AdminPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-white/60">
          Quản lý người dùng, gói, đơn hàng và lượt sử dụng.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">User</p>
            <h2 className="mt-3 text-3xl font-bold">0</h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Đơn hàng</p>
            <h2 className="mt-3 text-3xl font-bold">0</h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Gói active</p>
            <h2 className="mt-3 text-3xl font-bold">0</h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Lượt chat</p>
            <h2 className="mt-3 text-3xl font-bold">0</h2>
          </div>
        </div>
      </div>
    </main>
  );
}