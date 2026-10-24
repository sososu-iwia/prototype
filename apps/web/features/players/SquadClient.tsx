"use client";
import { useState } from "react";
import type { Locale } from "../../lib/i18n/config";
import { PlayerCard, type CardPlayer } from "./PlayerCard";
export type SquadLabels = Record<
  | "squadLabel"
  | "squadTitle"
  | "filterAll"
  | "filterGoalkeepers"
  | "filterDefenders"
  | "filterMidfielders"
  | "filterForwards"
  | "goalkeeper"
  | "defender"
  | "midfielder"
  | "forward"
  | "archive"
  | "empty",
  string
>;
export function SquadClient({
  players,
  locale,
  labels,
}: {
  players: CardPlayer[];
  locale: Locale;
  labels: SquadLabels;
}) {
  const [position, setPosition] = useState("all"),
    t = (key: keyof SquadLabels) => labels[key],
    u = t;
  const positions = [
    "goalkeeper",
    "defender",
    "midfielder",
    "forward",
  ] as const;
  const keys = {
    goalkeeper: "filterGoalkeepers",
    defender: "filterDefenders",
    midfielder: "filterMidfielders",
    forward: "filterForwards",
  } as const;
  return (
    <>
      <div className="team-page-heading">
        <div>
          <p className="section-label">{t("squadLabel")}</p>
          <h2>{t("squadTitle")}</h2>
        </div>
        <div className="team-filters">
          <button
            className={`filter-btn ${position === "all" ? "active" : ""}`}
            aria-pressed={position === "all"}
            onClick={() => setPosition("all")}
          >
            {t("filterAll")}
          </button>
          {positions.map((p) => (
            <button
              className={`filter-btn ${position === p ? "active" : ""}`}
              aria-pressed={position === p}
              key={p}
              onClick={() => setPosition(p)}
            >
              {t(keys[p])}
            </button>
          ))}
        </div>
      </div>
      {players.some((p) => p.verification === "LEGACY_UNVERIFIED") && (
        <p className="archive-badge">{u("archive")}</p>
      )}
      {positions
        .filter((p) => position === "all" || position === p)
        .map((p, i) => (
          <div key={p}>
            <div className="position-title">
              <span>0{i + 1}</span>
              <h3>{t(keys[p])}</h3>
            </div>
            <div className="team-page-grid">
              {players
                .filter((player) => player.position === p)
                .map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    locale={locale}
                    positionLabel={t(p)}
                  />
                ))}
            </div>
            {!players.some((player) => player.position === p) && (
              <p className="empty-state">{u("empty")}</p>
            )}
          </div>
        ))}
    </>
  );
}
