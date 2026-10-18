"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Player } from "../../lib/api/types";
import { PlayerCard } from "./PlayerCard";
export function Squad({ players }: { players: Player[] }) {
  const [position, setPosition] = useState("all"),
    t = useTranslations("site"),
    u = useTranslations("ui"),
    locale = useLocale();
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
