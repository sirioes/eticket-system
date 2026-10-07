import type { Metadata } from "next";
import { CreateTicketForm } from "@/components/tickets/create-ticket-form";

export const metadata: Metadata = {
  title: "Buat Pengaduan",
};

export default function CreateTicketPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Buat Pengaduan
      </h1>
      <p className="mt-1 text-sm text-ink/60 sm:text-base">
        Isi formulir di bawah ini untuk mengajukan pengaduan ke divisi lain.
      </p>
      <CreateTicketForm />
    </div>
  );
}
