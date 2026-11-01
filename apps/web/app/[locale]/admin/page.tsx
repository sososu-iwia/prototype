import "../../../styles/admin.css";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "../../../lib/i18n/config";
import { cookies } from "next/headers";
import { Admin } from "../../../features/admin/Admin";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui" });
  return {
    title: `${t("admin")} | FC Ordabasy`,
    robots: { index: false, follow: false },
  };
}
export default async function AdminPage() {
  let user = null;
  try {
    const store = await cookies();
    const token = store.get("ordabasy_session")?.value;
    if (token) {
      const res = await fetch(
        `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000/api/v1"}/auth/me`,
        {
          headers: { cookie: `ordabasy_session=${encodeURIComponent(token)}` },
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        },
      );
      if (res.ok) user = await res.json();
    }
  } catch {}
  return (
    <main id="content" className="detail-page admin-page">
      <div className="container">
        <NextIntlClientProvider messages={await getMessages()}>
          <Admin initialUser={user} />
        </NextIntlClientProvider>
      </div>
    </main>
  );
}
