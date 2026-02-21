/** @type {import('next').NextConfig} */
const path = require("node:path");
// Load .env from monorepo root
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch (e) {
  console.warn("Failed to load root .env file", e);
}

const nextConfig = {
  // Enable standalone output for Docker
  output: "standalone",

  // Transpile monorepo packages
  transpilePackages: ["@nexusnote/ui", "@nexusnote/db", "@nexusnote/config"],

  // React Compiler - 自动优化 React 组件性能 (2026 最佳实践)
  reactCompiler: true,

  // esbuild native binary for @serwist/turbopack
  serverExternalPackages: ["esbuild", "@esbuild/darwin-arm64", "@esbuild/linux-x64"],

  // Experimental features
  experimental: {
    // Server Actions
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Turbopack config for Next.js 16
  turbopack: {},

  // Headers for security
  async headers() {
    const isDev = process.env.NODE_ENV === "development";

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Service Worker scope
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          // CSP - 开发模式下放宽限制
          {
            key: "Content-Security-Policy",
            value: isDev
              ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:;"
              : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
