import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  cacheComponents: true,
  output: "standalone",
  serverExternalPackages: ["bullmq"],
};

export default nextConfig;
