import { describe, expect, it } from "bun:test";
import { resolveResearchEvidenceRequest } from "./evidence-request";

describe("resolveResearchEvidenceRequest", () => {
  it("requests evidence without allowing an outline for a broad AI learning topic", () => {
    const request = resolveResearchEvidenceRequest({
      userMessages: ["学前沿 ai"],
      currentDate: new Date("2026-05-28T00:00:00.000Z"),
    });

    expect(request?.domain).toBe("ai_frontier");
    expect(request?.outlineReadiness).toBe("needs_interview");
  });

  it("allows an outline only after topic, baseline, and outcome are known", () => {
    const request = resolveResearchEvidenceRequest({
      userMessages: ["我零基础想学前沿 ai，三个月做一个能落地到工作的 Agent 项目"],
      currentDate: new Date("2026-05-28T00:00:00.000Z"),
    });

    expect(request?.domain).toBe("ai_frontier");
    expect(request?.outlineReadiness).toBe("ready");
  });
});
