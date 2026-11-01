"use client";
import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { localized, type Locale } from "../../lib/i18n/config";
import type { GalleryItem } from "../../lib/api/types";
import { Media } from "../../components/ui/Media";
import { GalleryVideo, type VideoLabels } from "./GalleryVideo";
const Lightbox = dynamic(() => import("./Lightbox"), { ssr: false });
export function GalleryClient({
  items,
  headingLevel = 3,
  locale,
  labels,
}: {
  items: GalleryItem[];
  headingLevel?: 2 | 3;
  locale: Locale;
  labels: Record<"openImage" | "empty" | "close", string> & VideoLabels;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const u = (key: keyof typeof labels) => labels[key];
  const opener = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  return (
    <>
      <div className="gallery-grid">
        {items.map((item, i) => {
          const title = localized(item.title, locale);
          const content = (
            <>
              <Media src={item.url} alt="" />
              <div
                className="gallery-overlay"
                id={`gallery-caption-${item.id}`}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <Heading>{title}</Heading>
              </div>
            </>
          );
          return item.kind === "video" ? (
            <div key={item.id} className="gallery-item gallery-large">
              <GalleryVideo
                item={item}
                title={title}
                labels={labels}
                priority={headingLevel === 2 && i === 0}
              />
              <div className="gallery-overlay video-overlay">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <Heading>{title}</Heading>
              </div>
            </div>
          ) : (
            <button
              className={`gallery-item${i === 4 ? " gallery-wide" : ""}`}
              onClick={(event) => {
                opener.current = event.currentTarget;
                setSelected(item);
              }}
              key={item.id}
              title={u("openImage")}
            >
              {content}
            </button>
          );
        })}
      </div>
      {!items.length && <p className="empty-state">{u("empty")}</p>}
      {selected && (
        <Lightbox
          closeLabel={labels.close}
          returnFocus={opener.current}
          url={selected.url}
          title={localized(selected.title, locale)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
