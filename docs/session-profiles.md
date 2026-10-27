# GPT-6 session profiles: bal / pro

[简体中文完整指南](session-profiles.zh-CN.md) · [README](../README.md)

Use native Codex profiles to select a Root model and a six-role Chinese Slim team per CLI session. Both omit Designer. `pro` is a local configuration name, not a subscription tier. GPT-5.6 presets are historical and unchanged by this feature.

## Model assignments

| Role | bal | pro |
| --- | --- | --- |
| Root | GPT-6.1 Sol / high | GPT-6 Astra / high |
| Orchestrator | GPT-6.1 Sol / high | GPT-6.1 Sol / high |
| Oracle / Council | GPT-6 Astra / high | GPT-6 Astra / high |
| Fixer | GPT-6.1 Terra / high | GPT-6.1 Sol / high |
| Explorer / Librarian | GPT-6 Luna / low | GPT-6 Luna / low |

`bal` uses `openai-6.1-bal-zh-nodesigner`; `pro` uses `openai-6-pro-zh-nodesigner`. Both reuse the same versioned prompts and Skills. Root settings belong to the profile, separately from subagent presets.

As of 2026-10-27, only the `bal` Fixer changes from Luna/high to GPT-6.1 Terra/high. Update with `bun dist/cli.js install-profiles --profile bal`. The installer recognizes and backs up the previous managed `bal` generation. Historical snapshots, `pro`, and the base active preset remain unchanged. Terra is a candidate for scoped code fixes, not a guaranteed quality improvement on every task. Model access is required; there is no automatic fallback to Luna.

## Install and update

Requirements: Bun, Node.js 20+, and a Codex CLI supporting file-based profiles (0.134.0+; tested with 0.163.0).

```bash
bun install
bun run build
bun dist/cli.js install-profiles
# Non-interactive:
bun dist/cli.js install-profiles --yes
# Update one profile:
bun dist/cli.js install-profiles --profile pro
```

The installer previews paths and asks for confirmation unless `--yes` is supplied. Run `bun link` after building to expose `slim-agents-codex` from the current checkout, with Bun's bin directory on PATH. Rebuild after source updates.

For a local release archive containing this feature, use `bun add --global ./slim-agents-for-codex-<version>.tgz` and then `slim-agents-codex install-profiles`. Older published archives may not include this command.

Optional targets: `--codex-home /absolute/home --skills-home /absolute/shared-skills`. Defaults are `CODEX_HOME` or `~/.codex`, and `~/.agents/skills`. A custom Skills destination must also be discoverable by Codex. Profiles are user-level; `--scope project` and `--preset` are rejected.

## Use

```bash
codex -p bal
codex -p pro
codex exec -p bal "Trace this module's call chain"
codex exec -p pro "Implement the agreed fix and verify it"
codex -p pro resume <session-id>
```

Run the first two commands in separate terminals for concurrent sessions. Running `codex` without a profile keeps your existing defaults. Resume retains conversation history. Start a new task after configuration changes; already-running children do not automatically change models. `codex -p bal -m gpt-6-astra` overrides Root only, not role files with explicit model settings.

Request the same agent names in either profile: `explorer` for locating code, `oracle` for independent analysis, `librarian` for authoritative research, `fixer` for bounded implementation, `council` for advisory perspectives, and `orchestrator` for executing an approved multi-stage plan. Root remains the approval and final acceptance gate. Council and Orchestrator do not delegate to each other.

## Layout and preservation

The installer writes `bal.config.toml` and `pro.config.toml` under Codex home. Each points through absolute `config_file` paths to `agent-presets/slim-agents-for-codex/profiles/<name>/agents/*.toml`, outside automatic discovery. A manifest is stored beside each agents directory. Reinstall after moving Codex home.

The base `config.toml`, active `agents/`, unrelated custom roles and MCP connections remain unchanged. Existing managed profile files and directories are backed up before replacement; backup paths appear in command output. Unmanaged files with the same profile names are rejected. Generated profile edits are overwritten on update and retained in backups.

Both profiles share `slim-council` and `slim-orchestration`. Identical installed Skills are reused, missing directories are installed, and divergent existing Skills stop preflight before profile writes. Back up and reconcile divergent Skills instead of overwriting user edits.

## Verify and troubleshoot

```bash
bun dist/cli.js validate --profile bal --codex-home /root/.codex --skills-home /root/.agents/skills
bun dist/cli.js validate --profile pro --codex-home /root/.codex --skills-home /root/.agents/skills
bun run profiles:check
# Alternative home:
bun run profiles:check /absolute/codex-home
```

Replace example paths as needed. Structural validation checks Root, role paths, exact role set/content, manifest and shared Skills. The runtime probe uses native `codex -p` and a temporary local HTTP sink that deliberately refuses inference after inspecting the assembled Root and per-role model/effort. It never calls a real model or spawns agents, stores requests only in memory and does not print prompts or credentials. It disables base-config MCP entries and app/plugin/memory features for its subprocess. Run from a trusted directory without extra project hooks or MCPs, since project configuration still loads. This does not test account entitlement.

Use `/debug-config` to investigate overrides. CLI flags and trusted project configuration outrank profiles. Other global/project custom agents can remain available; these profiles do not enforce a globally exclusive roster. Check for residual Designer declarations/files if one appears. A custom role's explicit model takes precedence over generic subagent defaults. Parent permissions, provider and MCPs are inherited; read-only instructions do not create a separate sandbox.

Profiles do not isolate repository files, Git worktrees, shared Skills or session history. Split responsibilities or use separate worktrees for concurrent edits. CLI profile selection is supported; desktop per-session profile selection is not promised.

## Roll back or disable

Stop passing `-p bal` or `-p pro` to return to unchanged base defaults. To roll back an update, close relevant sessions, move current profile files/directories aside, and restore the matching config and role-directory backups together to their original paths. Validate and start a new task. Restoring only the config does not restore the referenced role files.

To remove this feature, archive its two profile files and `agent-presets/slim-agents-for-codex/profiles/{bal,pro}` after closing sessions. Keep shared Skills if the base preset still uses them.

Maintenance sources: `src/core/presets.ts` (models/session mappings), `src/core/profiles.ts` (installation/validation), `src/core/role-sources/` (shared prompts), `skill-sources/` (Skills), and `scripts/verify-session-profiles.mjs` (runtime probe).

Official references: [Profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles), [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
