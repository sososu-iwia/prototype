"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localized } from "../../lib/i18n/config";
type Row = Record<string, unknown>;
export function MediaPicker({
  initial,
  fetchPage,
  onSelect,
  onClose,
}: {
  initial: Row[];
  fetchPage: (page: number) => Promise<{ items: Row[]; total: number }>;
  onSelect: (row: Row) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    u = useTranslations("ui"),
    locale = useLocale();
  const [items, setItems] = useState(initial),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(initial.length === 20),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current!,
      active = document.activeElement as HTMLElement;
    element.showModal();
    return () => {
      element.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="media-picker"
      aria-labelledby="media-picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="admin-toolbar">
        <h2 id="media-picker-title">{u("chooseMedia")}</h2>
        <button autoFocus className="btn btn-secondary" onClick={onClose}>
          {u("cancel")}
        </button>
      </div>
      <div className="admin-media-grid">
        {items.map((asset) => (
          <button key={String(asset.id)} onClick={() => onSelect(asset)}>
            <img
              src={String((asset.variants as Row)?.thumbnail || asset.url)}
              alt={localized(asset.alt, locale) || u("choose")}
            />
            <span>{u("choose")}</span>
          </button>
        ))}
      </div>
      {!items.length && <p>{u("empty")}</p>}
      {hasMore && (
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await fetchPage(page + 1);
              setItems((current) => [...current, ...result.items]);
              setPage(page + 1);
              setHasMore((page + 1) * 20 < result.total);
            } catch {
              setError(u("error"));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? u("loading") : u("next")}
        </button>
      )}
      <p role="status">{error}</p>
    </dialog>
  );
}
