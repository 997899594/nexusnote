/**
 * PartyKit Server - 2026 Modern Collaboration
 * 使用 y-partykit 实现 Yjs 同步，支持边缘部署
 */

import { onConnect } from "y-partykit";
import type * as PartyKit from "partykit/server";

export default {
  async onConnect(conn: PartyKit.Connection, room: PartyKit.Room) {
    return onConnect(conn, room, {
      persist: { mode: "snapshot" },
    });
  },
} satisfies PartyKit.PartyKitServer;
