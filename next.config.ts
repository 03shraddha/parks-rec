import type { NextConfig } from "next";

// When EXPORT=true (set in GitHub Actions), build as a fully static site for GitHub Pages.
// Locally and on Vercel, the app runs as a normal Next.js server with API routes.
const isExport = process.env.EXPORT === "true";

const nextConfig: NextConfig = {
  output: isExport ? "export" : undefined,
  basePath: isExport ? "/parks-rec" : "",
  images: { unoptimized: true },
  turbopack: {},
};

export default nextConfig;
