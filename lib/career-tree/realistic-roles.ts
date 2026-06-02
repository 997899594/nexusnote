const ABSTRACT_ROLE_TITLE_PATTERNS = [
  /成长|路线|路径|主线|能力|地图|图谱|学习|课程|探索者|实践者|构建者/u,
  /skill|roadmap|path|track|builder|explorer|learner/iu,
];

const REAL_ROLE_TITLE_PATTERNS = [
  /工程师|开发|架构师|分析师|科学家|研究员|产品经理|设计师|运营|顾问|咨询师|讲师|负责人|主管|经理|专家/u,
  /engineer|developer|architect|analyst|scientist|researcher|designer|manager|consultant|specialist|lead/iu,
];

export function isRealisticProgressionRoleTitle(title: string): boolean {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    return false;
  }

  const looksLikeRole = REAL_ROLE_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle));
  if (!looksLikeRole) {
    return false;
  }

  return !ABSTRACT_ROLE_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle));
}
