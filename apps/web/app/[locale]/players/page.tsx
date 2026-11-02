import { Suspense } from "react";
import Loading from "../../../components/ui/Loading";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPlayers, getSeasons } from "../../../lib/api/server";
import type { Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
import { Squad } from "../../../features/players/Squad";
import { Offline } from "../../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const u = await getTranslations({ locale, namespace: "ui" });
  return metadata(locale, "/players", u("archiveRoster"), u("careerHistory"));
}
export default function PlayerArchive(
  props: Parameters<typeof PlayerArchiveContent>[0],
) {
  return (
    <Suspense fallback={<Loading />}>
      <PlayerArchiveContent {...props} />
    </Suspense>
  );
}
async function PlayerArchiveContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ season?: string; page?: string }>;
}) {
  const { locale } = await params,
    q = await searchParams,
    u = await getTranslations("ui");
  const page = /^[1-9]\d*$/.test(q.page || "") ? Number(q.page) : 1;
  const [result, seasons] = await Promise.all([
    getPlayers(
      new URLSearchParams({
        archive: "true",
        limit: "24",
        page: String(page),
        ...(q.season ? { season: q.season } : {}),
      }).toString(),
    ),
    getSeasons(),
  ]);
  return (
    <main id="content" className="detail-page">
      <div className="container">
        <p className="section-label">FC ORDABASY</p>
        <h1>{u("archiveRoster")}</h1>
        <Link href={`/${locale}/team`} className="section-link">
          {u("currentRoster")}
        </Link>
        <nav className="team-filters" aria-label={u("season")}>
          <Link className="filter-btn" href={`/${locale}/players`}>
            {u("allSeasons")}
          </Link>
          {seasons.data.map((s) => (
            <Link
              key={s.id}
              className={`filter-btn${q.season === s.id ? " active" : ""}`}
              href={`/${locale}/players?season=${encodeURIComponent(s.id)}`}
            >
              {s.name}
            </Link>
          ))}
        </nav>
        <Offline show={result.offline} />
        <Squad players={result.data.items} />
        <nav className="pagination" aria-label={u("page")}>
          {page > 1 && (
            <Link
              href={`?${new URLSearchParams({ ...(q.season ? { season: q.season } : {}), page: String(page - 1) })}`}
            >
              {u("previous")}
            </Link>
          )}
          <span>
            {page} / {Math.max(1, Math.ceil(result.data.total / 24))}
          </span>
          {page * 24 < result.data.total && (
            <Link
              href={`?${new URLSearchParams({ ...(q.season ? { season: q.season } : {}), page: String(page + 1) })}`}
            >
              {u("next")}
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
