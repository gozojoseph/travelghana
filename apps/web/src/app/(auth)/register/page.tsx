import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <AuthForm mode="register" />
    </main>
  );
}
