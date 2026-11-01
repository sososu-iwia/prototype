import { getLocale, getTranslations } from "next-intl/server";
import type { GalleryItem } from "../../lib/api/types";
import { localized } from "../../lib/i18n/config";
import { Media } from "../../components/ui/Media";
import { GalleryImageButton } from "./GalleryImageButton";
import { GalleryVideo } from "./GalleryVideo";

export async function Gallery({
  items,
  headingLevel = 3,
}: {
  items: GalleryItem[];
  headingLevel?: 2 | 3;
}) {
  const locale = await getLocale(),
    t = await getTranslations("ui"),
    p = await getTranslations("premium");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const labels = {
    playVideo: p("playVideo"),
    pauseVideo: p("pauseVideo"),
    videoBlocked: p("videoBlocked"),
    videoError: p("videoError"),
  };
  return (
    <>
      <div className="gallery-grid">
        {items.map((item, i) => {
          const title = localized(item.title, locale);
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
            <GalleryImageButton
              key={item.id}
              className={`gallery-item${i === 4 ? " gallery-wide" : ""}`}
              url={item.url}
              title={title}
              openLabel={t("openImage")}
              closeLabel={t("close")}
            >
              <Media src={item.url} alt="" />
              <div
                className="gallery-overlay"
                id={`gallery-caption-${item.id}`}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <Heading>{title}</Heading>
              </div>
            </GalleryImageButton>
          );
        })}
      </div>
      {!items.length && <p className="empty-state">{t("empty")}</p>}
    </>
  );
}
