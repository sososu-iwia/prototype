"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localized, type Locale } from "../../lib/i18n/config";
import type { Text } from "../../lib/api/types";

type Row = {
  id: string;
  version: number;
  sourceName: string;
  shirtNumber: number;
  sourcePosition: string;
  sourceNationality: string;
  sourceUrl: string;
  profileUrl: string | null;
  profileTeam: string | null;
  profilePosition: string | null;
  sourceCapturedAt: string;
  conflicts: string[];
  matchKind: string;
  proposedAliases: string[];
  reviewStatus: string;
  reviewNotes: string;
  playerId: string | null;
  teamId: string | null;
  position: string | null;
  positionSource: string | null;
  player: { names: Text; position: string; status: string } | null;
};
type Data = {
  items: Row[];
  teams: { id: string; names: Text }[];
  players: { id: string; names: Text }[];
};
type Draft = {
  notes: string;
  playerId: string;
  teamId: string;
  position: string;
  positionSource: string;
  publishPlayer: boolean;
};
export function KffReview({
  api,
  onDirty,
}: {
  api: (path: string, init?: RequestInit) => Promise<Data>;
  onDirty: (value: boolean) => void;
}) {
  const t = useTranslations("kff"),
    s = useTranslations("site"),
    locale = useLocale() as Locale;
  const [data, setData] = useState<Data>({ items: [], teams: [], players: [] }),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(
        await api(
          `admin/kff-review?season=2026${status ? `&status=${status}` : ""}`,
        ),
      );
    } catch {
      setMessage(t("error"));
    }
  }, [api, status, t]);
  useEffect(() => {
    void load();
  }, [load]);
  function edit(row: Row) {
    setSelected(row);
    setDraft({
      notes: row.reviewNotes,
      playerId: row.playerId || "",
      teamId: row.teamId || "",
      position: row.position || "",
      positionSource:
        row.positionSource === row.profileUrl ? "PROFILE" : "TEAM",
      publishPlayer: false,
    });
    onDirty(false);
  }
  function change(value: Partial<Draft>) {
    setDraft((old) => (old ? { ...old, ...value } : old));
    onDirty(true);
  }
  async function decide(action: string) {
    if (!selected || !draft) return;
    setBusy(true);
    setMessage("");
    try {
      const { playerId, teamId, position, positionSource, ...rest } = draft;
      await api(`admin/kff-review/${selected.id}`, {
        method: "PUT",
        headers: { "If-Match": String(selected.version) },
        body: JSON.stringify({
          action,
          ...rest,
          ...(playerId ? { playerId } : {}),
          ...(teamId ? { teamId } : {}),
          ...(position ? { position } : {}),
          positionSource,
        }),
      });
      onDirty(false);
      setSelected(null);
      setDraft(null);
      setMessage(t("saved"));
      await load();
    } catch {
      setMessage(t("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="kff-review">
      <h2>{t("title")}</h2>
      <p>{t("reviewHint")}</p>
      <p role="status">{message}</p>
      <label>
        {t("all")}
        <select
          value={status}
          disabled={!!selected}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("all")}</option>
          {(["PENDING", "APPROVED", "REJECTED", "DEFERRED"] as const).map(
            (key) => (
              <option key={key} value={key}>
                {t(key)}
              </option>
            ),
          )}
        </select>
      </label>
      {!selected ? (
        <div className="kff-review-list">
          {data.items.map((row) => (
            <article key={row.id}>
              <div>
                <strong>
                  #{row.shirtNumber} · {row.sourceName}
                </strong>
                <p>
                  {row.player
                    ? localized(row.player.names, locale)
                    : t("unknown")}{" "}
                  · {row.profileTeam || t("unknown")}
                </p>
                <p>{t(row.reviewStatus as "PENDING")}</p>
                {row.conflicts.map((c) => (
                  <span className="archive-badge" key={c}>
                    {t(c as "PROFILE_UNAVAILABLE")}
                  </span>
                ))}
              </div>
              <button onClick={() => edit(row)}>{t("EDIT")}</button>
            </article>
          ))}
        </div>
      ) : (
        draft && (
          <div className="kff-review-editor">
            <h3>
              #{selected.shirtNumber} · {selected.sourceName}
            </h3>
            <p>
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                {t("TEAM")}
              </a>{" "}
              ·{" "}
              {selected.profileUrl && (
                <a href={selected.profileUrl} target="_blank" rel="noreferrer">
                  {t("PROFILE")}
                </a>
              )}{" "}
              ·{" "}
              <time dateTime={selected.sourceCapturedAt}>
                {new Intl.DateTimeFormat(locale).format(
                  new Date(selected.sourceCapturedAt),
                )}
              </time>
            </p>
            <dl>
              <dt>{t("TEAM")}</dt>
              <dd>
                {selected.sourcePosition} · {selected.sourceNationality}
              </dd>
              <dt>{t("PROFILE")}</dt>
              <dd>
                {selected.profileTeam || t("unknown")} ·{" "}
                {selected.profilePosition || t("unknown")}
              </dd>
              <dt>{t("local")}</dt>
              <dd>
                {selected.player
                  ? `${localized(selected.player.names, locale)} · ${selected.player.position}`
                  : t("unknown")}
              </dd>
            </dl>
            {selected.conflicts.map((c) => (
              <p className="archive-badge" key={c}>
                {t(c as "PROFILE_UNAVAILABLE")}
              </p>
            ))}
            <label>
              {t("local")}
              <select
                aria-label={t("local")}
                value={draft.playerId}
                onChange={(e) => change({ playerId: e.target.value })}
              >
                <option value="">{t("unknown")}</option>
                {data.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {localized(p.names, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("team")}
              <select
                aria-label={t("team")}
                value={draft.teamId}
                onChange={(e) => change({ teamId: e.target.value })}
              >
                <option value="">{t("unknown")}</option>
                {data.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {localized(team.names, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("position")}
              <select
                aria-label={t("position")}
                value={draft.position}
                onChange={(e) => change({ position: e.target.value })}
              >
                <option value="">{t("unknown")}</option>
                {(
                  ["goalkeeper", "defender", "midfielder", "forward"] as const
                ).map((p) => (
                  <option key={p} value={p}>
                    {s(p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("positionSource")}
              <select
                aria-label={t("positionSource")}
                value={draft.positionSource}
                onChange={(e) => change({ positionSource: e.target.value })}
              >
                {(["TEAM", "PROFILE", "LOCAL"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t(p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("notes")}
              <textarea
                aria-label={t("notes")}
                maxLength={2000}
                value={draft.notes}
                onChange={(e) => change({ notes: e.target.value })}
              />
            </label>
            {selected.matchKind === "NEW" &&
              selected.player?.status === "DRAFT" && (
                <label>
                  <input
                    type="checkbox"
                    checked={draft.publishPlayer}
                    onChange={(e) =>
                      change({ publishPlayer: e.target.checked })
                    }
                  />
                  {t("publishPlayer")}
                </label>
              )}
            <div className="kff-review-actions">
              {(["EDIT", "APPROVE", "REJECT", "DEFER"] as const).map(
                (action) => (
                  <button
                    key={action}
                    disabled={busy}
                    onClick={() => void decide(action)}
                  >
                    {t(action)}
                  </button>
                ),
              )}
            </div>
          </div>
        )
      )}
    </section>
  );
}
