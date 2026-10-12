import type { Metadata } from "next";
import { AllTicketsPage } from "@/components/tickets/all-tickets-page";

export const metadata: Metadata = {
  title: "Semua Pengaduan",
};

export default function Page() {
  return <AllTicketsPage />;
}
