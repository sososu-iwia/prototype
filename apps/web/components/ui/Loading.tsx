import { getTranslations } from "next-intl/server";
export default async function Loading() {
  const t = await getTranslations("ui");
  return (
    <main id="content" className="detail-page">
      <div className="container" aria-busy="true" role="status">
        <p>{t("loading")}</p>
        <div className="skeleton" />
      </div>
    </main>
  );
}
