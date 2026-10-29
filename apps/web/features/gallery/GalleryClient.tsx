"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { localized, type Locale } from "../../lib/i18n/config";
import type { GalleryItem } from "../../lib/api/types";
import { Media } from "../../components/ui/Media";
const Lightbox = dynamic(() => import("./Lightbox"), { ssr: false });
function Video({ item, title }: { item: GalleryItem; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useRef(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        if (inView.current) {
          setVisible(true);
          if (!reduced.matches && video.currentSrc)
            void video.play().catch(() => {});
        } else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    const handle = () => {
      if (document.hidden || reduced.matches) video.pause();
    };
    document.addEventListener("visibilitychange", handle);
    reduced.addEventListener("change", handle);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handle);
      reduced.removeEventListener("change", handle);
      video.pause();
    };
  }, []);
  useEffect(() => {
    const video = ref.current;
    if (
      visible &&
      inView.current &&
      video &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const rect = video.getBoundingClientRect();
      if (rect.top < innerHeight && rect.bottom > 0)
        void video.play().catch(() => {});
    }
  }, [visible]);
  return (
    <video
      className="gallery-video"
      ref={ref}
      src={visible ? item.url : undefined}
      poster={visible ? item.poster || undefined : undefined}
      muted
      loop
      playsInline
      controls
      preload="none"
      aria-label={title}
      onPlay={() => {
        // A pending play request can finish after the observer has paused it.
        if (!inView.current || document.hidden) ref.current?.pause();
      }}
      onLoadedData={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (
          rect &&
          inView.current &&
          rect.top < innerHeight &&
          rect.bottom > 0 &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          void ref.current?.play().catch(() => {});
      }}
    />
  );
}
export function GalleryClient({
  items,
  headingLevel = 3,
  locale,
  labels,
}: {
  items: GalleryItem[];
  headingLevel?: 2 | 3;
  locale: Locale;
  labels: Record<"openImage" | "empty" | "close", string>;
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
