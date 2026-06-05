import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Navbar() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 text-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="text-xl font-bold tracking-tight">
          AI Wrapper
        </a>

        <nav className="hidden items-center space-x-8 text-sm text-white/70 md:flex">
          <a href="/" className="transition hover:text-white">
            Trang chủ
          </a>
          <a href="/pricing" className="transition hover:text-white">
            Bảng giá
          </a>
          <a href="/dashboard" className="transition hover:text-white">
            Dashboard
          </a>
          <a href="/chat" className="transition hover:text-white">
            Chat
          </a>
          <a href="/billing" className="transition hover:text-white">
            Thanh toán
          </a>
          <a href="/admin" className="transition hover:text-white">
            Admin
          </a>
        </nav>

        {session?.user ? (
          <a
            href="/api/auth/signout"
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Đăng xuất
          </a>
        ) : (
          <a
            href="/login"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
          >
            Đăng nhập
          </a>
        )}
      </div>
    </header>
  );
}