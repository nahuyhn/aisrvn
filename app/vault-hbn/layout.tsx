import Link from "next/link";
import { requireSuperAdmin } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();

  return (
    <main className="min-h-screen bg-[#111111] text-white">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-white/10 bg-black p-5">
        <h1 className="text-xl font-bold">Admin</h1>

        <p className="mt-2 truncate text-xs text-white/40">
          {admin.email}
        </p>

        <nav className="mt-8 space-y-2">
          <Link
            href="/vault-hbn"
            className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Dashboard
          </Link>

          <Link
            href="/vault-hbn/revenue"
            className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Doanh thu
          </Link>

          <Link
            href="/vault-hbn/orders"
            className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Đơn hàng
          </Link>

          <Link
            href="/vault-hbn/users"
            className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Người dùng
          </Link>

          <Link
            href="/vault-hbn/vip"
            className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            VIP
          </Link>

          <Link
            href="/vault-hbn/plans"
            className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Gói dịch vụ
          </Link>

          <Link
            href="/vault-hbn/usage"
            className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Usage
          </Link>

          <Link
            href="/chat"
            className="mt-6 block rounded-xl px-4 py-3 text-sm text-white/40 hover:bg-white/10 hover:text-white"
          >
            ← Quay lại Chat
          </Link>
        </nav>
      </aside>

      <section className="ml-64 min-h-screen p-8">
        {children}
      </section>
    </main>
  );
}