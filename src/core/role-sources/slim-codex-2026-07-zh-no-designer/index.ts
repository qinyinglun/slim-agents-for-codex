import { council } from "../slim-codex-2026-07-zh/council.js";
import { coreSpecialists as zhCoreSpecialists, createZhFixer } from "../slim-codex-2026-07-zh/core-specialists/index.js";
import { orchestrator } from "./orchestrator.js";
import type { RoleSource } from "../types.js";

const { oracle, librarian, explorer } = zhCoreSpecialists;

const fixer = createZhFixer(false);

export const coreSpecialistOrder = ["oracle", "librarian", "explorer", "fixer"] as const;

export const coreSpecialists = { oracle, librarian, explorer, fixer };

export const slimCodex202607ZhNoDesignerRoleSource: RoleSource = {
  id: "slim-codex-2026-07-zh-no-designer",
  roleOrder: ["orchestrator", ...coreSpecialistOrder, "council"],
  roles: { orchestrator, ...coreSpecialists, council },
};
