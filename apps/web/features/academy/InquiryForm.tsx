"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Locale } from "../../lib/i18n/config";
import Link from "next/link";
export function InquiryForm({
  locale,
  labels: t,
}: {
  locale: Locale;
  labels: Record<string, string>;
}) {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/v1/academy/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((v) => {
        if (live) setToken(v.token);
      })
      .catch(() => {
        if (live) setMessage(t.inquiriesUnavailable);
      });
    return () => {
      live = false;
    };
  }, [t.inquiriesUnavailable]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/academy/inquiries", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({
          guardianName: data.get("guardianName"),
          contact: data.get("contact"),
          ageGroup: data.get("ageGroup") || undefined,
          message: data.get("message"),
          consent: data.get("consent") === "on",
          website: data.get("website") || "",
          locale,
        }),
      });
      if (!res.ok) {
        setMessage(
          res.status === 429
            ? t.formRate
            : res.status === 400
              ? t.formInvalid
              : res.status === 403
                ? t.formExpired
                : t.formError,
        );
        return;
      }
      setDone(true);
      setMessage(t.success);
      form.reset();
    } catch {
      setMessage(t.formError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="inquiry-panel">
      <h2>{t.contact}</h2>
      <p>{t.inquiryHelp}</p>
      {!done && (
        <form onSubmit={submit} className="inquiry-form">
          <label>
            {t.guardianName}
            <input
              autoComplete="name"
              name="guardianName"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            {t.guardianContact}
            <input
              autoComplete="email"
              name="contact"
              required
              maxLength={160}
            />
          </label>
          <label>
            {t.ageGroup}
            <input name="ageGroup" maxLength={80} />
          </label>
          <label>
            {t.message}
            <textarea name="message" required minLength={10} maxLength={2000} />
          </label>
          <div className="inquiry-honeypot" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="inquiry-consent">
            <input type="checkbox" name="consent" required />
            <span>
              {t.consent}{" "}
              <Link href={`/${locale}/privacy`} target="_blank">
                {t.privacy}
              </Link>
            </span>
          </label>
          <p className="inquiry-retention">{t.retention}</p>
          <button className="editorial-button" disabled={!token || busy}>
            {busy ? t.sending : t.send}
          </button>
        </form>
      )}
      <p role="status" aria-live="polite" className="form-status">
        {message}
      </p>
    </div>
  );
}
