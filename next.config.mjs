/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hide the on-screen development indicator (bottom-left badge). Compile and
  // runtime errors are still surfaced by the framework.
  devIndicators: false,
  // Vercel traces only files imported by server code. The SQLite demo database
  // and the per-deployment session secret are read with `fs`, so they must be
  // included explicitly in every server function. See scripts/prepare-vercel.mjs.
  outputFileTracingIncludes: {
    "/*": [
      "./prisma/seed.db",
      "./.vercel-session-secret",
      "./node_modules/.prisma/client/**/*",
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
