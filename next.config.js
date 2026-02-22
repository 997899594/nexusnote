require("dotenv").config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // React Compiler is now stable in Next.js 16, moved out of experimental
  reactCompiler: true,
};

module.exports = nextConfig;
