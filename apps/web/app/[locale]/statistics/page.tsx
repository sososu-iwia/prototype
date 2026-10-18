import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getStatistics, getSeasons, getClub } from "../../../lib/api/server";
import { localized, date, type Locale } from "../../../lib/i18n/config";
import { metadata } from "../../../lib/metadata";
import { Offline, Empty } from "../../../components/ui/State";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params,
    t = await getTranslations({ locale, namespace: "ui" });
  return metadata(locale, "/statistics", t("stats"), t("stats"));
}
export default async function Statistics({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ season?: string; sort?: string }>;
}) {
  const { locale } = await params,
    q = await searchParams;
  const query = new URLSearchParams();
  if (q.season) query.set("season", q.season);
  if (q.sort) query.set("sort", q.sort);
  const [result, seasons, club] = await Promise.all([
    getStatistics(query.toString()),
    getSeasons(),
    getClub(),
  ]);
  const u = await getTranslations("ui");
  return (
    <main id="content" className="detail-page">
      <div className="container">
        <h1>{u("stats")}</h1>
        <Offline show={result.offline} />
        <form className="filter-form">
          <label>
            {u("season")}
            <select
              name="season"
              defaultValue={q.season || result.data.season || ""}
            >
              {seasons.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {u("stats")}
            <select name="sort" defaultValue={q.sort || "goals"}>
              {(["goals", "assists", "appearances", "efficiency"] as const).map(
                (k) => (
                  <option key={k} value={k}>
                    {u(k)}
                  </option>
                ),
              )}
            </select>
          </label>
          <button className="btn btn-primary">{u("search")}</button>
        </form>
        {result.data.items.length ? (
          <div className="table-scroll">
            <table className="league-table">
              <thead>
                <tr>
                  <th scope="col">{u("players")}</th>
                  {(
                    [
                      "appearances",
                      "goals",
                      "assists",
                      "minutes",
                      "efficiency",
                    ] as const
                  ).map((k) => (
                    <th key={k} scope="col">
                      {u(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <Link
                        href={`/${locale}/team/${row.playerSeason.player.slug}`}
                      >
                        {localized(row.playerSeason.player.names, locale)}
                      </Link>
                    </th>
                    <td>{row.appearances}</td>
                    <td>{row.goals}</td>
                    <td>{row.assists}</td>
                    <td>{row.minutes}</td>
                    <td>
                      {row.minutes
                        ? (
                            ((row.goals + row.assists) * 90) /
                            row.minutes
                          ).toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        <p className="source-notice">
          {u("efficiency")}: ({u("goals")} + {u("assists")}) × 90 /{" "}
          {u("minutes")}
        </p>
        {result.data.updatedAt && (
          <p className="source-notice">
            {u("updated")}:{" "}
            {date(result.data.updatedAt, locale, club.data.timezone, true)}
          </p>
        )}
      </div>
    </main>
  );
}
