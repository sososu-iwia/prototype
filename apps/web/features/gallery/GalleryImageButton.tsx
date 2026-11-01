"use client";
import { useState, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
const Lightbox = dynamic(() => import("./Lightbox"), { ssr: false });

// Keep responsive image markup and the media manifest on the server. Only the
// opener and the on-demand dialog need client state.
export function GalleryImageButton({
  children,
  url,
  title,
  className,
  openLabel,
  closeLabel,
}: {
  children: ReactNode;
  url: string;
  title: string;
  className: string;
  openLabel: string;
  closeLabel: string;
}) {
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={opener}
        className={className}
        title={openLabel}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <Lightbox
          closeLabel={closeLabel}
          returnFocus={opener.current}
          url={url}
          title={title}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
