import { DetailLink } from "@/components/tickets/ticket-table";
import { StatusBadge } from "@/components/tickets/status-badge";
import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import type { TicketListItem } from "@/types/ticket.types";

interface AllTicketsTableProps {
  items: TicketListItem[];
  firstNumber: number;
}

export function AllTicketsTable({ items, firstNumber }: AllTicketsTableProps) {
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
                <p className="font-mono text-xs text-ink/70">
                  #{firstNumber + index}
                </p>
                <p className="mt-0.5 font-mono font-semibold break-all">
                  {item.id}
                </p>
              </div>
              <StatusBadge
                stage={item.stage}
                fromDivisi={item.fromDivisi}
                toDivisi={item.toDivisi}
                wrap
              />
            </div>
            <p className="mt-3 line-clamp-3 text-sm wrap-break-word">
              {item.descriptionPreview}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
                  Dari divisi
                </dt>
                <dd>{DIVISI_LABEL[item.fromDivisi]}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
                  Ke divisi
                </dt>
                <dd>{DIVISI_LABEL[item.toDivisi]}</dd>
              </div>
              <div className="col-span-2">
                <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
                  Tanggal
                </dt>
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
              <th scope="col" className="py-3 pr-4 font-medium">
                No
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                ID Pengaduan
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Deskripsi
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Dari divisi
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Ke divisi
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Status
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Tanggal
              </th>
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
                <td className="py-4 pr-4 font-mono text-xs text-ink/70">
                  {firstNumber + index}
                </td>
                <td className="py-4 pr-4 font-mono font-semibold whitespace-nowrap">
                  {item.id}
                </td>
                <td className="min-w-40 py-4 pr-4">
                  <p className="line-clamp-2 wrap-break-word">
                    {item.descriptionPreview}
                  </p>
                </td>
                <td className="w-24 py-4 pr-4">
                  {DIVISI_LABEL[item.fromDivisi]}
                </td>
                <td className="w-24 py-4 pr-4">
                  {DIVISI_LABEL[item.toDivisi]}
                </td>
                <td className="w-44 py-4 pr-4">
                  <StatusBadge
                    stage={item.stage}
                    fromDivisi={item.fromDivisi}
                    toDivisi={item.toDivisi}
                    wrap
                  />
                </td>
                <td className="w-32 py-4 pr-4">
                  {formatDateWita(item.createdAt)}
                </td>
                <td className="py-4 pr-2 text-right">
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
