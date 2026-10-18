import { permanentRedirect } from "next/navigation";
export default async function LegacyPlayer({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  permanentRedirect(`/${locale}/players/${encodeURIComponent(slug)}`);
}
