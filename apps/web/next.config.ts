import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");
const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000/api/v1";
export default withNextIntl({
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd() + "/../..",
  async redirects() {
    return ["index", "about", "team", "matches", "news"].map((name) => ({
      source: `/${name}.html`,
      destination: `/kk${name === "index" ? "" : `/${name}`}`,
      permanent: true,
    }));
  },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${api}/:path*` },
      {
        source: "/uploads/:path*",
        destination: `${api.replace(/\/api\/v1\/?$/, "")}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
});
