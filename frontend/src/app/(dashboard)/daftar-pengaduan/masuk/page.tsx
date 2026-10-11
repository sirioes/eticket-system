import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketListPage } from "@/components/tickets/ticket-list-page";

export const metadata: Metadata = {
  title: "Pengaduan Masuk",
};

export default function Page() {
  return (
    <Suspense>
      <TicketListPage direction="incoming" />
    </Suspense>
  );
}
