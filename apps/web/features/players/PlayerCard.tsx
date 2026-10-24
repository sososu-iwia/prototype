import Link from "next/link";
import type { Player } from "../../lib/api/types";
import { localized, type Locale } from "../../lib/i18n/config";
import { Media } from "../../components/ui/Media";
export type CardPlayer = Pick<
  Player,
  | "id"
  | "slug"
  | "names"
  | "position"
  | "photo"
  | "verification"
  | "rosterNumber"
> & { seasons?: Player["seasons"] };
export function toCardPlayer(player: CardPlayer): CardPlayer {
  const current =
    player.seasons?.find((period) => period.season.current) ||
    player.seasons?.[0];
  return {
    id: player.id,
    slug: player.slug,
    names: player.names,
    position: player.position,
    photo: player.photo,
    verification: player.verification,
    rosterNumber:
      player.rosterNumber !== undefined
        ? player.rosterNumber
        : (current?.number ?? null),
  };
}
export function PlayerCard({
  player,
  locale,
  positionLabel,
  compact = false,
}: {
  player: CardPlayer;
  locale: Locale;
  positionLabel: string;
  compact?: boolean;
}) {
  const current =
    player.seasons?.find((s) => s.season.current) || player.seasons?.[0];
  const number =
    player.rosterNumber !== undefined ? player.rosterNumber : current?.number;
  return (
    <article
      className={compact ? "player-card" : "team-player-card"}
      data-position={player.position}
    >
      <Link
        prefetch={false}
        href={`/${locale}/players/${player.slug}`}
        className="player-card-link"
      >
        <div className={compact ? "player-image" : "team-player-image"}>
          {number != null && (
            <span className={compact ? "player-number" : "team-player-number"}>
              {number}
            </span>
          )}
          {player.photo && (
            <Media
              src={player.photo}
              alt={localized(player.names, locale)}
              className={compact ? "player-photo" : undefined}
            />
          )}
        </div>
        <div className={compact ? "player-info" : "team-player-content"}>
          <p className="player-position">{positionLabel}</p>
          <h3>{localized(player.names, locale)}</h3>
          {number != null && <span>#{number}</span>}
        </div>
      </Link>
    </article>
  );
}
