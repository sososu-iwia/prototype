import { Suspense } from "react";
import Loading from "../../../components/ui/Loading";
import { getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "../../../lib/i18n/config";
import { cookies } from "next/headers";
import { Admin } from "../../../features/admin/Admin";
import { apiEndpoint, apiFetchTimeout } from "../../../lib/api/endpoint";
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
export default function AdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminPageContent />
    </Suspense>
  );
}
async function AdminPageContent() {
  let user = null;
  try {
    const store = await cookies();
    const token = store.get("ordabasy_session")?.value;
    if (token) {
      const res = await fetch(`${apiEndpoint()}/auth/me`, {
        headers: { cookie: `ordabasy_session=${encodeURIComponent(token)}` },
        cache: "no-store",
        signal: AbortSignal.timeout(apiFetchTimeout()),
      });
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
