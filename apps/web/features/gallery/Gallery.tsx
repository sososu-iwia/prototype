"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { localized } from "../../lib/i18n/config";
import type { GalleryItem } from "../../lib/api/types";
import { Media } from "../../components/ui/Media";
const Lightbox = dynamic(() => import("./Lightbox"), { ssr: false });
function Video({ item, title }: { item: GalleryItem; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (!reduced.matches) void video.play().catch(() => {});
        } else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    const handle = () => {
      if (document.hidden) video.pause();
    };
    document.addEventListener("visibilitychange", handle);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handle);
      video.pause();
    };
  }, []);
  return (
    <video
      className="gallery-video"
      ref={ref}
      src={visible ? item.url : undefined}
      poster={item.poster || undefined}
      muted
      loop
      playsInline
      controls
      preload="none"
      aria-label={title}
      onLoadedData={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (
          rect &&
          rect.top < innerHeight &&
          rect.bottom > 0 &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          void ref.current?.play().catch(() => {});
      }}
    />
  );
}
export function Gallery({
  items,
  headingLevel = 3,
}: {
  items: GalleryItem[];
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const locale = useLocale(),
    u = useTranslations("ui");
  const opener = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  return (
    <>
      <div className="gallery-grid">
        {items.map((item, i) => {
          const title = localized(item.title, locale);
          const content = (
            <>
              <Media src={item.url} alt={title} />
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
              <Video item={item} title={title} />
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
              aria-labelledby={`gallery-caption-${item.id}`}
            >
              {content}
            </button>
          );
        })}
      </div>
      {!items.length && <p className="empty-state">{u("empty")}</p>}
      {selected && (
        <Lightbox
          returnFocus={opener.current}
          url={selected.url}
          title={localized(selected.title, locale)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
