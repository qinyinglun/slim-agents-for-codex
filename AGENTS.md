# Repository Instructions

## Sources of truth

- Treat `src/core/presets.ts` as the canonical assembly for preset-to-role-source selection, model/effort mappings, MCP blacklists, aliases, and generated agent TOML. Keep versioned role prompts and role order under `src/core/role-sources/`.
- Do not hand-edit files under `presets/<id>/agents/`. Change the generator, run tests, build, and regenerate snapshots.
- Each role source defines seven roles: `orchestrator`, `oracle`, `librarian`, `explorer`, `designer`, `fixer`, and `council`. A preset may omit `designer` (e.g., `zh-nodesigner`). Do not reintroduce `observer` or invent a `councillor` role.
- Keep Council and Orchestrator as peer child coordinators. Council dynamically selects installed expert agents for feasibility, risks, and independent perspectives; Orchestrator implements an agreed approach through the Slim specialists (four or five, depending on whether the preset includes `designer`). Neither coordinator spawns the other.
- Keep Root as the approval gate between Council advice and Orchestrator execution. Council prefers grilling, document-grounded challenge, deep research, brainstorming, and document co-authoring skills when available; do not hard-code installation-specific skill paths in generated TOML.

## Preset lifecycle

- Add a new preset directory for a new model/effort generation. Never silently rewrite or delete historical model mappings or manifests.
- Version role sources before adapting intentional prompt, role-list, or behavior changes from a newer upstream release.
- A correction to this project's existing Codex translation may update the shared generator and regenerate affected historical TOMLs. Publish such a correction only in a new package version; never move an existing tag or replace an existing Release asset.
- Keep `latest` and `recommended` as explicit movable aliases. Do not implement automatic model fallback.

## Codex layout and MCP rules

- Generate `config_file = "agents/<role>.toml"`. The path is relative to the declaring global or project `config.toml`.
- Install active global agents flat under `CODEX_HOME/agents/` and project agents flat under `<project>/.codex/agents/`. Keep inactive legacy copies outside auto-discovery, such as `CODEX_HOME/agent-presets/`.
- Do not emit role-local `[mcp_servers.<id>]` tables. Codex first deserializes a standalone agent file as a complete config and then merges it with the parent config: a transport-less disabled table fails the first step, while a dummy transport can conflict with an inherited transport during the second step. Keep portable role denylist guidance in `developer_instructions`; installation-specific hard MCP policy belongs to the active Codex configuration.
- Preserve the reviewed MCP denylist matrix in `src/core/presets.ts`. Tests must compare the exact behavioral denylist for every role and preset and reject generated role-local MCP fragments.

## Change and verification discipline

- For generator, installer, validator, or CLI behavior changes, write a failing test first and observe the expected failure before implementation.
- Preserve UTF-8, BOM state, and line endings. Prefer `apply_patch`; do not rewrite text files through an encoding-implicit shell command.
- Before a local commit, run the focused test, `npm test`, `npm run typecheck`, `npm run build`, regenerate snapshots when generator output changes, validate every preset directory, and run `npm run pack:check`.
- On Windows, use a writable project-local npm cache if the default cache returns `EPERM`, for example `$env:npm_config_cache='.npm-cache'`.
- Structural validation does not prove model entitlement or MCP availability.

## Release and local installation

- Keep the npm package `private: true`. Distribution is through GitHub Releases, not the npm registry.
- Do not bump versions, push, tag, publish, or overwrite global/project Codex configuration unless the user explicitly requests that action.
- After updating a local Codex installation, validate it with `validate --codex-home`, compare installed role files with the selected preset, and tell the user that new agent configuration takes effect in a new Codex task.
