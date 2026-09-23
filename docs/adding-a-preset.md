# Adding a Model Preset

English | [简体中文](adding-a-preset.zh-CN.md)

This guide explains how to add a new Codex preset when a new upstream configuration is available. It uses `openai-6` as an example.

## Determine the type of change

- If only model names and reasoning effort values changed, add a new preset directly.
- If role prompts, the role list, or role behavior changed, version the role definitions first.
- If the existing Codex translation is incorrect across presets, fix the shared generator, regenerate every affected snapshot, and release the correction as a new package version without moving old tags.

Published model mappings and manifests must remain reproducible. Adding a new generation must not rewrite or delete them.

## 1. Prepare a working copy

```bash
git clone https://github.com/qinyinglun/slim-agents-for-codex.git
cd slim-agents-for-codex
npm ci
```

## 2. Review the upstream configuration

Record the upstream commit, model-to-role mapping, reasoning effort, any prompt or role-list changes, and whether Codex supports the mapped model names. Do not infer model names from version numbers.

For a model-only generation that reuses the reviewed Skill files, set `skillSourcePreset` to the immutable preset that owns those files. `convert` then copies that source into the new immutable snapshot; installation always uses the selected snapshot's own files.

## 3. Add the preset mapping

Edit `src/core/presets.ts` and add a mapping:

```ts
"openai-5.7": {
  id: "openai-5.7",
  adapter: "oh-my-opencode-slim",
  adapterSchemaVersion: 2,
  source: "alvinunreal/oh-my-opencode-slim",
  sourceVersion: "slim-codex-2026-07",
  created: "YYYY-MM-DD",
  status: "supported",
  snapshotFormatVersion: 1,
  models: mapping({
    orchestrator: ["actual-model-name", "medium"],
    oracle: ["actual-model-name", "high"],
    librarian: ["actual-model-name", "low"],
    explorer: ["actual-model-name", "low"],
    designer: ["actual-model-name", "medium"],
    fixer: ["actual-model-name", "medium"],
    council: ["actual-model-name", "high"],
  }),
  skillNames: managedSkillNames,
},
```

If a preset should omit a role (e.g. no designer for server-side), use a role source that excludes that role and omit it from `models`:

```ts
"openai-5.7-server": {
  id: "openai-5.7-server",
  adapter: "oh-my-opencode-slim",
  adapterSchemaVersion: 2,
  source: "alvinunreal/oh-my-opencode-slim",
  sourceVersion: "slim-codex-2026-07-server",
  created: "YYYY-MM-DD",
  status: "supported",
  snapshotFormatVersion: 1,
  models: mapping({
    orchestrator: ["actual-model-name", "medium"],
    oracle: ["actual-model-name", "high"],
    librarian: ["actual-model-name", "low"],
    explorer: ["actual-model-name", "low"],
    fixer: ["actual-model-name", "medium"],
    council: ["actual-model-name", "high"],
  }),
  skillNames: managedSkillNames,
},
```

If the preset needs different Skill content (e.g. removing designer references from the orchestration skill for a server-only preset), create a `skills/<name>/` directory under the preset output directory with an adapted `SKILL.md` and `agents/openai.yaml`. The `skillNames` field declares which Skill directories the preset ships.

Update the aliases in the same file if this preset should become the default.

## 4. Generate the TOML snapshot

```bash
npm run build
node dist/cli.js convert --all --output presets
```

The result should contain:

```text
presets/openai-5.7/
├── agents/
│   ├── orchestrator.toml
│   ├── oracle.toml
│   ├── librarian.toml
│   ├── explorer.toml
│   ├── designer.toml
│   ├── fixer.toml
│   └── council.toml
├── skills/
│   ├── slim-council/
│   │   ├── SKILL.md
│   │   └── agents/openai.yaml
│   └── slim-orchestration/
│       ├── SKILL.md
│       └── agents/openai.yaml
├── config.snippet.toml
└── manifest.json
```

## 5. Verify the preset

```bash
node dist/cli.js validate --path presets/openai-5.7/agents --preset openai-5.7
node dist/cli.js convert --all --output presets --check
npm test
npm run typecheck
npm run build
npm run snapshots
npm pack --dry-run
```

Verify that:

- The new preset contains exactly the roles declared by its versioned role source.
- All historical presets remain present and unchanged.
- Skill files are properly bundled and validated.
- Exact snapshot and semantic validation are not proof of model entitlement.

## 6. Update the project version

Update `package.json` and `package-lock.json` according to the scope of the change. Update the Release package filename in the READMEs.

## When prompts or roles change

Version the role sources before adding a new preset, for example:

```text
src/adapters/oh-my-opencode-slim/
├── reviewed-2026-07/
│   └── roles.ts
└── reviewed-YYYY-MM/
    └── roles.ts
```

Each preset manifest should reference a specific role-source version. Add regression coverage for historical presets.
