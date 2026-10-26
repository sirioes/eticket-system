import Link from "next/link";
import { StatusBadge } from "@/components/tickets/status-badge";
import { OUTLINE_BUTTON_CLASS } from "@/components/ui/button-class";
import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import { ticketDetailHref } from "@/lib/tickets";
import type { TicketListItem } from "@/types/ticket.types";

export type TicketDirection = "outgoing" | "incoming";

interface TicketTableProps {
  items: TicketListItem[];
  firstNumber: number;
  direction: TicketDirection;
}

const DETAIL_CLASS = `${OUTLINE_BUTTON_CLASS} h-9 px-4 font-mono text-xs tracking-[0.15em]`;

function counterpart(item: TicketListItem, direction: TicketDirection): string {
  return DIVISI_LABEL[direction === "outgoing" ? item.toDivisi : item.fromDivisi];
}

export function Attachments({ count }: { count: number }) {
  if (count === 0) return <span className="text-ink/70">Tidak ada</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4 text-teal"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7L10.2 17.2a1.7 1.7 0 0 1-2.4-2.4L15.5 7" />
      </svg>
      {count} file
    </span>
  );
}

export function DetailLink({ id }: { id: string }) {
  return (
    <Link href={ticketDetailHref(id)} aria-label={`Detail pengaduan ${id}`} className={DETAIL_CLASS}>
      DETAIL
    </Link>
  );
}

export function TicketTable({ items, firstNumber, direction }: TicketTableProps) {
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
        {items.map((item, index) => (
          <li
            key={item.id}
            style={{ animationDelay: `${index * 40}ms` }}
            className="flex animate-fade-up flex-col rounded-2xl border border-ink/10 bg-mist p-4"
          >
            <div className="flex flex-col items-start gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink/70">#{firstNumber + index}</p>
                <p className="mt-0.5 font-mono font-semibold break-all">{item.id}</p>
              </div>
              <StatusBadge stage={item.stage} fromDivisi={item.fromDivisi} toDivisi={item.toDivisi} wrap />
            </div>
            <p className="mt-3 line-clamp-3 text-sm wrap-break-word">{item.descriptionPreview}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Divisi</dt>
                <dd>{counterpart(item, direction)}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Dokumen Pengaduan</dt>
                <dd>
                  <Attachments count={item.attachmentCount} />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Tanggal</dt>
                <dd>{formatDateWita(item.createdAt)}</dd>
              </div>
            </dl>
            <div className="mt-auto pt-4 [&>a]:w-full">
              <DetailLink id={item.id} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
              <th scope="col" className="py-3 pr-4 font-medium">No</th>
              <th scope="col" className="py-3 pr-4 font-medium">ID Pengaduan</th>
              <th scope="col" className="py-3 pr-4 font-medium">Deskripsi</th>
              <th scope="col" className="py-3 pr-4 font-medium">Dokumen Pengaduan</th>
              <th scope="col" className="py-3 pr-4 font-medium">Status</th>
              <th scope="col" className="py-3 pr-4 font-medium">Tanggal</th>
              <th scope="col" className="py-3 pr-4 font-medium">Divisi</th>
              <th scope="col" className="py-3 font-medium">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id}
                style={{ animationDelay: `${index * 40}ms` }}
                className="animate-fade-up border-b border-ink/10 transition-colors duration-200 last:border-b-0 hover:bg-teal/5"
              >
                <td className="py-4 pr-4 font-mono text-xs text-ink/70">{firstNumber + index}</td>
                <td className="py-4 pr-4 font-mono font-semibold whitespace-nowrap">{item.id}</td>
                <td className="min-w-40 py-4 pr-4">
                  <p className="line-clamp-2 wrap-break-word">{item.descriptionPreview}</p>
                </td>
                <td className="py-4 pr-4 whitespace-nowrap">
                  <Attachments count={item.attachmentCount} />
                </td>
                <td className="w-44 py-4 pr-4">
                  <StatusBadge stage={item.stage} fromDivisi={item.fromDivisi} toDivisi={item.toDivisi} wrap />
                </td>
                <td className="w-32 py-4 pr-4">{formatDateWita(item.createdAt)}</td>
                <td className="w-32 py-4 pr-4">{counterpart(item, direction)}</td>
                <td className="py-4 pr-6 text-right">
                  <DetailLink id={item.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
