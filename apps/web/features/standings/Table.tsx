import { getTranslations } from "next-intl/server";
import type { Standings } from "../../lib/api/types";
import { date, type Locale } from "../../lib/i18n/config";
import { Empty } from "../../components/ui/State";
export async function StandingsTable({
  data,
  locale,
  timeZone = "Asia/Almaty",
}: {
  data: Standings;
  locale: Locale;
  timeZone?: string;
}) {
  const u = await getTranslations("ui"),
    t = await getTranslations("site");
  return (
    <>
      <h2>{u("standings")}</h2>
      {data.stale && <p className="source-notice">{u("stale")}</p>}
      {data.rows.length ? (
        <div
          className="table-scroll"
          role="region"
          aria-label={u("standings")}
          tabIndex={0}
        >
          <table className="league-table">
            <caption>
              {data.source} ·{" "}
              {data.updatedAt
                ? date(data.updatedAt, locale, timeZone, true)
                : "—"}
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t("team")}</th>
                {(
                  [
                    "played",
                    "win",
                    "draw",
                    "lose",
                    "goalDifference",
                    "points",
                  ] as const
                ).map((k) => (
                  <th scope="col" key={k}>
                    {u(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.team.id}>
                  <th scope="row">{row.rank}</th>
                  <td>{row.team.name}</td>
                  <td>{row.all.played}</td>
                  <td>{row.all.win}</td>
                  <td>{row.all.draw}</td>
                  <td>{row.all.lose}</td>
                  <td>{row.goalsDiff}</td>
                  <td>
                    <strong>{row.points}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
      {data.updatedAt && (
        <p className="source-notice">
          {u("source")}: {data.source}. {u("updated")}:{" "}
          {date(data.updatedAt, locale, timeZone, true)}
        </p>
      )}
    </>
  );
}
