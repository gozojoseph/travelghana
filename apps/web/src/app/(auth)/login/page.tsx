import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <AuthForm mode="login" />
    </main>
  );
}
