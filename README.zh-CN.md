# slim-agents-for-codex

简体中文 | [English](README.md)

基于 [alvinunreal/oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim) 改编的确定性、经审查的 Codex agent 预设。原始角色概念和行为是该项目的成果；本仓库提供针对 Codex 的转换适配。本社区项目与 OpenAI 或上游项目没有隶属关系。

特别感谢 **alvinunreal/oh-my-opencode-slim** 提供的上游 Deepwork 工作流、Council 模式以及本适配所基于的角色系统设计。

关于 subagent 工作流、自定义 agent TOML、模型与推理设置以及全局 `[agents]` 控制的官方指南，请参见 [Subagents | ChatGPT Learn](https://learn.chatgpt.com/docs/agent-configuration/subagents)。

## 快速开始

本项目通过 GitHub 发布，不会上架 npm Registry。

### 安装 GitHub Release 包

从对应的 GitHub Release 下载 `slim-agents-for-codex-0.2.0.tgz`。先安装该包以提供 CLI：

```bash
npm install --global ./slim-agents-for-codex-0.2.0.tgz
```

此步骤只安装 `slim-agents-codex` CLI，**不会**创建任何 Codex agent 文件。请单独应用 preset：

```bash
slim-agents-codex list-presets
slim-agents-codex install --preset latest --scope global --yes
```

如果已安装任一 Slim preset，请改用 `slim-agents-codex switch-preset --preset latest --scope global`。切换时会先归档将被替换的受管 agents 与 Skills，再对新安装执行后验证。普通的 `install` 会在覆盖受管角色前停止。

### 从源代码运行

```bash
npm ci
npm run build
node dist/cli.js list-presets
node dist/cli.js install --preset latest --scope global --yes
```

`install` 在写入前会显示实际解析的固定版本、配置文件路径、Skill 路径和备份路径，并要求确认；它会同时安装选定的 agent preset 与两个受管 Slim Skills。使用 `--scope global` 时，agent 文件写入设置了 `CODEX_HOME` 时的 `$CODEX_HOME/agents`，否则写入 `~/.codex/agents`；Skills 写入 `$HOME/.agents/skills`。使用 `--scope project` 时，agent 文件写入 `<current-project>/.codex/agents`，Skills 写入 `<current-project>/.agents/skills`。明确提供的 `--codex-home PATH` 和 `--skills-home PATH` 选项会覆盖对应目标。`config:` 和 `installed ... at ...` 输出行是实际目标路径的权威依据。仅在明确需要非交互式安装时使用 `--yes`。

如果文件出现在意外的位置，请检查 `echo "$CODEX_HOME"`，并以 CLI 打印的路径为准。在 `sudo` 下、容器内或以不同 shell 用户运行时，`~` 可能不同，因而安装目标也会改变。

可用 presets：

- `openai-6-en` — 英文提示词和 Skills（默认、推荐），7 个角色含 designer；Oracle/Council 使用 Astra，Orchestrator 使用 Sol，专家通道使用 Luna
- `openai-6-zh` — 中文（简体）提示词和 Skills，7 个角色，采用相同的分层模型映射
- `openai-6-zh-nodesigner` — 中文（简体）提示词和 Skills，6 个角色不含 designer（服务端场景），采用相同的分层模型映射
- `openai-5.6-en` — 英文提示词和 Skills，7 个角色含 designer
- `openai-5.6-zh` — 中文（简体）提示词和 Skills，7 个角色含 designer
- `openai-5.6-zh-nodesigner` — 中文（简体）提示词和 Skills，6 个角色不含 designer（服务端场景）

预设特定的 Skill 文件打包在每个 preset 目录下，安装时自动部署。

GPT-6 模型是否可用取决于所使用的 Codex 账号或 API 凭据；安装器验证包完整性和配置，不验证模型权限。

GPT-5.6 presets 与上游 OpenAI 映射保持一致：Orchestrator 使用 `gpt-5.6-terra/high`；Oracle 和 Codex 新增的 Council 适配使用 `gpt-5.6-sol/high`；Librarian、Explorer 使用 `gpt-5.6-luna/low`；Designer 使用 Luna/medium；Fixer 使用 Luna/high。GPT-6 遵循[上游 OpenAI preset](https://github.com/alvinunreal/oh-my-opencode-slim/blob/aab1e48e5fc4b44b2dbc4187142f565b1aa01f62/docs/openai-preset.md)：Orchestrator 使用 `gpt-6-sol/high`，Oracle 和本项目新增的 Council 使用 `gpt-6-astra/high`，Librarian/Explorer 使用 `gpt-6-luna/low`，Designer 使用 Luna/medium，Fixer 使用 Luna/high。

## 手动安装

每个 npm 包和源代码检出都包含可直接复制的文件，位于 `presets/<id>/agents/` 和 `presets/<id>/skills/` 下。全局安装时，若设置了 `CODEX_HOME`，将选定 preset 的所有 TOML 复制到 `$CODEX_HOME/agents/`，否则复制到 `~/.codex/agents/`；项目安装时复制到 `<project>/.codex/agents/`。然后将 snippet 合并到对应的 `config.toml`。将 `skills/<name>/` 目录复制到 `$HOME/.agents/skills/`（全局）或 `<project>/.agents/skills/`（项目）。两种 scope 都使用 `config_file = "agents/<role>.toml"`，由声明角色的 config 文件所在位置解析。保留原始 UTF-8 编码、BOM 状态和换行格式，并先做备份。

CLI 遵循相同的布局。全局位置使用 `--scope global`，在项目根目录使用 `--scope project`；仅在需要明确指定其他位置时使用 `--codex-home DIR`。

不要把未启用的旧版预设放在 `CODEX_HOME/agents/` 下，因为 Codex 会递归发现其中的 TOML 角色。请将非活跃版本存放在 `CODEX_HOME/agent-presets/` 下。

## 预设生命周期

预设 ID 不可变。`latest` 和 `recommended` 是定义在 `presets/aliases.json` 中的可移动别名；CLI 在写入前始终显示解析后的固定 ID。没有自动模型回退。每个预设自包含其 agent TOML、配置片段、清单和 Skill 文件。

## 协调架构

Root Codex agent 负责用户需求和最终验证。Council 和 Orchestrator 是同级的子协调器：

- `council` 判断所需专业知识，根据描述选择匹配的已安装自定义 agent，并让这些直接子专家分别评估可行性、风险和解决方案。
- `orchestrator` 接收已确定的方案，通过五个固定的 Slim 专家实现：`oracle`、`librarian`、`explorer`、`designer`、`fixer`。

Council 和 Orchestrator 不会互相调用。在 `agents.max_depth = 2` 时，它们选出的专家是 Root 的孙代理，不能再继续委派。后端、安全、数据库、Docker、CI/CD、UI/UX 等额外专家可作为普通 TOML 安装在 `.codex/agents/` 或 `CODEX_HOME/agents/` 下；Council 仅从 Root 预先批准的顾问 agent 描述中选择。Council 成员 TOML 应设置 `sandbox_mode = "read-only"`；若需要强制的只读隔离，父轮次也必须使用只读权限，因为 Codex 会将实时权限覆盖应用到子代理。

详细运行图、版本化角色来源和 Skill 边界请参见 [Slim Codex 架构](docs/slim-codex-architecture.md)。

Council 专用的只读自定义 agent TOML、模型继承策略和父权限限制请参见 [Council 专家代理](docs/council-expert-agents.md)。

快速分析逻辑时，可直接说：“仅调用 `oracle` 子代理只读分析 `<模块或现象>`，给出调用链、状态变化、边界条件、结论和文件行号。”若调用路径尚不明确，先让 `explorer` 定位。

带版本的 Skill 维护源位于 `skill-sources/<sourceVersion>/`；每个 preset 仍在 `presets/<id>/skills/` 下自带完整副本。`install` 或 `switch-preset` 将活动 preset 的 Skills 部署到选定的 Skill scope。安装后请开启新的 Codex 任务。

角色 MCP denylist 是按 server ID 编写的可移植行为指引。某个 ID 若未安装在本机，就不会产生实际作用；安装器不会根据个人 MCP 连接自动添加禁用项。这不是强制的 MCP 隔离。

需要新增新一代时，请参考[新增模型预设维护指南](docs/adding-a-preset.md)。

## 命令

- `list-presets`
- `convert --preset ID --output DIR`
- `convert --all --output DIR`
- `convert --all --output DIR --check`
- `validate --path DIR [--preset ID]`
- `validate --codex-home DIR --skills-home DIR [--preset ID]`
- `install --preset ID [--scope global|project] [--codex-home DIR] [--skills-home DIR] [--yes]`
- `switch-preset --preset ID [--scope global|project] [--codex-home DIR] [--skills-home DIR] [--yes]`

`convert --check` 不会写文件；只要生成的 agent TOML、`config.snippet.toml`、manifest、aliases 或 Skill 文件与已提交的 snapshot 不同就会失败。`validate --preset ID` 将解析后的角色语义与指定的生成器源进行比较；`validate --codex-home DIR` 还会从该目录的 `config.toml` 解析已安装的 `agents/<role>.toml`，并要求提供 `--skills-home DIR`，以避免静默跳过包内受管 Skills 的精确验证。可移植角色文件将经审查的 MCP denylist 放在 `developer_instructions` 中，不生成局部的 `mcp_servers` 表，因为独立解析和父传输合并会使部分或虚拟传输无效。`switch-preset` 会先备份 config，再更改活动的 agents 或 Skills；它会将现有受管角色文件和受管 Skills 归档到 `agent-presets/slim-agents-for-codex/` 下，移除 Observer 等已停用的受管角色，仅替换来自活动 preset 的受管 Slim Skills，保留无关的自定义角色和 Skills，最后再验证安装结果。这些检查不代表用户账户一定拥有指定模型的权限或硬性的 MCP 隔离。更改 agent 配置后，请开启新的 Codex 任务。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

需要 Node.js 20 或更高版本。

## 维护状态

这是一个按需维护的社区实验性项目，不承诺立即支持每个新的 Codex 模型或配置更改。预设 ID 不可变：未来的模型映射应作为新的预设目录添加，而不是替换历史预设。

该包已特意标记为 private，以防止意外发布到 npm Registry。`npm pack` 和从生成的 `.tgz` 安装仍然支持。
