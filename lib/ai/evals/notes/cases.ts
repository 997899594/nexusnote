import { createEvalSuite } from "../runner";

export const notesEvalSuite = createEvalSuite({
  domain: "notes",
  version: "v2",
  cases: [
    {
      id: "notes-summary-preserve-meaning",
      title: "总结时保留原意",
      domain: "notes",
      promptVersion: "note-assist@v1",
      input: {
        instruction: "帮我总结这份项目复盘，保留问题和下一步。",
        noteExcerpt: "这次上线延迟主要是 schema 变更没有提前演练；下一步要补 migration checklist。",
      },
      expectations: [
        "总结必须保留失败原因和下一步动作",
        "不能擅自引入原文没有的结论",
        "结果应更紧凑，但语义不漂移",
      ],
      regression: {
        minOutputLength: 30,
        requiredSubstrings: ["schema", "migration checklist"],
        forbiddenSubstrings: ["负责人", "截止时间"],
      },
      tags: ["rewrite", "fidelity"],
    },
    {
      id: "notes-structured-rewrite",
      title: "把散乱记录整理成结构化笔记",
      domain: "notes",
      promptVersion: "note-assist@v1",
      input: {
        instruction: "把这些碎片整理成清晰的会议纪要。",
        noteExcerpt: "上线前要补告警；登录链路已经恢复；还差邮件投递监控；这周目标是稳定部署。",
      },
      expectations: [
        "输出应更结构化，适合写回笔记",
        "保留原始事实，不要扩展为不存在的任务",
        "结果应适合后续继续编辑",
      ],
      regression: {
        minOutputLength: 30,
        requiredSubstrings: ["登录链路", "邮件投递"],
        forbiddenSubstrings: ["负责人", "截止时间"],
      },
      tags: ["structure", "editing"],
    },
    {
      id: "notes-action-items-without-hallucination",
      title: "整理行动项时不能编造不存在的任务",
      domain: "notes",
      promptVersion: "note-assist@v1",
      input: {
        instruction: "把这段记录整理成行动项列表。",
        noteExcerpt: "要补登录链路监控；数据库迁移要提前演练；邮件告警模板还没统一。",
      },
      expectations: [
        "输出应是清晰的行动项列表",
        "不能凭空增加负责人、截止时间等原文没有的信息",
        "保留原始任务边界，适合直接写回笔记",
      ],
      regression: {
        minOutputLength: 20,
        requiredSubstrings: ["登录链路监控", "数据库迁移"],
        forbiddenSubstrings: ["负责人", "截止时间", "Owner", "Due"],
        forbiddenPatterns: ["\\b\\d{4}-\\d{2}-\\d{2}\\b"],
      },
      tags: ["editing", "fidelity"],
    },
  ],
});
