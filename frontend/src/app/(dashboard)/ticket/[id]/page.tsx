import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketDetailPage } from "@/components/tickets/ticket-detail-page";
import { isValidTicketId } from "@/lib/tickets";

export const metadata: Metadata = {
  title: "Detail Pengaduan",
};

export default async function Page({ params }: PageProps<"/ticket/[id]">) {
  const { id } = await params;
  if (!isValidTicketId(id)) notFound();
  return <TicketDetailPage key={id} id={id} />;
}
