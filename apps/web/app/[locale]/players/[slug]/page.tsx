import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlayer, getClub } from "../../../../lib/api/server";
import { localized, date, type Locale } from "../../../../lib/i18n/config";
import { metadata } from "../../../../lib/metadata";
import { Media } from "../../../../components/ui/Media";
import { Archive, Offline, Empty } from "../../../../components/ui/State";
import { PortraitPlaceholder } from "../../../../components/editorial/PortraitPlaceholder";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params,
    player = await getPlayer(slug),
    t = await getTranslations({ locale, namespace: "ui" });
  if (!player.data) return {};
  return metadata(
    locale,
    `/players/${slug}`,
    localized(player.data.names, locale),
    t("profile"),
    player.data.photo || undefined,
  );
}
export default async function Profile({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const [result, club] = await Promise.all([getPlayer(slug), getClub()]);
  const p = result.data;
  if (!p) notFound();
  const activeMembership = p.memberships?.find(
    (m) =>
      m.team.managed &&
      m.datesVerified === true &&
      new Date(m.startsAt) <= new Date() &&
      (!m.endsAt || new Date(m.endsAt) > new Date()),
  );
  const u = await getTranslations("ui"),
    k = await getTranslations("kff"),
    s = await getTranslations("site");
  return (
    <main id="content" className="detail-page">
      <div className="container">
        <Link className="section-link" href={`/${locale}/team`}>
          ← {s("team")}
        </Link>
        <Offline show={result.offline} />
        <div className="profile-grid">
          <div className="profile-image">
            {p.photo ? (
              <Media
                src={p.photo}
                alt={localized(p.names, locale)}
                priority
                sizes="(max-width: 768px) 90vw, 40vw"
              />
            ) : (
              <PortraitPlaceholder label={k("photoPending")} />
            )}
          </div>
          <div>
            <p className="section-label">{s(p.position)}</p>
            <h1>{localized(p.names, locale)}</h1>
            <Archive verification={p.verification} />
            <dl className="profile-facts">
              {activeMembership && (
                <>
                  <dt>{u("teamId")}</dt>
                  <dd>{localized(activeMembership.team.names, locale)}</dd>
                </>
              )}
              {p.rosterStatus && (
                <>
                  <dt>{u("rosterStatus")}</dt>
                  <dd>
                    {u(
                      p.rosterStatus === "UNCONFIRMED" ||
                        (p.rosterStatus === "ACTIVE" && !activeMembership)
                        ? "contractUnconfirmed"
                        : (p.rosterStatus as "ACTIVE"),
                    )}
                  </dd>
                </>
              )}
              {activeMembership?.number != null && (
                <>
                  <dt>{u("number")}</dt>
                  <dd>#{activeMembership!.number}</dd>
                </>
              )}
              {p.citizenship && (
                <>
                  <dt>{u("citizenship")}</dt>
                  <dd>{p.citizenship}</dd>
                </>
              )}
              {p.birthDate && (
                <>
                  <dt>{u("birthDate")}</dt>
                  <dd>{date(p.birthDate, locale, "UTC")}</dd>
                </>
              )}
              {p.height && (
                <>
                  <dt>{u("height")}</dt>
                  <dd>{p.height}</dd>
                </>
              )}
            </dl>
            {localized(p.biography, locale) && (
              <>
                <h2>{u("biography")}</h2>
                <p className="article-body">{localized(p.biography, locale)}</p>
              </>
            )}
          </div>
        </div>
        {!!p.registrations?.length && (
          <section className="season-stat">
            <h2>{k("season")}</h2>
            <p>{k("seasonNotice")}</p>
            {p.registrations.map((r) => (
              <p key={r.id}>
                {r.seasonId} · #{r.number} · {r.sourceName} ·{" "}
                <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                  {k("source")}
                </a>
              </p>
            ))}
          </section>
        )}
        {!!p.memberships?.length && (
          <section className="season-stat">
            <h2>{u("careerHistory")}</h2>
            <div
              className="table-scroll"
              role="region"
              aria-label={u("careerHistory")}
              tabIndex={0}
            >
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>{u("teamId")}</th>
                    <th>{u("season")}</th>
                    <th>{u("number")}</th>
                    <th>{u("startsAt")}</th>
                    <th>{u("endsAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.memberships.map((m) => (
                    <tr key={m.id}>
                      <td>{localized(m.team.names, locale)}</td>
                      <td>{m.season.name}</td>
                      <td>{m.number ?? "—"}</td>
                      <td>
                        {date(m.startsAt, locale)}
                        {m.datesVerified === false && (
                          <small className="archive-badge">
                            {u("snapshotDate")}
                          </small>
                        )}
                      </td>
                      <td>
                        {m.endsAt
                          ? date(m.endsAt, locale)
                          : u(
                              m.datesVerified
                                ? "ACTIVE"
                                : "contractUnconfirmed",
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {!!p.achievements?.length && (
          <section className="season-stat">
            <h2>{u("achievements")}</h2>
            {p.achievements.map((a) => (
              <div key={a.id}>
                <h3>
                  {a.year} {localized(a.title, locale)}
                </h3>
                <p>{localized(a.description, locale)}</p>
                <Archive verification={a.verification} />
              </div>
            ))}
          </section>
        )}
        <h2>{u("stats")}</h2>
        {p.seasons.map((season) => (
          <section key={season.id} className="season-stat">
            <h3>
              {u("season")}: {season.season.name}
            </h3>
            {season.statistics ? (
              <>
                <dl className="stat-cards">
                  {(
                    [
                      "appearances",
                      "goals",
                      "assists",
                      "minutes",
                      "yellowCards",
                      "redCards",
                      "cleanSheets",
                    ] as const
                  )
                    .filter((k) => season.statistics?.[k] != null)
                    .map((k) => (
                      <div key={k}>
                        <dt>{u(k)}</dt>
                        <dd>{season.statistics?.[k]}</dd>
                      </div>
                    ))}
                </dl>
                <p className="source-notice">
                  {u("source")}: {season.statistics.source}. {u("updated")}:{" "}
                  {date(
                    season.statistics.updatedAt,
                    locale,
                    club.data.timezone,
                    true,
                  )}
                </p>
              </>
            ) : (
              <Empty />
            )}
          </section>
        ))}
        <p className="source-notice">
          {u("source")}: {p.source}
        </p>
      </div>
    </main>
  );
}
