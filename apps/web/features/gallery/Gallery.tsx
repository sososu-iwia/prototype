import { getLocale, getTranslations } from "next-intl/server";
import type { GalleryItem } from "../../lib/api/types";
import { GalleryClient } from "./GalleryClient";

export async function Gallery({
  items,
  headingLevel = 3,
}: {
  items: GalleryItem[];
  headingLevel?: 2 | 3;
}) {
  const locale = await getLocale(),
    t = await getTranslations("ui");
  return (
    <GalleryClient
      items={items}
      headingLevel={headingLevel}
      locale={locale}
      labels={{
        openImage: t("openImage"),
        empty: t("empty"),
        close: t("close"),
      }}
    />
  );
}
