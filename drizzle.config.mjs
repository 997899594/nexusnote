import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

try {
  if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
  }
} catch {
  // dotenv is optional outside local development
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default {
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
