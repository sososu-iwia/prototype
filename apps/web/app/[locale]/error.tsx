"use client";
import { useTranslations } from "next-intl";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("ui");
  return (
    <main id="content" className="detail-page">
      <div className="container">
        <h1>{t("error")}</h1>
        <button className="btn btn-primary" onClick={reset}>
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
