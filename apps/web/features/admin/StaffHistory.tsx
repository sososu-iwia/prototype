"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localized } from "../../lib/i18n/config";
import type { Text } from "../../lib/api/types";
type Revision = {
  id: string;
  staffVersion: number;
  recordedAt: string;
  title: Text;
  roleCode: string;
  status: string;
  source: string;
  team: { names: Text } | null;
  season: { name: string } | null;
};

export function StaffHistory({
  staffId,
  api,
}: {
  staffId: string;
  api: (path: string) => Promise<unknown>;
}) {
  const t = useTranslations("staffHistory"),
    u = useTranslations("ui"),
    locale = useLocale();
  const [rows, setRows] = useState<Revision[]>([]),
    [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
      "idle",
    );
  async function load() {
    setState("loading");
    try {
      setRows(
        (await api(
          `admin/staff/${encodeURIComponent(staffId)}/history`,
        )) as Revision[],
      );
      setState("ready");
    } catch {
      setState("error");
    }
  }
  return (
    <details
      className="staff-history"
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>{t("title")}</summary>
      <p role="status">
        {state === "loading"
          ? t("loading")
          : state === "error"
            ? t("error")
            : state === "ready" && rows.length === 0
              ? t("empty")
              : ""}
      </p>
      {state === "error" && (
        <button type="button" onClick={() => void load()}>
          {u("retry")}
        </button>
      )}
      {state === "ready" && (
        <ol>
          {rows.map((row) => (
            <li key={row.id}>
              <strong>
                {t("version", { version: row.staffVersion })} ·{" "}
                {u(row.status as "DRAFT")}
              </strong>
              <p>
                {localized(row.title, locale)}
                {localized(row.title, locale) !== u(row.roleCode as "OTHER") &&
                  ` · ${u(row.roleCode as "OTHER")}`}
              </p>
              <p>
                {row.team ? localized(row.team.names, locale) : t("unknown")} ·{" "}
                {row.season?.name || t("unknown")}
              </p>
              <time dateTime={row.recordedAt}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Almaty",
                }).format(new Date(row.recordedAt))}
              </time>
              <p>
                {t("source")}: {row.source}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p className="admin-help">{t("notice")}</p>
    </details>
  );
}
