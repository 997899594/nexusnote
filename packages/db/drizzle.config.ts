import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
import * as path from "path";

// 兼容本地开发 (如果有 .env 就加载，没有就算了)
// 这样既能在本地跑，也能在 K8s 跑
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

// 确保 URL 存在
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
