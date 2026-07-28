import { council } from "./council.js";
import { coreSpecialistOrder, coreSpecialists } from "./core-specialists/index.js";
import { orchestrator } from "./orchestrator.js";
import type { RoleSource } from "../types.js";

export const slimCodex202607ZhRoleSource: RoleSource = {
  id: "slim-codex-2026-07-zh",
  roleOrder: ["orchestrator", ...coreSpecialistOrder, "council"],
  roles: { orchestrator, ...coreSpecialists, council },
};
