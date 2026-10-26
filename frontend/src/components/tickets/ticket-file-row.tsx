import { previewKind, type PreviewKind } from "@/components/tickets/attachment-preview-dialog";
import { OUTLINE_BUTTON_CLASS } from "@/components/ui/button-class";

const FILE_ICON_PATH = "M6 3h9l4 4v14H6zM15 3v4h4";
const DOWNLOAD_ICON_PATH = "M12 4v11M7 10l5 5 5-5M5 20h14";
const EYE_ICON_PATH = "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ICON_TONE: Record<string, string> = {
  "application/pdf": "bg-red text-mist",
  [XLSX_MIME]: "bg-green text-ink",
  [DOCX_MIME]: "bg-teal text-mist",
  "image/png": "bg-aqua text-ink",
  "image/jpeg": "bg-aqua text-ink",
  "image/webp": "bg-aqua text-ink",
};

const FALLBACK_TONE = "bg-ink text-mist";
const NO_PREVIEW_HINT = "Pratinjau hanya tersedia untuk PDF dan gambar";

function IconPath({ path, className }: { path: string; className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

interface TicketFileRowProps {
  fileName: string;
  mimeType: string;
  meta: string;
  downloading: boolean;
  downloadDisabled: boolean;
  onPreview: (kind: PreviewKind) => void;
  onDownload: () => void;
}

export function TicketFileRow({
  fileName,
  mimeType,
  meta,
  downloading,
  downloadDisabled,
  onPreview,
  onDownload,
}: TicketFileRowProps) {
  const kind = previewKind(mimeType);
  const tone = Object.hasOwn(ICON_TONE, mimeType) ? ICON_TONE[mimeType] : FALLBACK_TONE;
  const text = (
    <span className="min-w-0 flex-1">
      <span title={fileName} className="block truncate text-sm font-medium">
        {fileName}
      </span>
      <span className="mt-0.5 block truncate font-mono text-xs text-ink/70">{meta}</span>
    </span>
  );

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ink/10 p-3">
      {kind === null ? (
        <span aria-hidden="true" title={NO_PREVIEW_HINT} className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
          <IconPath path={FILE_ICON_PATH} className="size-5" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onPreview(kind)}
          aria-haspopup="dialog"
          aria-label={`Lihat pratinjau ${fileName}`}
          title="Lihat pratinjau"
          className={`group relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl transition-transform duration-200 ease-spring hover:scale-110 focus-visible:scale-110 ${tone}`}
        >
          <IconPath path={FILE_ICON_PATH} className="size-5" />
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center bg-ink/70 text-mist opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <IconPath path={EYE_ICON_PATH} className="size-5" />
          </span>
        </button>
      )}
      {text}
      <button
        type="button"
        onClick={onDownload}
        disabled={downloadDisabled}
        aria-busy={downloading}
        aria-label={`Unduh ${fileName}`}
        title="Unduh"
        className={`${OUTLINE_BUTTON_CLASS} size-10 shrink-0`}
      >
        {downloading ? (
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
        ) : (
          <IconPath path={DOWNLOAD_ICON_PATH} className="size-4" />
        )}
      </button>
    </li>
  );
}
