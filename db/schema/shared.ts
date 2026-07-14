import { vector } from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSIONS } from "@/config/embedding";

export { EMBEDDING_DIMENSIONS } from "@/config/embedding";

export function embeddingVector(name: string) {
  return vector(name, { dimensions: EMBEDDING_DIMENSIONS });
}
