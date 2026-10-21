import type { NextConfig } from "next";

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];
// Owner pages handle customer data and must not be framed by other sites
// (clickjacking). The menu preview is framed by the owner studio, so the same
// origin stays allowed everywhere.
const noFraming = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];
const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [...baseHeaders, ...noFraming] },
      { source: "/admin/:path*", headers: noIndex },
      { source: "/admin", headers: noIndex },
      { source: "/api/:path*", headers: noIndex },
      { source: "/menu/preview", headers: noIndex },
    ];
  },
};

export default nextConfig;
