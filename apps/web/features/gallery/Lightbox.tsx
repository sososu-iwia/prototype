"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
export default function Lightbox({
  url,
  title,
  onClose,
  returnFocus,
}: {
  url: string;
  title: string;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    t = useTranslations("ui");
  useEffect(() => {
    const d = dialog.current,
      previous = returnFocus || (document.activeElement as HTMLElement);
    d?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      className="gallery-dialog"
      ref={dialog}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button,[href],input,select,textarea,[tabindex="0"]',
          ),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (
          (e.shiftKey && document.activeElement === first) ||
          (!e.shiftKey && document.activeElement === last)
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }}
    >
      <button
        className="dialog-close"
        autoFocus
        onClick={onClose}
        aria-label={t("close")}
      >
        ×
      </button>
      <img src={url} alt={title} width="1280" height="850" />
      <p>{title}</p>
    </dialog>
  );
}
