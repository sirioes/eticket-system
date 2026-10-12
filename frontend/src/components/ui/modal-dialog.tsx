"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalDialogProps {
  titleId: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function ModalDialog({ titleId, busy, onClose, children }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-mist text-ink shadow-[0_30px_80px_-24px_color-mix(in_oklab,var(--color-ink)_60%,transparent)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-pop-in"
    >
      {children}
    </dialog>
  );
}
