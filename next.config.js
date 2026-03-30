require("dotenv").config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // React Compiler is now stable in Next.js 16, moved out of experimental
  reactCompiler: true,
  // We rely on "use cache" / cacheTag across the app. Make the cache runtime explicit.
  cacheComponents: true,
};

module.exports = nextConfig;
