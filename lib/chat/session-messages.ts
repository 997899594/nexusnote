import type { UIMessage } from "ai";

const MAX_PERSISTED_MESSAGES = 80;
const MAX_PERSISTED_MESSAGE_BYTES = 120_000;

interface PersistedMessageSnapshot {
  messages: UIMessage[];
  droppedCount: number;
  trimmed: boolean;
}

function getSerializedMessageBytes(messages: UIMessage[]): number {
  return new TextEncoder().encode(JSON.stringify(messages)).length;
}

export function buildPersistedMessageSnapshot(messages: UIMessage[]): PersistedMessageSnapshot {
  if (messages.length === 0) {
    return {
      messages,
      droppedCount: 0,
      trimmed: false,
    };
  }

  let persisted = messages.slice(-MAX_PERSISTED_MESSAGES);
  let droppedCount = Math.max(0, messages.length - persisted.length);

  // Keep trimming oldest messages until the serialized payload fits the storage budget.
  while (
    persisted.length > 1 &&
    getSerializedMessageBytes(persisted) > MAX_PERSISTED_MESSAGE_BYTES
  ) {
    persisted = persisted.slice(1);
    droppedCount += 1;
  }

  return {
    messages: persisted,
    droppedCount,
    trimmed: droppedCount > 0,
  };
}
