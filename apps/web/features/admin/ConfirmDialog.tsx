"use client";
import { useEffect, useRef } from "react";
export function ConfirmDialog({
  message,
  confirm,
  cancel,
  onClose,
}: {
  message: string;
  confirm: string;
  cancel: string;
  onClose: (value: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const active = document.activeElement as HTMLElement;
    dialog.showModal();
    return () => {
      dialog.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby="confirmation-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
    >
      <h2 id="confirmation-title">{message}</h2>
      <div className="admin-toolbar">
        <button
          autoFocus
          className="btn btn-secondary"
          onClick={() => onClose(false)}
        >
          {cancel}
        </button>
        <button className="btn btn-primary" onClick={() => onClose(true)}>
          {confirm}
        </button>
      </div>
    </dialog>
  );
}
