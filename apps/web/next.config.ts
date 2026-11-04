import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Shared packages ship as TypeScript source — Next compiles them.
  transpilePackages: [
    "@travelghana/ui",
    "@travelghana/types",
    "@travelghana/validation",
  ],
  // Same-origin API proxy (dev previews over tunnels): the browser talks to
  // the web origin only, and the Next server forwards /api to the local
  // NestJS API. Session cookies stay first-party on whatever host serves
  // the page (localhost, LAN IP, dev tunnel) and the API port is never
  // exposed directly. Check: localhost:3000/api/health must return the
  // API's health JSON through this proxy.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
