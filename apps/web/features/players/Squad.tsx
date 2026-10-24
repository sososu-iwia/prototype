import { getLocale, getTranslations } from "next-intl/server";
import { SquadClient, type SquadLabels } from "./SquadClient";
import { toCardPlayer, type CardPlayer } from "./PlayerCard";

export async function Squad({ players }: { players: CardPlayer[] }) {
  const locale = await getLocale(),
    site = await getTranslations("site"),
    ui = await getTranslations("ui");
  const keys = [
    "squadLabel",
    "squadTitle",
    "filterAll",
    "filterGoalkeepers",
    "filterDefenders",
    "filterMidfielders",
    "filterForwards",
    "goalkeeper",
    "defender",
    "midfielder",
    "forward",
  ] as const;
  const labels = {
    ...Object.fromEntries(keys.map((key) => [key, site(key)])),
    archive: ui("archive"),
    empty: ui("empty"),
  } as SquadLabels;
  return (
    <SquadClient
      players={players.map(toCardPlayer)}
      locale={locale}
      labels={labels}
    />
  );
}
