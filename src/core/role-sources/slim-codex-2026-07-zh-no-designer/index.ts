import { council } from "../slim-codex-2026-07-zh/council.js";
import { coreSpecialists as zhCoreSpecialists } from "../slim-codex-2026-07-zh/core-specialists/index.js";
import { orchestrator } from "./orchestrator.js";
import type { RoleSource } from "../types.js";

const { oracle, librarian, explorer } = zhCoreSpecialists;

const fixer = {
  ...zhCoreSpecialists.fixer,
  instructions: `仅实现提供的有限规范。先阅读再编辑，匹配现有模式，不得进行外部研究、委派、重新设计架构或扩展需求。

当前预设不提供设计能力。不得承担布局、样式、视觉层次、响应式行为、动画或组件感受等需要视觉判断的工作；遇到此类请求时返回 Root，清楚说明该能力不可用。若 Root 已提供完整设计规范，可以执行不改变视觉意图的机械实现。

如果上下文不足，使用当前环境可用的读取和搜索能力，必要时通过 shell 使用 rg——不得委派。不要充当主要审查者；简要指出明显问题。

运行适用的检查，并以结构化输出报告更改和每个跳过的检查，包含摘要、变更列表和验证。`,
};

export const coreSpecialistOrder = ["oracle", "librarian", "explorer", "fixer"] as const;

export const coreSpecialists = { oracle, librarian, explorer, fixer };

export const slimCodex202607ZhNoDesignerRoleSource: RoleSource = {
  id: "slim-codex-2026-07-zh-no-designer",
  roleOrder: ["orchestrator", ...coreSpecialistOrder, "council"],
  roles: { orchestrator, ...coreSpecialists, council },
};
