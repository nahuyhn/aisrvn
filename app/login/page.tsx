"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-bold">Đăng nhập</h1>

        <p className="mt-3 text-sm text-white/60">
          Đăng nhập bằng Google để sử dụng hệ thống AI Wrapper.
        </p>

        <button
          onClick={() =>
            signIn("google", {
              callbackUrl: "/dashboard",
            })
          }
          className="mt-8 w-full rounded-full bg-white px-4 py-3 font-medium text-black"
        >
          Đăng nhập bằng Google
        </button>

        <p className="mt-6 text-center text-sm text-white/50">
          Chưa có tài khoản? Hệ thống sẽ tự tạo khi bạn đăng nhập Google.
        </p>
      </div>
    </main>
  );
}