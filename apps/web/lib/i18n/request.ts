import { getRequestConfig } from "next-intl/server";
import { isLocale } from "./config";
export default getRequestConfig(async ({ requestLocale }) => {
  const value = await requestLocale;
  const locale = value && isLocale(value) ? value : "kk";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Almaty",
  };
});
