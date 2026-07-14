import { embed, embedMany } from "ai";
import { EMBEDDING_DIMENSIONS } from "@/config/embedding";
import { env } from "@/config/env";
import { aiModelGateway } from "./model-gateway";

const embeddingProviderOptions = {
  openai: {
    dimensions: EMBEDDING_DIMENSIONS,
  },
} as const;

function assertEmbeddingDimensions(embedding: number[], context: string): number[] {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${context} returned ${embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}`,
    );
  }

  return embedding;
}

function assertEmbeddingConfiguration(): void {
  if (env.EMBEDDING_DIMENSIONS !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding configuration mismatch: runtime=${env.EMBEDDING_DIMENSIONS}, schema=${EMBEDDING_DIMENSIONS}`,
    );
  }
}

export async function generateEmbedding(value: string): Promise<number[]> {
  assertEmbeddingConfiguration();
  const { embedding } = await embed({
    model: aiModelGateway.getEmbeddingModel(),
    value,
    providerOptions: embeddingProviderOptions,
  });

  return assertEmbeddingDimensions(embedding, "Embedding model");
}

export async function generateEmbeddings(values: string[]): Promise<number[][]> {
  if (values.length === 0) {
    return [];
  }

  assertEmbeddingConfiguration();
  const { embeddings } = await embedMany({
    model: aiModelGateway.getEmbeddingModel(),
    values,
    providerOptions: embeddingProviderOptions,
  });

  return embeddings.map((embedding, index) =>
    assertEmbeddingDimensions(embedding, `Embedding model result ${index}`),
  );
}
