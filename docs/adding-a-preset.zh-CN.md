# 新增模型预设维护指南

[English](adding-a-preset.md) | 简体中文

本文档说明如何在本项目创建新的 Codex preset。以下以 `openai-5.7` 为例。

## 先确认变更类型

- 若只有模型名称和 reasoning effort 改变，可直接新增 preset。
- 若角色提示词、角色数量或行为改变，应先对角色定义进行版本化。
- 若既有 Codex 转换规则对所有 preset 都有错误，应修正共享 generator、重新生成所有受影响的 snapshot，并以新的包版本发布，不得移动旧 tag。

已发布的模型映射和 manifest 必须保持可重现，不因新增版本而被改写或删除。

## 1. 准备工作目录

```bash
git clone https://github.com/qinyinglun/slim-agents-for-codex.git
cd slim-agents-for-codex
npm ci
```

## 2. 审核上游配置

记录上游 commit、模型到角色的映射、reasoning effort、任何提示词或角色列表的变更，以及 Codex 是否支持映射后的模型名称。不要根据版本号猜测模型名称。

## 3. 新增 preset 映射

编辑 `src/core/presets.ts`，加入映射：

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
    orchestrator: ["实际模型名称", "medium"],
    oracle: ["实际模型名称", "high"],
    librarian: ["实际模型名称", "low"],
    explorer: ["实际模型名称", "low"],
    designer: ["实际模型名称", "medium"],
    fixer: ["实际模型名称", "medium"],
    council: ["实际模型名称", "high"],
  }),
  skillNames: managedSkillNames,
},
```

如果 preset 需要不同的 Skill 内容，在 preset 输出目录下创建 `skills/<name>/` 目录，包含 `SKILL.md` 和 `agents/openai.yaml`。`skillNames` 字段声明该 preset 包含哪些 Skill 目录。

如果此 preset 应成为默认版本，在同一文件中更新别名。

## 4. 生成 TOML snapshot

```bash
npm run build
node dist/cli.js convert --all --output presets
```

结果应包含：

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

## 5. 验证

```bash
node dist/cli.js validate --path presets/openai-5.7/agents --preset openai-5.7
node dist/cli.js convert --all --output presets --check
npm test
npm run typecheck
npm run build
npm run snapshots
npm pack --dry-run
```

验证要点：

- 新版精确包含版本化角色来源声明的全部角色。
- 所有历史 preset 仍然存在且未改变。
- Skill 文件正确打包并通过验证。
- 精确 snapshot 和语义验证成功不代表用户一定具备模型权限。

## 6. 更新项目版本

根据变更范围更新 `package.json` 和 `package-lock.json`。同步更新 README 中的 Release 包文件名。

## 当提示词或角色变更时

在新增 preset 之前先版本化角色来源，例如：

```text
src/adapters/oh-my-opencode-slim/
├── reviewed-2026-07/
│   └── roles.ts
└── reviewed-YYYY-MM/
    └── roles.ts
```

每个 preset manifest 应指向具体的角色来源版本。为历史 preset 添加回归测试。
