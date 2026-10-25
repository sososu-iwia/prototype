// Both Next's build-time rewrites and server-side reads use this resolver.
export function apiEndpoint(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL === "1" && !env.API_ORIGIN && !env.API_INTERNAL_URL)
    throw new Error(
      "Configure the backend origin separately for this Vercel environment.",
    );
  const value = env.API_ORIGIN
    ? `${env.API_ORIGIN.replace(/\/$/, "")}/api/v1`
    : env.API_INTERNAL_URL || "http://127.0.0.1:4000/api/v1";
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/$/, "") !== "/api/v1" ||
    ((env.RENDER === "true" || env.VERCEL === "1") && url.protocol !== "https:")
  )
    throw new Error(
      "Configure an HTTP(S) API endpoint ending in /api/v1; hosted deployments require HTTPS.",
    );
  if (env.VERCEL === "1" && !url.hostname.endsWith(".vercel.app"))
    throw new Error(
      "Use the verified Vercel API project hostname for this environment.",
    );
  for (const origin of [
    env.PUBLIC_ORIGIN,
    env.RENDER_EXTERNAL_URL,
    env.VERCEL_URL && `https://${env.VERCEL_URL}`,
  ]) {
    if (origin && new URL(origin).origin === url.origin)
      throw new Error(
        "The API endpoint must not point to the frontend itself.",
      );
  }
  return url.href.replace(/\/$/, "");
}

export function apiFetchTimeout(env: NodeJS.ProcessEnv = process.env) {
  const value = Number(
    env.API_FETCH_TIMEOUT_MS ||
      (env.RENDER === "true" ? 70000 : env.VERCEL === "1" ? 15000 : 3500),
  );
  if (!Number.isInteger(value) || value < 1000 || value > 90000)
    throw new Error("API_FETCH_TIMEOUT_MS must be between 1000 and 90000.");
  return value;
}
