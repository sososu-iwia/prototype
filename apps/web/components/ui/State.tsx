import { getTranslations } from "next-intl/server";
import { RetryApi } from "./RetryApi";
export async function Empty() {
  const t = await getTranslations("ui");
  return (
    <p className="empty-state" role="status">
      {t("empty")}
    </p>
  );
}
export async function Offline({ show }: { show: boolean }) {
  const t = await getTranslations("ui");
  return show ? (
    <div className="source-notice" role="status">
      <p>{t("offline")}</p>
      <RetryApi label={t("retry")} loading={t("loading")} />
    </div>
  ) : null;
}
export async function Archive({ verification }: { verification?: string }) {
  const t = await getTranslations("ui");
  return verification === "LEGACY_UNVERIFIED" ? (
    <p className="archive-badge">{t("archive")}</p>
  ) : null;
}
