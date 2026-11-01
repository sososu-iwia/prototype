import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "../../lib/i18n/config";
import { Media } from "../../components/ui/Media";
import { Icon } from "../../components/editorial/Icon";
export async function AcademyPromo({ locale }: { locale: Locale }) {
  const p = await getTranslations("premium");
  return (
    <section className="academy-promo">
      <div className="academy-promo-photo">
        <Media
          src="/media/news3-960.webp"
          alt=""
          sizes="(max-width:768px) 100vw, 50vw"
        />
        <span>{p("photoArchive")}</span>
      </div>
      <div className="academy-promo-copy">
        <p className="eyebrow">ORDABASY ACADEMY</p>
        <h2>{p("academyHeadline")}</h2>
        <p>{p("academyIntro")}</p>
        <Link
          href={`/${locale}/academy/admission`}
          prefetch={false}
          className="editorial-button"
        >
          {p("admission")}
          <Icon name="arrow" />
        </Link>
      </div>
    </section>
  );
}
