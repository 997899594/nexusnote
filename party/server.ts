/**
 * PartyKit Server - 2026 Modern Collaboration
 * 使用 y-partykit 实现 Yjs 同步，支持边缘部署
 */

import { onConnect } from "y-partykit";

export default {
  async onConnect(conn: any, room: any) {
    return onConnect(conn, room, {
      persist: { mode: "snapshot" },
    });
  },
};
