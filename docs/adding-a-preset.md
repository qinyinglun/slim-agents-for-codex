# Adding a Model Preset

English | [简体中文](adding-a-preset.zh-CN.md)

This guide explains how to add a new Codex preset when a new upstream configuration is available. It uses `openai-5.7` as an example.

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

For a model-only generation, keep the reviewed role source. Its matching versioned Skill source under `skill-sources/<sourceVersion>/` supplies the new snapshot. Installation always uses the selected preset's own packaged Skill files.

## 3. Add the preset mapping

Edit `src/core/presets.ts`: record the exact upstream model and effort choices in a new, explicit `modelProfiles` entry, then declare each new preset with its immutable ID, role source, and creation date:

```ts
// In modelProfiles:
"openai-5.7": mapping({
  orchestrator: ["actual-upstream-model", "actual-effort"],
  oracle: ["actual-upstream-model", "actual-effort"],
  librarian: ["actual-upstream-model", "actual-effort"],
  explorer: ["actual-upstream-model", "actual-effort"],
  designer: ["actual-upstream-model", "actual-effort"],
  fixer: ["actual-upstream-model", "actual-effort"],
  council: ["reviewed-Codex-adaptation-model", "actual-effort"],
}),

// In presets:
"openai-5.7-en": definePreset("openai-5.7-en", "slim-codex-2026-07", "YYYY-MM-DD", modelProfiles["openai-5.7"]),
"openai-5.7-zh": definePreset("openai-5.7-zh", "slim-codex-2026-07-zh", "YYYY-MM-DD", modelProfiles["openai-5.7"]),
"openai-5.7-zh-nodesigner": definePreset(
  "openai-5.7-zh-nodesigner", "slim-codex-2026-07-zh-no-designer", "YYYY-MM-DD",
  withoutDesigner(modelProfiles["openai-5.7"]),
),
```

For a new role contract, first version the role source and create its matching `skill-sources/<sourceVersion>/` directory with `SKILL.md` and `agents/openai.yaml` for each managed Skill. Never edit generated files under `presets/<id>/agents/` directly.

Update the aliases in the same file if this preset should become the default.

## 4. Generate the TOML snapshot

```bash
npm run build
node dist/cli.js convert --all --output presets
```

The result should contain:

```text
presets/openai-5.7-en/
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
node dist/cli.js validate --path presets/openai-5.7-en/agents --preset openai-5.7-en
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
src/core/role-sources/
├── slim-codex-2026-07/
│   └── index.ts
└── slim-codex-YYYY-MM/
    └── index.ts

skill-sources/
├── slim-codex-2026-07/
│   └── slim-orchestration/SKILL.md
└── slim-codex-YYYY-MM/
    └── slim-orchestration/SKILL.md
```

Each preset manifest should reference a specific role-source version. Add regression coverage for historical presets.
