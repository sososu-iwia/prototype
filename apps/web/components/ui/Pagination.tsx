import Link from "next/link";
import { getTranslations } from "next-intl/server";
export async function Pagination({
  page,
  total,
  limit,
  path,
}: {
  page: number;
  total: number;
  limit: number;
  path: string;
}) {
  if (total <= limit) return null;
  const t = await getTranslations("ui");
  return (
    <nav className="pagination" aria-label={t("page")}>
      {page > 1 && (
        <Link href={`${path}?page=${page - 1}`}>{t("previous")}</Link>
      )}
      <span>
        {t("page")} {page} / {Math.ceil(total / limit)}
      </span>
      {page * limit < total && (
        <Link href={`${path}?page=${page + 1}`}>{t("next")}</Link>
      )}
    </nav>
  );
}
