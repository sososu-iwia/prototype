import { getTranslations } from "next-intl/server";
import { getGallery } from "../../../lib/api/server";
import type { Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
import { Gallery } from "../../../features/gallery/Gallery";
import { Offline } from "../../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "site" });
  return metadata(locale, "/gallery", t("gallery"), t("galleryDescription"));
}
export default async function GalleryPage() {
  const result = await getGallery(),
    t = await getTranslations("site");
  return (
    <main id="content" className="detail-page">
      <section className="gallery-section">
        <div className="container">
          <div className="gallery-heading">
            <p className="section-label">{t("galleryLabel")}</p>
            <h1>{t("galleryTitle")}</h1>
            <p>{t("galleryDescription")}</p>
          </div>
          <Offline show={result.offline} />
          <Gallery headingLevel={2} items={result.data.items} />
        </div>
      </section>
    </main>
  );
}
