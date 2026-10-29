"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { localized, locales, type UiKey } from "../../lib/i18n/config";
import { MediaPicker } from "./MediaPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { entityFields, blank, editable, type Field } from "./schema";
import { AdminApiError, rebaseDraft } from "./drafts";
type Row = Record<string, unknown>;
type User = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "EDITOR";
};
export function Admin({ initialUser }: { initialUser: User | null }) {
  const u = useTranslations("ui"),
    s = useTranslations("site"),
    locale = useLocale();
  const [user, setUser] = useState<User | null>(initialUser),
    [entity, setEntity] = useState("dashboard"),
    [rows, setRows] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState<Row | null>(null),
    [editingId, setEditingId] = useState<string | undefined>(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [relations, setRelations] = useState<Record<string, Row[]>>({}),
    [tab, setTab] = useState<"kk" | "ru" | "en">(locale),
    [preview, setPreview] = useState(false),
    [statusFilter, setStatusFilter] = useState(""),
    [sort, setSort] = useState("id"),
    [direction, setDirection] = useState("asc"),
    [dirty, setDirty] = useState(false),
    [conflict, setConflict] = useState(false),
    [version, setVersion] = useState<number | undefined>(),
    [confirmRequest, setConfirmRequest] = useState<{
      message: string;
      resolve: (value: boolean) => void;
    } | null>(null),
    [mediaPicker, setMediaPicker] = useState(false),
    [assets, setAssets] = useState<Row[]>([]),
    [relationFilters, setRelationFilters] = useState<Record<string, string>>(
      {},
    ),
    [dashboard, setDashboard] = useState<Record<string, number>>({});
  const loadSequence = useRef(0);
  const baseDraft = useRef<Row>({});
  const csrf = useRef(""),
    formRef = useRef<HTMLFormElement>(null),
    submissionKey = useRef("");
  const ask = (message: string) =>
    new Promise<boolean>((resolve) => setConfirmRequest({ message, resolve }));
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const follow = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setConfirmRequest({
        message: u("unsaved"),
        resolve: (accepted) => {
          if (accepted) {
            window.removeEventListener("beforeunload", warn);
            setDirty(false);
            window.location.assign(anchor.href);
          }
        },
      });
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", follow, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", follow, true);
    };
  }, [dirty, u]);
  async function navigate(next: string, filters: Record<string, string> = {}) {
    if (busy) return;
    if (dirty && !(await ask(u("unsaved")))) return;
    setEntity(next);
    setRows([]);
    setTotal(0);
    setDraft(null);
    setDirty(false);
    setVersion(undefined);
    setConflict(false);
    setPage(1);
    setQ("");
    setSearch("");
    setStatusFilter("");
    setSort("id");
    setRelationFilters(filters);
    setMessage("");
  }
  const label = useCallback(
    (key: string) => {
      if (key === "cancelled" && entity === "memberships")
        return u("membershipCancelled");
      if (["goalkeeper", "defender", "midfielder", "forward"].includes(key))
        return s(key as "goalkeeper");
      const states: Record<string, UiKey> = {
        SCHEDULED: "scheduled",
        LIVE: "LIVE",
        FINISHED: "finished",
        POSTPONED: "postponed",
        CANCELLED: "cancelled",
      };
      if (states[key]) return u(states[key]);
      return u.has(key as UiKey) ? u(key as UiKey) : key;
    },
    [u, s, entity],
  );
  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`/api/v1/${path}`, {
        ...init,
        credentials: "same-origin",
        headers: {
          ...(init.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(init.method && init.method !== "GET"
            ? { "X-CSRF-Token": csrf.current }
            : {}),
          ...init.headers,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = body.error?.code;
        const messages = {
          INVALID_RELATION: "invalidRelation",
          PLAYER_NOT_IN_ROSTER: "playerNotInRoster",
          MATCH_NOT_PLAYED: "matchNotPlayed",
          AMBIGUOUS_TEAM: "teamRequired",
          MISSING_MEDIA: "missingMedia",
          INVALID_CLEAN_SHEET: "invalidCleanSheet",
          INVALID_SEASON_PERIOD: "invalidSeasonPeriod",
          MATCH_HAS_HISTORY: "historyProtected",
          PAYLOAD_TOO_LARGE: "requestTooLarge",
        } as const;
        if (code in messages)
          throw new Error(u(messages[code as keyof typeof messages]));
        if (res.status === 401) {
          setUser(null);
          csrf.current = "";
          throw new Error(u("authError"));
        }
        throw new AdminApiError(
          code === "EDIT_CONFLICT" || code === "VERSION_REQUIRED"
            ? u("editConflict")
            : code === "MEMBERSHIP_OVERLAP"
              ? u("membershipOverlap")
              : code === "HISTORY_PROTECTED"
                ? u("historyProtected")
                : code === "MEDIA_IN_USE"
                  ? u("mediaInUse")
                  : code === "EVENT_SCORE_CONFLICT"
                    ? u("eventConflict")
                    : code === "VALIDATION_ERROR"
                      ? `${u("validationError")}${body.error?.fields?.length ? " · " + body.error.fields.map((f: { path: string }) => f.path).join(", ") : ""}`
                      : code === "CONFLICT"
                        ? u("conflict")
                        : res.status === 403
                          ? u("forbidden")
                          : code === "INVALID_UPLOAD" || res.status === 413
                            ? u("invalidUpload")
                            : res.status === 429
                              ? u("rateLimited")
                              : u("error"),
          String(code || ""),
        );
      }
      return body;
    },
    [u],
  );
  const load = useCallback(async () => {
    if (!user) return;
    const sequence = ++loadSequence.current;
    setBusy(true);
    try {
      if (!csrf.current) {
        const response = await api("auth/csrf");
        if (sequence !== loadSequence.current) return;
        csrf.current = response.csrfToken;
      }
      if (entity === "dashboard") {
        const result = await api("admin/dashboard");
        if (sequence !== loadSequence.current) return;
        setDashboard(result);
      } else if (entity === "settings") {
        const result = await api("admin/settings");
        if (sequence !== loadSequence.current) return;
        setVersion(result?.version);
        setDirty(false);
        const next = result
          ? {
              sections: result.sections,
              leagueId: result.leagueId,
              externalSeason: result.externalSeason,
              timezone: result.timezone,
            }
          : {
              sections: [],
              leagueId: null,
              externalSeason: null,
              timezone: "Asia/Almaty",
            };
        baseDraft.current = next;
        setDraft(next);
      } else {
        const response = await api(
          `admin/${entity}?${new URLSearchParams({ page: String(page), limit: "20", q: search, status: statusFilter, sort, direction, ...relationFilters })}`,
        );
        if (sequence !== loadSequence.current) return;
        setRows(response.items);
        setTotal(response.total);
      }
    } catch (e) {
      if (sequence === loadSequence.current) setMessage((e as Error).message);
    } finally {
      if (sequence === loadSequence.current) setBusy(false);
    }
  }, [
    user,
    entity,
    page,
    search,
    statusFilter,
    sort,
    direction,
    relationFilters,
    api,
  ]);
  useEffect(() => {
    void load();
    return () => {
      loadSequence.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!user || ["settings", "dashboard", "audit", "media"].includes(entity))
      return;
    let cancelled = false;
    const wanted = [
      ...new Set([
        ...(entityFields[entity] || [])
          .filter((f) => f.type === "relation")
          .map((f) => f.entity!),
        ...(["players", "matches", "memberships", "player-seasons"].includes(
          entity,
        )
          ? ["seasons"]
          : []),
      ]),
    ];
    async function choices(name: string) {
      const first = await api(`admin/${name}?limit=100`);
      const rows = first.items as Row[];
      for (let page = 2; (page - 1) * 100 < first.total; page++) {
        if (cancelled) break;
        rows.push(...(await api(`admin/${name}?limit=100&page=${page}`)).items);
      }
      return [name, rows] as const;
    }
    Promise.all(wanted.map(choices))
      .then((result) => {
        if (!cancelled) setRelations(Object.fromEntries(result));
      })
      .catch((e) => {
        if (!cancelled) setMessage(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [!!draft, entity, user, api]);
  function change(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }
  function begin(row?: Row) {
    if (busy) return;
    const next = row
      ? editable(entity, row)
      : {
          ...blank(entity),
          ...Object.fromEntries(
            Object.entries(relationFilters).filter(([key]) =>
              (entityFields[entity] || []).some((f) => f.key === key),
            ),
          ),
        };
    baseDraft.current = next;
    setDraft(next);
    setConflict(false);
    setVersion(row?.version as number | undefined);
    submissionKey.current = crypto.randomUUID();
    setDirty(false);
    setEditingId(row ? String(row.id) : undefined);
    setMessage("");
    setPreview(false);
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (form && !form.contains(document.activeElement))
        form.querySelector<HTMLInputElement>("input")?.focus();
    });
  }
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api("auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      csrf.current = result.csrfToken;
      setUser(result.user);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    const data = { ...draft };
    if (entity === "users" && !data.password) delete data.password;
    if (entity === "news")
      data.translations = (data.translations as Row[]).filter(
        (t) => t.locale === "kk" || t.title || t.body || t.excerpt,
      );
    for (const f of entityFields[entity] || [])
      if (
        (f.nullable || ["photo", "cover", "poster", "logo"].includes(f.key)) &&
        data[f.key] === ""
      )
        data[f.key] = null;
    try {
      await api(`admin/${entity}${editingId ? `/${editingId}` : ""}`, {
        method: entity === "settings" || editingId ? "PUT" : "POST",
        body: JSON.stringify(data),
        headers: {
          ...(version ? { "If-Match": String(version) } : {}),
          "Idempotency-Key": submissionKey.current,
        },
      });
      setDirty(false);
      setConflict(false);
      setMessage(u("saved"));
      if (entity !== "settings") setDraft(null);
      await load();
    } catch (e) {
      if (
        e instanceof AdminApiError &&
        ["EDIT_CONFLICT", "VERSION_REQUIRED"].includes(e.code)
      )
        setConflict(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshVersion() {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const record = await api(
        `admin/${entity}${editingId ? `/${editingId}` : ""}`,
      );
      const remote =
        entity === "settings"
          ? {
              sections: record.sections,
              leagueId: record.leagueId,
              externalSeason: record.externalSeason,
              timezone: record.timezone,
            }
          : editable(entity, record);
      const { merged, conflicts } = rebaseDraft(
        baseDraft.current,
        draft,
        remote,
      );
      if (
        conflicts.length &&
        !(await ask(
          `${u("overlappingChanges")} ${conflicts.map(label).join(", ")}. ${u("keepLocalChanges")}`,
        ))
      )
        return;
      baseDraft.current = remote;
      setDraft(merged);
      setVersion(record.version);
      setConflict(false);
      setDirty(true);
      setMessage(u("versionRefreshed"));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: Row) {
    if (busy) return;
    if (
      !(await ask(
        entity === "academy-inquiries"
          ? u("purgeInquiryConfirm")
          : entity === "media"
            ? u("deleteConfirm")
            : u("archiveConfirm"),
      ))
    ) {
      setMessage(u("cancelledAction"));
      return;
    }
    setBusy(true);
    try {
      await api(`admin/${entity}/${row.id}`, {
        method: "DELETE",
        headers: { "If-Match": String(row.version) },
      });
      setMessage(u("saved"));
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage(u("invalidUpload"));
      return;
    }
    setBusy(true);
    const data = new FormData();
    data.set("file", file);
    try {
      const asset = await api("admin/media/upload", {
        method: "POST",
        body: data,
      });
      if (entity === "media") await load();
      else
        change(
          entity === "news"
            ? "cover"
            : entity === "gallery"
              ? "url"
              : ["teams", "sponsors"].includes(entity)
                ? "logo"
                : "photo",
          asset.url,
        );
      setMessage(u("saved"));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const display = (row: Row) =>
    localized(
      row.names ||
        row.title ||
        (row.player as Row)?.names ||
        ((row.playerSeason as Row)?.player as Row)?.names,
      locale,
    ) ||
    String(
      (row.translations as Row[])?.find((t) => t.locale === locale)?.title ||
        (row.translations as Row[])?.[0]?.title ||
        row.guardianName ||
        row.email ||
        row.slug ||
        row.name ||
        row.kickoff ||
        row.playerId ||
        row.playerSeasonId ||
        row.id,
    );
  function field(f: Field) {
    if (!draft) return null;
    const value = draft[f.key];
    const inputId = `field-${f.key}`;
    if (f.type === "images")
      return (
        <label key={f.key}>
          {label(f.key)}
          <textarea
            value={((value || []) as string[]).join("\n")}
            onChange={(e) =>
              change(f.key, e.target.value.split("\n").filter(Boolean))
            }
          />
        </label>
      );
    if (f.type === "password")
      return (
        <label key={f.key}>
          {label(f.key)}
          <input
            type="password"
            autoComplete="new-password"
            minLength={16}
            maxLength={128}
            required={!editingId}
            value={String(value || "")}
            onChange={(e) => change(f.key, e.target.value)}
          />
          <small>{u("passwordHint")}</small>
        </label>
      );
    if (f.type === "localized") {
      const object = (value || { kk: "" }) as Record<string, string>;
      return (
        <label key={f.key} htmlFor={inputId}>
          {label(f.key)} ({tab.toUpperCase()})
          {["biography", "description", "stadium"].includes(f.key) ? (
            <textarea
              id={inputId}
              value={object[tab] || ""}
              maxLength={12000}
              onChange={(e) =>
                change(f.key, { ...object, [tab]: e.target.value })
              }
              required={f.required && tab === "kk"}
            />
          ) : (
            <input
              id={inputId}
              value={object[tab] || ""}
              maxLength={200}
              onChange={(e) =>
                change(f.key, { ...object, [tab]: e.target.value })
              }
              required={f.required && tab === "kk"}
            />
          )}
        </label>
      );
    }
    if (f.type === "content")
      return (
        <fieldset key={f.key}>
          <legend>{label(f.key)}</legend>
          {Object.entries(
            (value || {}) as Record<string, Record<string, string>>,
          ).map(([key, text]) => (
            <label key={key}>
              {s.has(key as "title") ? s(key as "title") : label(key)} (
              {tab.toUpperCase()})
              <textarea
                value={text[tab] || ""}
                maxLength={12000}
                onChange={(e) =>
                  change(f.key, {
                    ...(value as Row),
                    [key]: { ...text, [tab]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </fieldset>
      );
    if (f.type === "select" || f.type === "relation")
      return (
        <label key={f.key} htmlFor={inputId}>
          {label(f.key)}
          <select
            id={inputId}
            value={String(value ?? "")}
            required={f.required}
            onChange={(e) => change(f.key, e.target.value || null)}
          >
            <option value="">—</option>
            {f.values
              ?.filter(
                (v) =>
                  entity !== "users" ||
                  user?.role === "SUPER_ADMIN" ||
                  v === "EDITOR",
              )
              .map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            {f.entity &&
              relations[f.entity]?.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {display(row)} {row.seasonId ? `(${row.seasonId})` : ""}
                </option>
              ))}
          </select>
        </label>
      );
    if (f.type === "boolean")
      return (
        <label key={f.key} className="checkbox-field">
          <input
            id={inputId}
            type="checkbox"
            checked={!!value}
            onChange={(e) => change(f.key, e.target.checked)}
          />
          {label(f.key)}
        </label>
      );
    if (
      f.type === "datetime" &&
      (f.key === "birthDate" ||
        (entity === "seasons" && ["startsAt", "endsAt"].includes(f.key)))
    )
      return (
        <label key={f.key} htmlFor={inputId}>
          {label(f.key)}
          <input
            id={inputId}
            type="date"
            required={f.required}
            value={value ? String(value).slice(0, 10) : ""}
            onChange={(e) =>
              change(
                f.key,
                e.target.value ? e.target.value + "T00:00:00.000Z" : null,
              )
            }
          />
        </label>
      );
    if (f.type === "datetime") {
      const dateValue = value ? new Date(String(value)) : null;
      const local =
        dateValue && !isNaN(dateValue.getTime())
          ? new Date(dateValue.getTime() + 5 * 3600000)
              .toISOString()
              .slice(0, 16)
          : "";
      return (
        <label key={f.key} htmlFor={inputId}>
          {label(f.key)}
          <small aria-hidden="true">{u("timeZoneHint")}</small>
          <input
            id={inputId}
            type="datetime-local"
            aria-label={label(f.key)}
            value={local}
            required={f.required}
            onChange={(e) =>
              change(
                f.key,
                e.target.value
                  ? new Date(e.target.value + ":00+05:00").toISOString()
                  : null,
              )
            }
          />
        </label>
      );
    }
    return (
      <label key={f.key} htmlFor={inputId}>
        {label(f.key)}
        <input
          id={inputId}
          type={f.type === "number" ? "number" : "text"}
          min={f.type === "number" ? 0 : undefined}
          maxLength={f.key === "source" ? 1000 : 254}
          step={f.type === "number" ? 1 : undefined}
          required={f.required}
          disabled={f.key === "id" && !!editingId}
          value={String(value ?? "")}
          pattern={f.key === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
          onChange={(e) =>
            change(
              f.key,
              f.type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      </label>
    );
  }
  const allEntities = [
    "dashboard",
    ...Object.keys(entityFields),
    ...(user?.role !== "EDITOR" ? ["audit", "settings"] : []),
  ];
  const adminOnly = [
    "sponsors",
    "academy",
    "academy-inquiries",
    "club",
    "staff",
    "achievements",
    "seasons",
    "teams",
    "competitions",
    "categories",
    "players",
    "matches",
    "player-seasons",
    "statistics",
    "memberships",
    "match-events",
    "match-statistics",
    "users",
  ];
  if (!user)
    return (
      <div className="login-card">
        <h1>{u("admin")}</h1>
        <form onSubmit={login}>
          <label htmlFor="email">
            {u("email")}
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="username"
              required
              maxLength={254}
            />
          </label>
          <label htmlFor="password">
            {u("password")}
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? u("loading") : u("login")}
          </button>
        </form>
        <p role="status">{message}</p>
      </div>
    );
  return (
    <div className="admin-shell">
      <div className="admin-heading">
        <div>
          <p className="section-label">FC ORDABASY</p>
          <h1>{u("workspace")}</h1>
        </div>
        <span className="admin-account">
          {user.email} · {user.role}
        </span>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            if (dirty && !(await ask(u("unsaved")))) return;
            try {
              await api("auth/logout", { method: "POST" });
              setUser(null);
              csrf.current = "";
              setDraft(null);
              setDirty(false);
              setRows([]);
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          {u("logout")}
        </button>
      </div>
      <nav className="admin-nav" aria-label={u("admin")}>
        <p className="admin-brand">{u("clubIdentity")}</p>
        {allEntities
          .filter((e) => user.role !== "EDITOR" || !adminOnly.includes(e))
          .map((e) => (
            <button
              key={e}
              className={`filter-btn${entity === e ? " active" : ""}`}
              aria-pressed={entity === e}
              disabled={busy}
              onClick={() => void navigate(e)}
            >
              {label(e)}
            </button>
          ))}
      </nav>
      <div className="admin-workspace" aria-busy={busy}>
        <h2 className="admin-section-title">{label(entity)}</h2>
        <p
          role="status"
          className={`admin-message${message ? " has-message" : ""}`}
        >
          {message || (busy ? u("loading") : "")}
        </p>
        {entity === "dashboard" ? (
          <div className="stat-cards">
            {Object.entries(dashboard).map(([key, value]) => (
              <button key={key} onClick={() => void navigate(key)}>
                <strong>{value}</strong>
                <span>{label(key)}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {!draft && entity !== "settings" && (
              <>
                <div className="admin-toolbar">
                  <form
                    className="filter-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSearch(q);
                      setPage(1);
                    }}
                  >
                    <label>
                      {u("search")}
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        maxLength={100}
                      />
                    </label>
                    <button className="btn btn-primary">{u("search")}</button>
                  </form>
                  {!["audit", "media", "academy-inquiries", "academy"].includes(
                    entity,
                  ) && (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => begin()}
                    >
                      {u("create")}
                    </button>
                  )}
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void load()}
                  >
                    {u("refresh")}
                  </button>
                  {entity === "media" && (
                    <label className="upload-control">
                      {u("upload")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => void upload(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
                <div className="admin-filters">
                  {([
                    "players",
                    "matches",
                    "memberships",
                    "player-seasons",
                  ].includes(entity)
                    ? [
                        { key: "seasonId", entity: "seasons" },
                        ...(entityFields[entity] || [])
                          .filter((f) =>
                            ["teamId", "competitionId"].includes(f.key),
                          )
                          .map((f) => ({ key: f.key, entity: f.entity! })),
                      ]
                    : []
                  ).map((filter) => (
                    <label key={filter.key}>
                      {label(filter.key)}
                      <select
                        value={relationFilters[filter.key] || ""}
                        onChange={(e) => {
                          setRelationFilters((current) => {
                            const next = { ...current };
                            if (e.target.value)
                              next[filter.key] = e.target.value;
                            else delete next[filter.key];
                            return next;
                          });
                          setPage(1);
                        }}
                      >
                        <option value="">
                          {filter.key === "seasonId"
                            ? u("allSeasons")
                            : s("filterAll")}
                        </option>
                        {relations[filter.entity]?.map((row) => (
                          <option key={String(row.id)} value={String(row.id)}>
                            {display(row)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}

                  {["players", "matches", "news", "gallery", "staff"].includes(
                    entity,
                  ) && (
                    <label>
                      {u("status")}
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">{u("allStatuses")}</option>
                        {["DRAFT", "PUBLISHED", "ARCHIVED"].map((v) => (
                          <option key={v} value={v}>
                            {label(v)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {entity !== "audit" && entity !== "media" && (
                    <>
                      <label>
                        {u("sort")}
                        <select
                          value={sort}
                          onChange={(e) => {
                            setSort(e.target.value);
                            setPage(1);
                          }}
                        >
                          {[
                            "id",
                            ...(entityFields[entity] || [])
                              .filter((f) =>
                                [
                                  "slug",
                                  "name",
                                  "kickoff",
                                  "publishedAt",
                                  "startsAt",
                                ].includes(f.key),
                              )
                              .map((f) => f.key),
                          ].map((v) => (
                            <option key={v} value={v}>
                              {label(v)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {u("sort")}
                        <select
                          value={direction}
                          onChange={(e) => setDirection(e.target.value)}
                        >
                          <option value="asc">{u("ascending")}</option>
                          <option value="desc">{u("descending")}</option>
                        </select>
                      </label>
                    </>
                  )}
                  <span>
                    {total} {u("records")}
                  </span>
                </div>
                {entity === "media" && (
                  <div className="admin-media-grid">
                    {rows.map((asset) => (
                      <article key={String(asset.id)}>
                        <img
                          src={String(
                            (asset.variants as Row)?.thumbnail || asset.url,
                          )}
                          alt={localized(asset.alt, locale)}
                          loading="lazy"
                        />
                        <p>
                          {asset.width as number} × {asset.height as number} ·{" "}
                          {Math.ceil(Number(asset.size) / 1024)} KB
                        </p>
                        <code>{String(asset.url)}</code>
                        <button
                          className="text-action"
                          disabled={busy}
                          onClick={() => begin(asset)}
                        >
                          {u("edit")}
                        </button>
                        {user.role !== "EDITOR" && (
                          <button
                            className="text-action danger"
                            onClick={() => void remove(asset)}
                          >
                            {u("delete")}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                <div className="table-scroll">
                  <table className="admin-table" hidden={entity === "media"}>
                    <thead>
                      <tr>
                        <th>{entity === "audit" ? u("actor") : u("name")}</th>
                        <th>
                          {entity === "audit" ? u("action") : u("status")}
                        </th>
                        <th>{entity === "audit" ? u("changes") : u("edit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={String(row.id)}>
                          <th>
                            {entity === "audit" ? (
                              String(row.actor)
                            ) : (
                              <>
                                {row.photo || row.cover ? (
                                  <img
                                    className="admin-avatar"
                                    src={String(row.photo || row.cover)}
                                    alt=""
                                    loading="lazy"
                                  />
                                ) : null}
                                {display(row)}
                                {entity === "academy-inquiries" && (
                                  <small className="admin-row-detail">
                                    {String(row.contact || "—")}
                                    <br />
                                    {String(row.ageGroup || "")}
                                    <br />
                                    {String(row.message || "—")}
                                    <br />
                                    {String(row.createdAt || "").slice(0, 10)}
                                  </small>
                                )}
                                {entity === "memberships" && (
                                  <small className="admin-row-detail">
                                    {localized(
                                      (row.team as Row)?.names,
                                      locale,
                                    )}{" "}
                                    · #{String(row.number ?? "—")}
                                    <br />
                                    {String(row.startsAt).slice(0, 10)} →{" "}
                                    {row.endsAt
                                      ? String(row.endsAt).slice(0, 10)
                                      : label("ACTIVE")}
                                  </small>
                                )}
                                {entity === "matches" && (
                                  <small className="admin-row-detail">
                                    {localized(
                                      (row.homeTeam as Row)?.names,
                                      locale,
                                    )}{" "}
                                    —{" "}
                                    {localized(
                                      (row.awayTeam as Row)?.names,
                                      locale,
                                    )}{" "}
                                    · {String(row.homeScore ?? "—")}:
                                    {String(row.awayScore ?? "—")}
                                  </small>
                                )}
                                {entity === "audit" ? null : (
                                  <small className="record-id">
                                    {String(row.id)}
                                  </small>
                                )}
                              </>
                            )}
                          </th>
                          <td>
                            <span className="status-badge">
                              {entity === "audit"
                                ? String(row.action)
                                : row.archivedAt
                                  ? label("ARCHIVED")
                                  : row.status
                                    ? label(String(row.status))
                                    : row.rosterStatus
                                      ? label(String(row.rosterStatus))
                                      : row.role
                                        ? String(row.role)
                                        : row.state
                                          ? label(String(row.state))
                                          : row.cancelled
                                            ? label("cancelled")
                                            : "—"}
                            </span>
                            {entity === "users" && (
                              <small>
                                {row.active
                                  ? label("active")
                                  : label("ARCHIVED")}
                              </small>
                            )}
                          </td>
                          <td>
                            {entity === "audit" ? (
                              <>
                                <p>
                                  {label(String(row.entity))} ·{" "}
                                  {String(row.entityId)}
                                </p>
                                <time>{String(row.createdAt)}</time>
                                <details>
                                  <summary>
                                    {u("changes")} · {String(row.result)}
                                  </summary>
                                  <pre>
                                    {JSON.stringify(row.changes, null, 2)}
                                  </pre>
                                </details>
                              </>
                            ) : (
                              <>
                                <button
                                  className="text-action"
                                  disabled={busy}
                                  onClick={() => begin(row)}
                                >
                                  {u("edit")}
                                </button>
                                {user.role !== "EDITOR" &&
                                  [
                                    "players",
                                    "matches",
                                    "news",
                                    "gallery",
                                    "staff",
                                    "sponsors",
                                    "achievements",
                                    "academy-inquiries",
                                  ].includes(entity) && (
                                    <button
                                      className="text-action danger"
                                      disabled={busy}
                                      onClick={() => remove(row)}
                                    >
                                      {entity === "academy-inquiries"
                                        ? u("purgeInquiry")
                                        : u("archiveAction")}
                                    </button>
                                  )}
                                {row.slug &&
                                ["players", "news"].includes(entity) ? (
                                  <Link
                                    className="text-action"
                                    href={`/${locale}/${entity === "players" ? "players" : "news"}/${row.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {u("preview")}
                                  </Link>
                                ) : null}
                                {entity === "players" && (
                                  <button
                                    className="text-action"
                                    disabled={busy}
                                    onClick={() =>
                                      void navigate("memberships", {
                                        playerId: String(row.id),
                                      })
                                    }
                                  >
                                    {u("careerHistory")}
                                  </button>
                                )}
                                {entity === "matches" && (
                                  <>
                                    <button
                                      className="text-action"
                                      disabled={busy}
                                      onClick={() =>
                                        void navigate("match-events", {
                                          matchId: String(row.id),
                                        })
                                      }
                                    >
                                      {u("match-events")}
                                    </button>
                                    <button
                                      className="text-action"
                                      disabled={busy}
                                      onClick={() =>
                                        void navigate("match-statistics", {
                                          matchId: String(row.id),
                                        })
                                      }
                                    >
                                      {u("match-statistics")}
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!rows.length && <p className="empty-state">{u("empty")}</p>}
                <div className="pagination">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {u("previous")}
                  </button>
                  <span>
                    {u("page")} {page} / {Math.max(1, Math.ceil(total / 20))}
                  </span>
                  <button
                    disabled={page * 20 >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {u("next")}
                  </button>
                </div>
              </>
            )}
            {draft && (
              <form ref={formRef} className="admin-form" onSubmit={save}>
                <fieldset
                  className="admin-form-body"
                  disabled={busy}
                  aria-label={label(entity)}
                >
                  <div className="admin-toolbar">
                    <h2>{editingId ? u("edit") : label(entity)}</h2>
                    {dirty && (
                      <span className="status-badge">● {u("save")}</span>
                    )}
                    <div className="language-switcher">
                      {locales.map((l) => (
                        <button
                          type="button"
                          className={`lang-btn${tab === l ? " active" : ""}`}
                          key={l}
                          aria-pressed={tab === l}
                          onClick={() => setTab(l)}
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="admin-help">{u("sourceHint")}</p>
                  {conflict && (
                    <div className="source-notice" role="alert">
                      <p>{u("editConflict")}</p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void refreshVersion()}
                      >
                        {u("refreshVersion")}
                      </button>
                    </div>
                  )}
                  {["statistics", "match-statistics"].includes(entity) && (
                    <p className="source-notice">{u("statisticsHint")}</p>
                  )}
                  {entity === "settings" ? (
                    <>
                      <fieldset>
                        <legend>{u("sections")}</legend>
                        {[
                          "hero",
                          "club-stats",
                          "about",
                          "matches",
                          "team",
                          "achievements",
                          "news",
                          "gallery",
                          "contact",
                        ].map((section) => (
                          <label className="checkbox-field" key={section}>
                            <input
                              type="checkbox"
                              checked={(draft.sections as string[]).includes(
                                section,
                              )}
                              onChange={(e) =>
                                change(
                                  "sections",
                                  e.target.checked
                                    ? [...(draft.sections as string[]), section]
                                    : (draft.sections as string[]).filter(
                                        (v) => v !== section,
                                      ),
                                )
                              }
                            />
                            {
                              (
                                {
                                  hero: s("home"),
                                  "club-stats": u("stats"),
                                  about: s("about"),
                                  matches: s("matches"),
                                  team: s("team"),
                                  achievements: u("achievements"),
                                  news: s("news"),
                                  gallery: s("gallery"),
                                  contact: s("contactTitle"),
                                } as Record<string, string>
                              )[section]
                            }
                          </label>
                        ))}
                      </fieldset>
                      {(
                        ["leagueId", "externalSeason", "timezone"] as const
                      ).map((key) => (
                        <label key={key}>
                          {u(key)}
                          <input
                            value={String(draft[key] ?? "")}
                            onChange={(e) =>
                              change(key, e.target.value || null)
                            }
                            required={key === "timezone"}
                            maxLength={80}
                          />
                        </label>
                      ))}
                    </>
                  ) : (
                    (entityFields[entity] || []).map(field)
                  )}
                  {entity === "news" && (
                    <fieldset>
                      <legend>
                        {u("news")} ({tab.toUpperCase()})
                      </legend>
                      {(["title", "excerpt", "body"] as const).map((key) => {
                        const translations = (draft.translations ||
                          []) as Row[];
                        const current = translations.find(
                          (t) => t.locale === tab,
                        ) || { locale: tab, title: "", excerpt: "", body: "" };
                        return (
                          <label key={key}>
                            {u(key)}
                            {key === "title" ? (
                              <input
                                maxLength={200}
                                required={tab === "kk"}
                                value={String(current[key] || "")}
                                onChange={(e) =>
                                  change("translations", [
                                    ...translations.filter(
                                      (t) => t.locale !== tab,
                                    ),
                                    { ...current, [key]: e.target.value },
                                  ])
                                }
                              />
                            ) : (
                              <textarea
                                rows={key === "body" ? 12 : 3}
                                maxLength={key === "body" ? 50000 : 500}
                                required={tab === "kk"}
                                value={String(current[key] || "")}
                                onChange={(e) =>
                                  change("translations", [
                                    ...translations.filter(
                                      (t) => t.locale !== tab,
                                    ),
                                    { ...current, [key]: e.target.value },
                                  ])
                                }
                              />
                            )}
                          </label>
                        );
                      })}
                    </fieldset>
                  )}
                  {String(
                    draft.photo || draft.cover || draft.url || draft.logo || "",
                  ).startsWith("/") && (
                    <img
                      className="admin-photo-preview"
                      src={String(
                        draft.photo || draft.cover || draft.url || draft.logo,
                      )}
                      alt={u("preview")}
                    />
                  )}
                  {[
                    "players",
                    "news",
                    "gallery",
                    "staff",
                    "teams",
                    "sponsors",
                  ].includes(entity) && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={async () => {
                        try {
                          setAssets((await api("admin/media?limit=100")).items);
                          setMediaPicker(true);
                        } catch (e) {
                          setMessage((e as Error).message);
                        }
                      }}
                    >
                      {u("chooseMedia")}
                    </button>
                  )}
                  {[
                    "players",
                    "news",
                    "gallery",
                    "staff",
                    "teams",
                    "sponsors",
                  ].includes(entity) && (
                    <label>
                      {u("upload")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => void upload(e.target.files?.[0])}
                      />
                    </label>
                  )}
                  {entity === "news" && (
                    <>
                      <button
                        type="button"
                        className="text-action"
                        onClick={() => setPreview((v) => !v)}
                      >
                        {u("preview")}
                      </button>
                      {preview && (
                        <article className="preview-panel">
                          {((draft.translations || []) as Row[])
                            .filter((t) => t.locale === tab)
                            .map((t) => (
                              <div key={String(t.locale)}>
                                <h2>{String(t.title)}</h2>
                                <p>{String(t.excerpt)}</p>
                                <div className="article-body">
                                  {String(t.body)}
                                </div>
                              </div>
                            ))}
                        </article>
                      )}
                    </>
                  )}
                  <div className="admin-toolbar">
                    <button className="btn btn-primary" disabled={busy}>
                      {u("save")}
                    </button>
                    {entity !== "settings" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={async () => {
                          if (dirty && !(await ask(u("unsaved")))) return;
                          setDraft(null);
                          setDirty(false);
                          setMessage(u("cancelledAction"));
                        }}
                      >
                        {u("cancel")}
                      </button>
                    )}
                  </div>
                </fieldset>
              </form>
            )}
          </>
        )}
      </div>
      {confirmRequest && (
        <ConfirmDialog
          message={confirmRequest.message}
          confirm={u("confirm")}
          cancel={u("cancel")}
          onClose={(value) => {
            confirmRequest.resolve(value);
            setConfirmRequest(null);
          }}
        />
      )}
      {mediaPicker && (
        <MediaPicker
          initial={assets}
          fetchPage={(page) => api(`admin/media?page=${page}`)}
          onClose={() => setMediaPicker(false)}
          onSelect={(asset) => {
            change(
              entity === "news"
                ? "cover"
                : entity === "gallery"
                  ? "url"
                  : ["teams", "sponsors"].includes(entity)
                    ? "logo"
                    : "photo",
              asset.url,
            );
            setMediaPicker(false);
          }}
        />
      )}
    </div>
  );
}
