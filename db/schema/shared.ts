import { customType } from "drizzle-orm/pg-core";

export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const EMBEDDING_DIMENSIONS = 4000;

export const embeddingVector = customType<{ data: number[] }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
});
