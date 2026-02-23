import type { Config } from "drizzle-kit";

// 兼容本地开发 (如果有 .env 就加载，没有就算了)
// 这样既能在本地跑，也能在 K8s 跑 (生产镜像无 dotenv)
try {
  if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
  }
} catch {
  // dotenv not available in production image, env vars come from K8s secrets
}

// 确保 URL 存在
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default {
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
