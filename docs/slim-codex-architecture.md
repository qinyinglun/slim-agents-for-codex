# Slim Codex architecture

The current Codex translation uses seven runtime roles.

## Runtime graph

```text
Root Codex agent
├── Council
│   └── task-specific installed expert agents
└── Orchestrator
    ├── Oracle
    ├── Librarian
    ├── Explorer
    ├── Designer
    └── Fixer
```

Root acts as the board or client. It owns the user request, chooses when deliberation is needed, approves a Council recommendation before handing it to Orchestrator, verifies the final result, and answers the user. Root may pre-authorize bounded low-risk reversible work, but high-risk, irreversible, or external actions require explicit approval after Council reports.

Council and Orchestrator are peer child coordinators. Council is the advisory and decision layer: it identifies the expertise required for an assigned question and selects matching installed agents by their descriptions. Its direct child experts act as council members and return independent feasibility, risk, and solution perspectives. Council preserves disagreements and synthesizes advice; it does not edit files or call Orchestrator.

Council's read-only prompt is a behavioral boundary, not automatic privilege downgrading for arbitrary children. Codex subagents inherit the parent turn's live permission mode, and custom agents may carry their own sandbox defaults. Root must therefore curate Council-eligible custom TOMLs as advisory agents with `sandbox_mode = "read-only"`; for hard read-only deliberation, start the Council turn under read-only permissions. Write-capable implementation agents are not eligible Council members merely because their descriptions match a domain.

Council prefers `$grilling`, `$grill-with-docs`, `$deep-research`, `$brainstorming`, and `$doc-coauthoring` when those skills are available in the active Codex session. These are portable soft dependencies because custom-agent `skills.config` entries require installation-specific `SKILL.md` paths. Council must report unavailable methods and use an equivalent evidence-based process instead of claiming they ran.

Orchestrator is the execution team. It receives one root-approved bounded outcome and any Council handoff, builds an execution graph, and delegates only to the five versioned Slim specialists. It does not call Council, arbitrary custom agents, or another Orchestrator.

`agents.max_depth = 2` permits both coordinators to create direct child experts while preventing those experts from delegating again. `agents.max_threads = 6` bounds concurrent open threads; coordinators schedule larger rosters in batches when necessary.

Every coordinator-to-specialist spawn uses `fork_turns="none"` with a self-contained assignment. Codex full-history forks inherit the current agent type, model, and reasoning effort, so they cannot also select a different registered role.

## Role sources and presets

`src/core/presets.ts` is the canonical assembly for role-source selection, model and effort mappings, aliases, MCP restrictions, and Skill names. Prompt and role-order history lives under `src/core/role-sources/`.

Codex parses every standalone agent TOML as a complete config layer before it merges that layer into a spawned session. A bare `[mcp_servers.<id>] enabled = false` table fails standalone parsing because it has no transport; a dummy transport can then conflict with the inherited server transport during merging. Portable generated roles therefore keep the reviewed MCP denylist as behavioral `developer_instructions` and emit no role-local MCP tables. Hard per-role MCP enforcement requires installation-specific complete transports or a future Codex-native denylist mechanism.

- `slim-codex-2026-07` backs seven-role `openai-5.6.1` snapshots (English).
- `slim-codex-2026-07-zh` backs seven-role `openai-5.6` snapshots (Simplified Chinese).
- Visual inspection belongs to Oracle, Explorer, or Designer according to the task.

Generated and installed agent TOMLs remain flat under `agents/`. Additional Council-selectable custom experts are installed independently under project `.codex/agents/` or global `CODEX_HOME/agents/` and registered in the matching `config.toml`.

## Skill boundary

Each preset ships its own Skill files under `presets/<id>/skills/`:

- `slim-orchestration/SKILL.md` defines how Orchestrator plans persistent deep work and schedules only the five built-in Slim specialists through implementation and verification.
- `slim-council/SKILL.md` defines how Council selects installed expert agents by description, obtains independent advisory perspectives, handles partial failures, and returns a feasibility-and-risk recommendation for Root approval.

Root owns the routing decision and any Council-to-Orchestrator handoff. Each generated coordinator prompt remains self-contained and treats its corresponding skill as optional, so explicitly spawned coordinators still have a safe contract when the skill is unavailable. Installing or switching a preset automatically deploys the matching Skill files to the configured `skillsHome`.
