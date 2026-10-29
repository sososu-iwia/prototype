import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAcademy } from "../../lib/api/server";
import { localized, type Locale } from "../../lib/i18n/config";
import { Media } from "../../components/ui/Media";
import { SectionTitle } from "../../components/editorial/SectionTitle";
import { InquiryForm } from "./InquiryForm";
import { Icon } from "../../components/editorial/Icon";
import { Offline } from "../../components/ui/State";
export async function AcademyPage({
  locale,
  admission = false,
}: {
  locale: Locale;
  admission?: boolean;
}) {
  const { data, offline } = await getAcademy(),
    p = await getTranslations("premium");
  const content = (key: string) => localized(data.content?.[key], locale);
  return (
    <main id="content" className="premium">
      <section className="academy-page-hero">
        <Media src="/media/news3-960.webp" alt="" priority sizes="100vw" />
        <div className="container">
          <p className="eyebrow">FC ORDABASY · ACADEMY</p>
          <h1>{admission ? p("admission") : p("academyHeadline")}</h1>
          <p>{content("introduction") || p("academyIntro")}</p>
          {!admission && (
            <Link
              className="editorial-button"
              href={`/${locale}/academy/admission`}
              prefetch={false}
            >
              {p("admission")}
              <Icon name="arrow" />
            </Link>
          )}
          <span className="academy-photo-label">{p("photoArchive")}</span>
        </div>
      </section>
      <div className="container">
        <Offline show={offline} />
      </div>
      <section className="editorial-section">
        <div className="container academy-layout">
          <div>
            <p className="eyebrow">ORDABASY ACADEMY</p>
            <h2 className="academy-state">
              {p(
                data.admissionState === "OPEN"
                  ? "admissionOpen"
                  : data.admissionState === "CLOSED"
                    ? "admissionClosed"
                    : "admissionUnconfirmed",
              )}
            </h2>
            <p className="academy-lead">
              {data.published
                ? content(admission ? "requirements" : "philosophy") ||
                  p("noApprovedContent")
                : p("academyPending")}
            </p>
            <div className="academy-info-grid">
              {(admission
                ? ["requirements", "trials", "schedule", "nextSteps"]
                : [
                    "philosophy",
                    "ageGroups",
                    "coaches",
                    "facilities",
                    "programs",
                  ]
              ).map((key, i) => (
                <article
                  key={key}
                  id={key === "ageGroups" ? "age-groups" : key}
                >
                  <span>0{i + 1}</span>
                  <h3>{p(key as "philosophy")}</h3>
                  <p>{content(key) || p("noApprovedContent")}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="academy-aside">
            <Icon name="shield" />
            <h2>{p("admission")}</h2>
            <p>{p("inquiryHelp")}</p>
            <Link
              className="editorial-button"
              href={admission ? "#contact" : `/${locale}/academy/admission`}
            >
              {admission ? p("contact") : p("admission")}
              <Icon name="arrow" />
            </Link>
          </aside>
        </div>
      </section>
      <section className="editorial-section editorial-news" id="faq">
        <div className="container">
          <SectionTitle label="ORDABASY ACADEMY" title={p("faq")} />
          {content("faq") ? (
            <p className="academy-rich-text">{content("faq")}</p>
          ) : (
            <details className="academy-faq">
              <summary>{p("admission")}</summary>
              <p>{p("academyPending")}</p>
            </details>
          )}
        </div>
      </section>
      <section className="editorial-section" id="contact">
        <div className="container">
          <SectionTitle label="ORDABASY ACADEMY" title={p("contact")} />
          {data.contactEmail || data.contactPhone ? (
            <div className="academy-contacts">
              {data.contactEmail && (
                <a href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a>
              )}
              {data.contactPhone && (
                <a href={`tel:${data.contactPhone.replace(/[^+0-9]/g, "")}`}>
                  {data.contactPhone}
                </a>
              )}
            </div>
          ) : (
            <p>{p("contactPending")}</p>
          )}
          {admission && data.inquiriesEnabled ? (
            <>
              <div className="privacy-notice">
                <h3>{p("privacy")}</h3>
                <p>{content("privacyNotice")}</p>
                <p>{p("privacySummary")}</p>
              </div>
              <InquiryForm
                locale={locale}
                labels={Object.fromEntries(
                  [
                    "contact",
                    "guardianName",
                    "guardianContact",
                    "ageGroup",
                    "message",
                    "consent",
                    "send",
                    "sending",
                    "success",
                    "formError",
                    "privacy",
                    "inquiriesUnavailable",
                    "inquiryHelp",
                    "retention",
                    "formInvalid",
                    "formRate",
                    "formExpired",
                  ].map((k) => [k, p(k as "contact")]),
                )}
              />
            </>
          ) : (
            admission && (
              <div className="editorial-empty">
                <p>{p("inquiriesUnavailable")}</p>
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}
