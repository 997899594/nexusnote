import type { Command } from "@/types/chat";
import {
  BookOpen,
  Globe,
  GraduationCap,
  ListTodo,
  Map as MapIcon,
  Plus,
  Search,
} from "lucide-react";

export const CHAT_COMMANDS: Command[] = [
  {
    id: "search",
    label: "Search Notes",
    icon: Search,
    modeLabel: "搜索笔记",
    modeIcon: Search,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ q: input.trim() }),
  },
  {
    id: "create-note",
    label: "Create Note",
    icon: Plus,
    modeLabel: "创建笔记",
    modeIcon: Plus,
    targetPath: "/notes/new",
    getQueryParams: () => ({}),
  },
  {
    id: "generate-course",
    label: "Generate Course",
    icon: GraduationCap,
    modeLabel: "生成课程",
    modeIcon: GraduationCap,
    targetPath: "/courses/new",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "create-flashcards",
    label: "Create Flashcards",
    icon: ListTodo,
    modeLabel: "创建闪卡",
    modeIcon: ListTodo,
    targetPath: "/flashcards",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "generate-quiz",
    label: "Generate Quiz",
    icon: BookOpen,
    modeLabel: "生成测验",
    modeIcon: BookOpen,
    targetPath: "/interview",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "web-search",
    label: "Web Search",
    icon: Globe,
    modeLabel: "联网搜索",
    modeIcon: Globe,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ web: input.trim() }),
  },
];

export const HOME_COMMANDS: Command[] = [
  ...CHAT_COMMANDS,
  {
    id: "mind-map",
    label: "Mind Map",
    icon: MapIcon,
    modeLabel: "思维导图",
    modeIcon: MapIcon,
    targetPath: "/editor",
    getQueryParams: (input: string) => ({
      msg: `Create mind map: ${input.trim()}`,
    }),
  },
];

export const QUICK_ACTIONS = [
  { icon: Search, label: "搜索笔记" },
  { icon: Plus, label: "创建笔记" },
  { icon: GraduationCap, label: "生成课程" },
  { icon: ListTodo, label: "创建闪卡" },
  { icon: BookOpen, label: "生成测验" },
  { icon: MapIcon, label: "思维导图" },
] as const;

export function extractCommandContent(input: string): string {
  const match = input.match(/^\/\S+\s*(.*)$/);
  return match ? match[1] : "";
}
