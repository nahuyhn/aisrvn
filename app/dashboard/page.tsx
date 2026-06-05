import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        <p className="mt-2 text-white/60">
          Xin chào, {session.user.name || session.user.email}
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Gói hiện tại</p>
            <h2 className="mt-3 text-2xl font-bold">Chưa có gói</h2>
            <p className="mt-2 text-sm text-white/50">
              Vui lòng mua gói để sử dụng chat AI.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Tài khoản</p>
            <h2 className="mt-3 text-lg font-bold">{session.user.email}</h2>
            <p className="mt-2 text-sm text-white/50">
              Role: {session.user.role || "USER"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/60">Thao tác nhanh</p>

            <div className="mt-4 space-y-3">
              <a
                href="/chat"
                className="block rounded-full bg-white px-4 py-3 text-center font-medium text-black"
              >
                Vào Chat
              </a>

              <a
                href="/pricing"
                className="block rounded-full border border-white/10 px-4 py-3 text-center font-medium text-white"
              >
                Mua gói
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}