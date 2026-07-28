# slim-agents-for-codex

[简体中文](README.zh-CN.md) | English

Deterministic, reviewed Codex agent presets adapted from [alvinunreal/oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim). The original role concepts and behavior are the work of that project; this repository provides a Codex-specific adaptation. This community project is not affiliated with OpenAI or the upstream project.

Special thanks to **alvinunreal/oh-my-opencode-slim** for the upstream Deepwork workflow, Council pattern, and the role-system design that this adaptation builds on.

For official guidance on subagent workflows, custom agent TOML files, model and reasoning settings, and global `[agents]` controls, see [Subagents | ChatGPT Learn](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Quick start

This project is distributed through GitHub rather than the npm registry.

### Install a GitHub Release package

Download `slim-agents-for-codex-0.2.0.tgz` from the matching GitHub Release, then run:

```bash
npm install --global ./slim-agents-for-codex-0.2.0.tgz
slim-agents-codex list-presets
slim-agents-codex install --preset openai-5.6-en --scope global
```

If a `0.1.x` preset is already installed, use `slim-agents-codex switch-preset --preset openai-5.6-en --scope global` instead. The switch archives the managed agents and Skills it replaces before post-validating the new installation.

### Run from a source checkout

```bash
npm ci
npm run build
node dist/cli.js list-presets
node dist/cli.js install --preset openai-5.6-en
```

`install` previews the resolved immutable preset, config path, Skill path, and backup path before asking for confirmation. It installs both the selected agent preset and the two managed Slim Skills. Use `--scope global` for `CODEX_HOME` (or `~/.codex`) plus `$HOME/.agents/skills`, and `--scope project` for the current project's `.codex` plus `.agents/skills`. Explicit `--codex-home PATH` and `--skills-home PATH` options override those targets. Use `--yes` only for explicit non-interactive installation.

Available presets:

- `openai-5.6-en` — English prompts and Skills (default, recommended), 7 roles with designer
- `openai-5.6-zh` — Chinese (Simplified) prompts and Skills, 7 roles with designer
- `openai-5.6-zh-nodesigner` — Chinese (Simplified) prompts and Skills, 6 roles without designer (server-side)

Preset-specific Skill files are bundled under each preset directory and installed automatically.

## Manual installation

Every npm package and source checkout includes ready-to-copy files under `presets/<id>/agents/` and `presets/<id>/skills/`. Copy every TOML from the selected preset into `CODEX_HOME/agents/` for a global installation or `<project>/.codex/agents/` for a project installation, then merge the snippet into the matching `config.toml`. Copy the `skills/<name>/` directories into `$HOME/.agents/skills/` globally or `<project>/.agents/skills/` for one repository. In both scopes, `config_file = "agents/<role>.toml"` resolves relative to the config file that declares the role, as specified by the [Codex Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference). Preserve UTF-8 encoding, BOM state, and line endings, and make backups first.

The CLI follows the same layout. Use `--scope global` for the global location or `--scope project` from a project root; use `--codex-home DIR` only when an explicit location is needed.

Do not place inactive legacy presets under `CODEX_HOME/agents/`: Codex recursively discovers TOML roles there. Store inactive copies under `CODEX_HOME/agent-presets/` instead.

## Preset lifecycle

Preset IDs are immutable. `latest` and `recommended` are movable aliases defined in `presets/aliases.json`; the CLI always displays the resolved immutable ID before writing. There is no automatic model fallback. Each preset ships its own agent TOMLs, config snippet, manifest, and Skill files.

## Coordination model

The root Codex agent owns the user request and final verification. Council and Orchestrator are peer child coordinators:

- `council` identifies the expertise needed, selects matching installed custom agents by description, and asks those direct child experts for independent feasibility, risk, and solution perspectives.
- `orchestrator` receives an agreed approach and implements it through the five fixed Slim specialists: `oracle`, `librarian`, `explorer`, `designer`, and `fixer`.

Council and Orchestrator never spawn each other. With `agents.max_depth = 2`, their selected experts are grandchildren of the root and cannot delegate again. Additional domain experts such as backend, security, database, Docker, CI/CD, or UI/UX agents can be installed as normal TOMLs under `.codex/agents/` or `CODEX_HOME/agents/`; Council selects only Root-approved advisory agents from the available descriptions. Council-member TOMLs should use `sandbox_mode = "read-only"`, and hard read-only deliberation also requires the parent turn to run with read-only permissions because Codex reapplies live permission overrides to subagents.

See [Slim Codex architecture](docs/slim-codex-architecture.md) for the runtime graph, versioned role sources, and skill boundary.

See [Council expert agents](docs/council-expert-agents.md) for the minimal read-only custom-agent TOML, model inheritance policy, and the parent-permission limitation.

Each preset bundles its own Skill files under `presets/<id>/skills/`. `install` or `switch-preset` deploys the active preset's Skills to the selected Skill scope. Start a new Codex task after installation.

To add a new generation, follow the [Adding a model preset maintenance guide](docs/adding-a-preset.md).

## Commands

- `list-presets`
- `convert --preset ID --output DIR`
- `convert --all --output DIR`
- `convert --all --output DIR --check`
- `validate --path DIR [--preset ID]`
- `validate --codex-home DIR --skills-home DIR [--preset ID]`
- `install --preset ID [--scope global|project] [--codex-home DIR] [--skills-home DIR] [--yes]`
- `switch-preset --preset ID [--scope global|project] [--codex-home DIR] [--skills-home DIR] [--yes]`

`convert --check` is non-mutating and fails when generated agent TOMLs, `config.snippet.toml`, manifests, aliases, or Skill files differ from the committed snapshots. `validate --preset ID` compares parsed role semantics with the selected generator source; `validate --codex-home DIR` also resolves installed `agents/<role>.toml` paths from that directory's `config.toml` and requires `--skills-home DIR` so the exact packaged managed Skills cannot be skipped silently. Portable role files keep reviewed MCP denylists in `developer_instructions` and emit no partial `mcp_servers` tables, because standalone parsing and parent transport merging make partial or dummy transports invalid. `switch-preset` backs up the config before changing live agents or Skills, archives existing managed role files and managed Skills under `agent-presets/slim-agents-for-codex/`, removes inactive managed roles such as Observer, replaces only the managed Slim Skills from the active preset, preserves unrelated custom roles and Skills, and post-validates the installation. These checks do not prove model entitlement or hard MCP isolation. Start a new Codex task after changing agent configuration.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

Requires Node.js 20 or newer.

## Maintenance status

This is a community, experimental project maintained on an as-needed basis. It does not promise immediate support for every new Codex model or configuration change. Preset IDs remain immutable: future model mappings should be added as new preset directories instead of replacing historical presets.

The package is intentionally marked private to prevent accidental publication to the npm registry. `npm pack` and installation from the resulting `.tgz` remain supported.
