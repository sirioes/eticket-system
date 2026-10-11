import { StatusBadge } from "@/components/tickets/status-badge";
import { Attachments, DetailLink } from "@/components/tickets/ticket-table";
import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import type { Divisi } from "@/types/auth.types";
import type { TicketListItem } from "@/types/ticket.types";

type Kind = "Masuk" | "Keluar";

const KIND_STYLE: Record<Kind, string> = {
  Keluar: "border border-teal/40 bg-mist text-teal",
  Masuk: "bg-ink/10 text-ink",
};

function kindOf(item: TicketListItem, viewerDivisi: Divisi): Kind {
  return item.fromDivisi === viewerDivisi ? "Keluar" : "Masuk";
}

function counterpartText(item: TicketListItem, kind: Kind): string {
  return kind === "Keluar"
    ? `ke ${DIVISI_LABEL[item.toDivisi]}`
    : `dari ${DIVISI_LABEL[item.fromDivisi]}`;
}

function KindBadge({ kind }: { kind: Kind }) {
  return (
    <span
      className={`inline-flex animate-pop-in items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${KIND_STYLE[kind]}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={kind === "Keluar" ? "M7 17 17 7M8 7h9v9" : "M17 7 7 17M16 17H7V8"} />
      </svg>
      {kind}
    </span>
  );
}

export function RecentTicketsTable({
  items,
  viewerDivisi,
}: {
  items: TicketListItem[];
  viewerDivisi: Divisi;
}) {
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 2xl:hidden">
        {items.map((item, index) => {
          const kind = kindOf(item, viewerDivisi);
          return (
            <li
              key={item.id}
              style={{ animationDelay: `${index * 40}ms` }}
              className="flex animate-fade-up flex-col rounded-2xl border border-ink/10 bg-mist p-4"
            >
              <div className="flex flex-col items-start gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-ink/70">#{index + 1}</p>
                  <p className="mt-0.5 font-mono font-semibold break-all">{item.id}</p>
                </div>
                <StatusBadge stage={item.stage} fromDivisi={item.fromDivisi} toDivisi={item.toDivisi} wrap />
              </div>
              <p className="mt-3 line-clamp-3 text-sm wrap-break-word">{item.descriptionPreview}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Jenis</dt>
                  <dd className="mt-0.5 flex flex-col items-start gap-1">
                    <KindBadge kind={kind} />
                    <span className="text-xs text-ink/70">{counterpartText(item, kind)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Lampiran</dt>
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
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto 2xl:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
              <th scope="col" className="py-3 pr-4 font-medium">No</th>
              <th scope="col" className="py-3 pr-4 font-medium">ID Pengaduan</th>
              <th scope="col" className="py-3 pr-4 font-medium">Deskripsi</th>
              <th scope="col" className="py-3 pr-4 font-medium">Lampiran</th>
              <th scope="col" className="py-3 pr-4 font-medium">Status</th>
              <th scope="col" className="py-3 pr-4 font-medium">Tanggal</th>
              <th scope="col" className="py-3 pr-4 font-medium">Jenis</th>
              <th scope="col" className="py-3 font-medium">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const kind = kindOf(item, viewerDivisi);
              return (
                <tr
                  key={item.id}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className="animate-fade-up border-b border-ink/10 transition-colors duration-200 last:border-b-0 hover:bg-teal/5"
                >
                  <td className="py-4 pr-4 font-mono text-xs text-ink/70">{index + 1}</td>
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
                  <td className="w-36 py-4 pr-4">
                    <div className="flex flex-col items-start gap-1">
                      <KindBadge kind={kind} />
                      <span className="text-xs text-ink/70">{counterpartText(item, kind)}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-6 text-right">
                    <DetailLink id={item.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
