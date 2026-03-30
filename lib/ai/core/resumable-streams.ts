import type { after as afterFn } from "next/server";
import { createResumableStreamContext } from "resumable-stream/ioredis";

const globalForResumableStreams = globalThis as unknown as {
  chatResumableStreamContext: ReturnType<typeof createResumableStreamContext> | undefined;
};

export function getChatResumableStreamContext(waitUntil: typeof afterFn) {
  if (!globalForResumableStreams.chatResumableStreamContext) {
    globalForResumableStreams.chatResumableStreamContext = createResumableStreamContext({
      waitUntil,
      keyPrefix: "nexusnote-chat-stream",
    });
  }

  return globalForResumableStreams.chatResumableStreamContext;
}
