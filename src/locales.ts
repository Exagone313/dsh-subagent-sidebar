// SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>
//
// SPDX-License-Identifier: MIT

// The copy this plugin renders, kept as environment-free data so the host
// program can typecheck and test it without a DOM. locale/en.json and
// locale/zh.json mirror these dictionaries for the plugin inventory, which
// reads display metadata straight from the exported JSON resources.
import type {} from "@deepseek-ai/dsh-client-ui-slots";

/** Dictionary namespace owned by this plugin. */
export const NS = "subagentSidebar";

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  "tab.title": "子智能体",
  "guide.title": "子智能体",
  "guide.description": "列出本会话的子智能体",
  "aria.list": "此会话的子智能体",
  "loading": "正在加载子智能体…",
  "migrationRequired": "此会话的历史记录需要迁移后才能读取子智能体。",
  "loadError": "无法读取此会话的子智能体。",
  "empty.title": "暂无子智能体",
  "empty.description": "从此会话派生的子智能体将显示在这里。",
  "state.running": "正在运行",
  "state.idle": "空闲",
  "state.completed": "已完成",
  "state.failed": "失败",
  "mode.external": "外部",
  "tokens.total": "{value} tok",
  "turns.other": "{count} 轮",
  "duration.subSecond": "不到 1 秒",
  "duration.seconds": "{seconds} 秒",
  "duration.minutes": "{minutes} 分 {seconds} 秒",
  "duration.hours": "{hours} 小时 {minutes} 分",
  "duration.days": "{days} 天 {hours} 小时",
  "loadMore": "加载更多",
  "age.now": "刚刚",
  "age.minute": "{count} 分钟前",
  "age.hour": "{count} 小时前",
  "age.day": "{count} 天前",
} as const;

/** Every dictionary key of the `subagentSidebar` namespace. */
export type SubagentSidebarKey = keyof typeof zh;

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    /** Subagent catalog copy. */
    subagentSidebar: SubagentSidebarKey;
  }
}

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<SubagentSidebarKey, string> = {
  "tab.title": "Subagents",
  "guide.title": "Subagents",
  "guide.description": "List this session's subagents",
  "aria.list": "Subagents in this session",
  "loading": "Loading subagents…",
  "migrationRequired":
    "This session's history needs migration before its subagents can be read.",
  "loadError": "Could not read this session's subagents.",
  "empty.title": "No subagents yet",
  "empty.description": "Subagents spawned from this session appear here.",
  "state.running": "Running",
  "state.idle": "Idle",
  "state.completed": "Completed",
  "state.failed": "Failed",
  "mode.external": "External",
  "tokens.total": "{value} tok",
  "turns.other": "{count} turns",
  "duration.subSecond": "<1s",
  "duration.seconds": "{seconds}s",
  "duration.minutes": "{minutes}m {seconds}s",
  "duration.hours": "{hours}h {minutes}m",
  "duration.days": "{days}d {hours}h",
  "loadMore": "Load more",
  "age.now": "just now",
  "age.minute": "{count}m ago",
  "age.hour": "{count}h ago",
  "age.day": "{count}d ago",
};
