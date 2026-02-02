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
