/** @type {import('next').NextConfig} */
const path = require("path");
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
};

module.exports = nextConfig;
