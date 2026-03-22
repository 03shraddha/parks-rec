import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config silences the webpack-vs-turbopack warning in Next.js 16
  turbopack: {},
};

export default nextConfig;
