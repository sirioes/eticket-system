import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = {
  title: "Ganti Password",
};

export default function ChangePasswordPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Ganti Password
      </h1>
      <p className="mt-1 text-sm text-ink/60 sm:text-base">
        Perbarui password akunmu agar akun tetap aman.
      </p>
      <ChangePasswordForm />
    </div>
  );
}