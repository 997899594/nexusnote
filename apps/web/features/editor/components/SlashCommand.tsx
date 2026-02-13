"use client";

import { Extension, type Range } from "@tiptap/core";
import { type Editor, ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
  CheckSquare,
  ChevronRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Info,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sparkles,
  Table,
  Youtube,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import tippy, { type Instance as TippyInstance } from "tippy.js";

interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: Editor; range: Range }) => void;
}

const COMMANDS: CommandItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <Heading1 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a bullet list",
    icon: <List className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a numbered list",
    icon: <ListOrdered className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    description: "Create a checklist with tasks",
    icon: <CheckSquare className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Table",
    description: "Insert a table",
    icon: <Table className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "Image",
    description: "Upload or embed an image",
    icon: <Image className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // 触发文件选择器
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target?.result as string;
            editor.chain().focus().setImage({ src }).run();
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    },
  },
  {
    title: "YouTube",
    description: "Embed a YouTube video",
    icon: <Youtube className="w-4 h-4 text-red-500" />,
    command: ({ editor, range }) => {
      const url = window.prompt("Enter YouTube URL:");
      if (url) {
        editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run();
      }
    },
  },
  {
    title: "Callout",
    description: "Add a callout block for tips, warnings",
    icon: <Info className="w-4 h-4 text-blue-500" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout("info").run();
    },
  },
  {
    title: "Toggle",
    description: "Add a collapsible section",
    icon: <ChevronRight className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCollapsible().run();
    },
  },
  {
    title: "Quote",
    description: "Add a blockquote",
    icon: <Quote className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code Block",
    description: "Add a code block",
    icon: <Code className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    description: "Add a horizontal rule",
    icon: <Minus className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Ask AI",
    description: "Generate content with AI",
    icon: <Sparkles className="w-4 h-4 text-purple-500" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // 触发 AI 对话框
      const event = new CustomEvent("openAIDialog");
      window.dispatchEvent(event);
    },
  },
];

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

export interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    useEffect(() => {
      setSelectedIndex(0);
    }, []);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-white/80 backdrop-blur-3xl border border-black/[0.03] rounded-[24px] shadow-2xl p-4 text-[10px] font-black uppercase tracking-widest text-black/20 ring-1 ring-black/[0.02]">
          No results found
        </div>
      );
    }

    return (
      <div className="bg-white/80 backdrop-blur-3xl border border-black/[0.03] rounded-[24px] shadow-2xl p-2 min-w-[240px] max-h-[400px] overflow-y-auto custom-scrollbar ring-1 ring-black/[0.02]">
        <div className="px-3 py-2 mb-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20">
            Quick Commands
          </span>
        </div>
        {items.map((item, index) => (
          <button
            key={item.title}
            onClick={() => selectItem(index)}
            className={`w-full text-left px-3 py-2.5 rounded-2xl flex items-center gap-4 transition-all duration-300 group ${
              index === selectedIndex
                ? "bg-black text-white shadow-xl shadow-black/10 scale-[1.02]"
                : "hover:bg-black/5 text-black/60 hover:text-black"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                index === selectedIndex ? "bg-white/10" : "bg-black/5 group-hover:bg-black/10"
              }`}
            >
              {item.icon}
            </div>
            <div className="flex flex-col">
              <div className="text-[11px] font-black uppercase tracking-widest">{item.title}</div>
              <div
                className={`text-[9px] font-medium leading-tight mt-0.5 ${
                  index === selectedIndex ? "text-white/40" : "text-black/30"
                }`}
              >
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  },
);

CommandList.displayName = "CommandList";

interface SuggestionRenderProps {
  editor: Editor;
  range: Range;
  query: string;
  text: string;
  items: CommandItem[];
  command: (item: CommandItem) => void;
  clientRect?: () => DOMRect;
}

interface SuggestionCommandProps {
  editor: Editor;
  range: Range;
  props: CommandItem;
}

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: SuggestionCommandProps) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return COMMANDS.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionRenderProps) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate(props: SuggestionRenderProps) {
              component?.updateProps(props);

              if (!props.clientRect) return;

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }

              return (component?.ref as CommandListRef)?.onKeyDown(props) ?? false;
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
