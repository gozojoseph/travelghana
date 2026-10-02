import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Shared packages ship as TypeScript source — Next compiles them.
  transpilePackages: [
    "@travelghana/ui",
    "@travelghana/types",
    "@travelghana/validation",
  ],
};

export default nextConfig;
