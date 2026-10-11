import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketListPage } from "@/components/tickets/ticket-list-page";

export const metadata: Metadata = {
  title: "Pengaduan Keluar",
};

export default function Page() {
  return (
    <Suspense>
      <TicketListPage direction="outgoing" />
    </Suspense>
  );
}
