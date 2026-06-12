export interface StableNavigationTarget {
  href: string;
  label: string;
  ariaLabel: string;
}

export const NAV_TARGETS = {
  home: {
    href: "/",
    label: "首页",
    ariaLabel: "返回首页",
  },
  profile: {
    href: "/profile",
    label: "个人中心",
    ariaLabel: "返回个人中心",
  },
  editor: {
    href: "/editor",
    label: "知识工作台",
    ariaLabel: "返回知识工作台",
  },
} as const satisfies Record<string, StableNavigationTarget>;

export const PAGE_BACK_TARGETS = {
  chat: NAV_TARGETS.home,
  careerTrees: NAV_TARGETS.profile,
  editor: NAV_TARGETS.profile,
  editorDetail: NAV_TARGETS.editor,
  interview: NAV_TARGETS.home,
  learn: NAV_TARGETS.profile,
  profile: NAV_TARGETS.home,
  profileInsights: NAV_TARGETS.profile,
  profileSettings: NAV_TARGETS.profile,
  publicCourse: NAV_TARGETS.home,
} as const satisfies Record<string, StableNavigationTarget>;
