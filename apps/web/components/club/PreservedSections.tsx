// Generated once from the original semantic HTML. No runtime HTML insertion.
import { Media } from "../ui/Media";
import type { Locale, SiteKey } from "../../lib/i18n/config";
type Props = { locale: Locale; t: (key: SiteKey) => string };
export function ClubNumbers({ t }: Props) {
  return (
    <section className="club-stats">
      <div className="container stats-grid">
        <div className="stat-item">
          <h2>{"—"}</h2>
          <p>{t("founded")}</p>
        </div>
        <div className="stat-item">
          <h2>{t("cityName")}</h2>
          <p>{t("city")}</p>
        </div>
        <div className="stat-item">
          <h2>{"—"}</h2>
          <p>{t("trophies")}</p>
        </div>
        <div className="stat-item">
          <h2>{"—"}</h2>
          <p>{t("fans")}</p>
        </div>
      </div>
    </section>
  );
}
export function HomeAbout({ locale, t }: Props) {
  return (
    <section className="about-section">
      <div className="container about-container">
        <div className="about-left">
          <p className="section-label">{t("aboutLabel")}</p>
          <h2>{t("aboutTitle")}</h2>
          <p className="about-text">{t("aboutText")}</p>
          <p className="about-text">{t("aboutTextSecond")}</p>
          <a href={`/${locale}/about`} className="about-link">
            {t("learnMore")}
          </a>
        </div>
        <div className="about-right">
          <div className="about-visual">
            <span className="visual-number">{"20"}</span>
            <span className="visual-number second">{"00"}</span>
            <div className="visual-content">
              <span>{t("since")}</span>
              <h3>{t("footballHistory")}</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
export function ContactSection({ locale, t }: Props) {
  return (
    <section className="contact-section">
      <div className="container contact-box">
        <div className="contact-content">
          <p className="contact-label">{t("contactLabel")}</p>
          <h2>{t("contactTitle")}</h2>
          <p>{t("contactDescription")}</p>
        </div>
        <div className="contact-buttons">
          <a href={`/${locale}/news`} className="contact-btn primary-contact">
            {t("latestNews")}
          </a>
          <a
            href={`/${locale}/matches`}
            className="contact-btn secondary-contact"
          >
            {t("nextMatches")}
          </a>
        </div>
      </div>
    </section>
  );
}
export function AboutHero({ t }: Props) {
  return (
    <section className="about-page-hero">
      <div className="container about-page-hero-content">
        <p className="hero-label">{t("aboutPageLabel")}</p>
        <h1>{t("aboutPageHeroTitle")}</h1>
        <p>{t("aboutPageHeroText")}</p>
      </div>
    </section>
  );
}
export function AboutIntro({ t }: Props) {
  return (
    <section className="about-page-intro">
      <div className="container about-page-intro-grid">
        <div>
          <p className="section-label">{t("clubStoryLabel")}</p>
          <h2>{t("clubStoryTitle")}</h2>
        </div>
        <div className="about-page-intro-text">
          <p>{t("clubStoryTextOne")}</p>
          <p>{t("clubStoryTextTwo")}</p>
        </div>
      </div>
    </section>
  );
}
export function AboutNumbers({ t }: Props) {
  return (
    <section className="about-numbers">
      <div className="container about-numbers-grid">
        <div className="about-number-card">
          <span>{"—"}</span>
          <p>{t("founded")}</p>
        </div>
        <div className="about-number-card">
          <span>{t("cityName")}</span>
          <p>{t("city")}</p>
        </div>
        <div className="about-number-card">
          <span>{"—"}</span>
          <p>{t("fans")}</p>
        </div>
      </div>
    </section>
  );
}
export function AboutTimeline({ t }: Props) {
  return (
    <section className="history-section">
      <div className="container">
        <div className="history-heading">
          <p className="section-label">{t("timelineLabel")}</p>
          <h2>{t("timelineTitle")}</h2>
        </div>
        <div className="timeline">
          <div className="timeline-item">
            <div className="timeline-year">{"—"}</div>
            <div className="timeline-content">
              <h3>{t("timelineOneTitle")}</h3>
              <p>{t("timelineOneText")}</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-year">{"2011"}</div>
            <div className="timeline-content">
              <h3>{t("timelineTwoTitle")}</h3>
              <p>{t("timelineTwoText")}</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-year">{"2023"}</div>
            <div className="timeline-content">
              <h3>{t("timelineThreeTitle")}</h3>
              <p>{t("timelineThreeText")}</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-year">{"NOW"}</div>
            <div className="timeline-content">
              <h3>{t("timelineFourTitle")}</h3>
              <p>{t("timelineFourText")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
export function AboutStadium({ t }: Props) {
  return (
    <section className="stadium-section" id="stadium">
      <div className="container stadium-grid">
        <div className="stadium-photo">
          <Media src="images/news1.jpg" alt={t("galleryTitle")} />
        </div>
        <div className="stadium-content">
          <p className="section-label">{t("stadiumLabel")}</p>
          <h2>{t("stadiumTitle")}</h2>
          <p>{t("stadiumAboutText")}</p>
          <div className="stadium-info">
            <div>
              <strong>{t("cityName")}</strong>
              <span>{t("locationWord")}</span>
            </div>
            <div>
              <strong>{t("ordabasy")}</strong>
              <span>{t("homeTeam")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
export function AboutValues({ t }: Props) {
  return (
    <section className="values-section">
      <div className="container">
        <div className="values-heading">
          <p className="section-label">{t("valuesLabel")}</p>
          <h2>{t("valuesTitle")}</h2>
        </div>
        <div className="values-grid">
          <div className="value-card">
            <span>{"01"}</span>
            <h3>{t("valueOneTitle")}</h3>
            <p>{t("valueOneText")}</p>
          </div>
          <div className="value-card">
            <span>{"02"}</span>
            <h3>{t("valueTwoTitle")}</h3>
            <p>{t("valueTwoText")}</p>
          </div>
          <div className="value-card">
            <span>{"03"}</span>
            <h3>{t("valueThreeTitle")}</h3>
            <p>{t("valueThreeText")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
export function AboutCta({ locale, t }: Props) {
  return (
    <section className="about-cta">
      <div className="container about-cta-box">
        <div>
          <p className="contact-label">{t("aboutCtaLabel")}</p>
          <h2>{t("aboutCtaTitle")}</h2>
        </div>
        <a href={`/${locale}/team`} className="btn btn-primary">
          {t("allPlayers")}
        </a>
      </div>
    </section>
  );
}
