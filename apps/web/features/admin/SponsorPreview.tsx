"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { SponsorMarquee } from "../sponsors/SponsorMarquee";
import type { Sponsor } from "../../lib/api/types";
type Row = Record<string, unknown>;
export function SponsorPreview({
  fetchPage,
}: {
  fetchPage: (page: number) => Promise<{ items: Row[]; total: number }>;
}) {
  const p = useTranslations("premium"),
    u = useTranslations("ui");
  const [items, setItems] = useState<Sponsor[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    setLoading(true);
    setError("");
    try {
      const logos = new Map<string, Sponsor>();
      let seen = 0,
        page = 1,
        total = 1;
      while (seen < total) {
        const result = await fetchPage(page++);
        total = result.total;
        seen += result.items.length;
        for (const row of result.items)
          if (
            typeof row.logo === "string" &&
            row.logo &&
            row.status !== "ARCHIVED" &&
            !logos.has(row.logo)
          )
            logos.set(row.logo, {
              id: String(row.id),
              name: String(row.name),
              logo: row.logo,
              websiteUrl: null,
              description: { kk: "" },
            });
        if (!result.items.length) break;
      }
      setItems([...logos.values()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="admin-sponsor-preview">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={loading}
        aria-expanded={items !== null}
        onClick={() => (items ? setItems(null) : void open())}
      >
        {loading ? u("loading") : p("sponsorPreview")}
      </button>
      {error && <p role="alert">{error}</p>}
      {items && (
        <div className="sponsor-preview-panel">
          <h3>{p("sponsorPreview")}</h3>
          <p>{p("sponsorPreviewNotice")}</p>
          {items.length ? (
            <SponsorMarquee
              items={items}
              labels={{
                partners: p("partners"),
                pause: p("pauseSponsors"),
                resume: p("resumeSponsors"),
              }}
            />
          ) : (
            <p>{u("empty")}</p>
          )}
        </div>
      )}
    </section>
  );
}
