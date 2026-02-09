/** @type {import('next').NextConfig} */
const path = require("path");
// Load .env from monorepo root
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch (e) {
  console.warn("Failed to load root .env file", e);
}

// PWA 配置（2026 最佳实践 - Serwist）
// 协作应用需要实时数据，只缓存静态资源，不缓存 API
const withSerwistInit = require("@serwist/next").default;

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = withSerwist({
  // Enable standalone output for Docker
  output: "standalone",

  // Transpile monorepo packages
  transpilePackages: ["@nexusnote/ui", "@nexusnote/db", "@nexusnote/config"],

  // React Compiler - 自动优化 React 组件性能 (2026 最佳实践)
  // 参考: https://juejin.cn/post/7593541290990747698
  reactCompiler: true,

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

  // Webpack config for Yjs
  webpack: (config, { isServer }) => {
    // Handle Yjs imports
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
});

module.exports = nextConfig;
