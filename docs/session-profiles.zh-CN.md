# GPT-6 会话预设：bal / pro

[English](session-profiles.md) · [返回 README](../README.zh-CN.md)

`bal` 面向日常开发，`pro` 面向复杂任务。它们通过 Codex 命名 Profile 为不同会话选择 Root 和子代理模型，不覆盖共享的活动预设。`pro` 是本地配置名，与订阅套餐无关。

仅维护 GPT-6 的这两套会话配置；GPT-5.6 历史预设不参与本功能，也不更改。两套均为简体中文、六个 Slim 角色、无 Designer。

## 模型分配

| 角色 | bal（日常） | pro（复杂任务） |
| --- | --- | --- |
| Root | `gpt-6.1-sol/high` | `gpt-6-astra/high` |
| Orchestrator | `gpt-6.1-sol/high` | `gpt-6.1-sol/high` |
| Oracle | `gpt-6-astra/high` | `gpt-6-astra/high` |
| Council | `gpt-6-astra/high` | `gpt-6-astra/high` |
| Fixer | `gpt-6.1-terra/high` | `gpt-6.1-sol/high` |
| Explorer | `gpt-6-luna/low` | `gpt-6-luna/low` |
| Librarian | `gpt-6-luna/low` | `gpt-6-luna/low` |

`bal` 使用 `openai-6.1-bal-zh-nodesigner`；`pro` 使用 `openai-6-pro-zh-nodesigner`。二者共享原有版本化角色指令与 Skills，只有模型分配不同。Root 由 Profile 设置，不属于预设的子角色。

2026-10-27 起，`bal` 的 Fixer 从 Luna/high 更新为 GPT-6.1 Terra/high，其余角色不变。更新旧版 `bal` 可运行 `bun dist/cli.js install-profiles --profile bal`；安装器识别旧的受管预设并在更新前备份。旧 `openai-6-zh-nodesigner` 快照保留，`pro` 和基础活动预设不受影响。Terra 适合范围明确的代码修复，但实际质量和用量需以任务验证；账号需要有该模型权限，不会自动回退到 Luna。

## 安装或更新

要求 Bun、Node.js 20+ 和支持文件型 Profile 的 Codex。官方说明 Codex 0.134.0 起使用 `<名称>.config.toml`；本功能在 Codex CLI 0.163.0 上验证。

从当前源代码安装：

```bash
bun install
bun run build
bun dist/cli.js install-profiles
```

命令先显示目标，再交互确认。已有同名受管 Profile 会更新并备份。需要非交互安装时：

```bash
bun dist/cli.js install-profiles --yes
```

只安装或更新一套：

```bash
bun dist/cli.js install-profiles --profile pro
```

若需直接使用 `slim-agents-codex` 命令，可在构建后运行 `bun link`，并确保 Bun 的 bin 目录在 PATH 中。链接指向当前检出，后续源码更新后需要重新构建。

使用包含本功能的本地包时，可以 `bun add --global ./slim-agents-for-codex-<版本>.tgz`，再执行 `slim-agents-codex install-profiles`。旧版发布包未必包含该命令；以 `--help` 为准。

指定其他目标：

```bash
bun dist/cli.js install-profiles \
  --codex-home /absolute/codex-home \
  --skills-home /absolute/shared-skills
```

默认 Codex home 为环境变量 `CODEX_HOME` 指定目录，否则为 `~/.codex`；默认 Skills 为 `~/.agents/skills`。自定义 `--skills-home` 只是安装目的地，还需自行保证 Codex 能发现该目录。Profile 属于用户配置层，不接受 `--scope project` 或 `--preset`。

## 启动、并行与继续会话

```bash
codex -p bal
codex -p pro
```

在两个终端中分别运行，即可并行使用两套配置。启动时选择 Profile 不会更改全局默认值；直接运行 `codex` 仍采用原来的配置。

一次性执行任务：

```bash
codex exec -p bal "分析当前模块的调用关系"
codex exec -p pro "修复当前模块的问题并验证"
```

继续已有会话时显式选择预设，例如 `codex -p pro resume <会话ID>`。这会继续原有上下文，而不是创建一段空白对话。升级配置后，优先开启新任务以重新加载代理配置；不要假定已运行的子代理会自动换模型。

Root 需要临时换模型时，可在启动时额外提供 `-m`，例如 `codex -p bal -m gpt-6-astra`。这不代表 Fixer、Oracle 等显式配置模型的子代理也会改变。

## 如何调用子代理

两套配置中的角色名完全相同：

- 快速定位：“调用 explorer 定位订单状态更新入口，给出文件和行号。”
- 分析逻辑：“调用 oracle 只读分析订单状态流转，列出调用链、边界条件和证据。”
- 有限实现：“调用 fixer 按以下明确规范修改，运行相关检查并报告结果。”
- 多视角决策：“调用 council 比较方案，保留分歧并提供建议。”
- 执行编排：“方案已确认，调用 orchestrator 拆解执行、协调专家并汇总验证结果。”

Root 负责需求、方案审批和最终验收。Council 与 Orchestrator 是同级子协调器，不互相调用。不要为了形式完整，每次都调用所有角色。

## 文件布局与更新规则

```text
~/.codex/
├── config.toml                         # 保留原样
├── agents/                             # 现有活动角色保留原样
├── bal.config.toml
├── pro.config.toml
└── agent-presets/slim-agents-for-codex/profiles/
    ├── bal/
    │   ├── manifest.json
    │   └── agents/*.toml
    └── pro/
        ├── manifest.json
        └── agents/*.toml
```

Profile 使用安装时生成的绝对路径引用各自角色。移动 Codex home 后应重新运行安装命令。Profile 目录位于自动发现目录之外，避免把两套同名角色同时注册。

两个 Slim Skills 安装到共享目录中。已有内容完全一致时复用；若发现缺失文件或用户修改导致的漂移，安装会在写入任何 Profile 前停止，不会覆盖这些 Skills。先检查差异，并将需要保留的版本移到备份位置，再恢复与当前角色源一致的共享 Skills。

`install-profiles` 在写入前检查整套选择，并备份已有的受管 Profile 文件和角色目录。已有非 Slim 管理的 `bal.config.toml` / `pro.config.toml` 会触发冲突，必须先重命名。生成的 Profile 文件属于受管产物，重新安装会覆盖手动修改，旧内容可从备份恢复。

备份位置会在命令输出中列出：配置在 `<名称>.config.toml.backup-*`；角色在对应的 `<名称>.backup-*` 目录。此功能不改变基础配置、MCP 连接或其他自定义角色，不执行发布、版本递增或 Git 推送。

## 验证与排错

结构及内容校验：

```bash
bun dist/cli.js validate --profile bal --codex-home /root/.codex --skills-home /root/.agents/skills
bun dist/cli.js validate --profile pro --codex-home /root/.codex --skills-home /root/.agents/skills
```

将示例路径改为自己的目标。校验包括 Root 模型、全部角色路径、六角色集合、角色文件、manifest 和共享 Skills。

验证 Codex 实际加载的模型分配：

```bash
bun run profiles:check
# 自定义 Codex home：
bun run profiles:check /absolute/codex-home
```

脚本运行真实 `codex -p <名称> exec`，将请求发送到本机临时 HTTP 接收器并主动返回错误，检查 Root 与子代理模型/强度，然后退出。不会执行模型推理或派生子代理，不验证账号模型权限。请求仅保存在内存中，不打印提示词或凭据。它临时禁用基础配置中声明的 MCP 和应用/插件/记忆功能；请在没有额外项目 Hook 或项目 MCP 的可信目录运行，因为它仍会加载项目配置。

如结果与预期不同，在会话中查看 `/debug-config`。常见原因：

| 现象 | 排查方向 |
| --- | --- |
| Root 模型不对 | CLI 的 `-m`、项目配置优先于 Profile |
| Fixer 仍是 Luna | 当前 `bal` 应为 Terra、`pro` 应为 Sol；更新旧 `bal`，检查角色绝对路径与项目同名角色 |
| 意外出现 Designer | 基础配置或自动发现目录是否残留 Designer；本功能不删除其他角色 |
| 只有部分新设置生效 | 开启新 Codex 任务，并重新创建需要更新的子代理 |
| Profile 无法找到 | 检查 `CODEX_HOME`、运行用户、文件名和 Codex 版本 |
| Skills 漂移 | 比较共享 Skills 与选定预设，先备份再处理冲突 |
| 桌面端没有切换入口 | 本方案明确支持 CLI；不承诺桌面端具有逐会话 Profile 选择器 |

配置优先级中，CLI 覆盖和受信任项目配置高于 Profile，Profile 高于用户基础配置。Profile 是覆盖层，其他全局或项目自定义角色仍可能可用。MCP、提供商和权限继承父会话；不要把只读角色文字当作独立只读沙箱。

不同 Profile 不隔离仓库文件、Git 工作区、共享 Skills 或会话历史。并行修改代码应划分责任，或使用不同 worktree；本功能不复制仓库。

## 回滚与停用

停用最简单的方法是启动时不加 `-p bal` / `-p pro`，基础配置未被更改。

回滚更新时，先关闭使用该配置的会话，将当前 `<名称>.config.toml` 和角色目录移到另一个备份位置，再将安装输出中的对应配置备份与角色目录备份成对恢复到原位置。重新运行 `validate --profile ...` 后开启新任务。不要只恢复配置却保留不匹配的角色文件；备份中的配置绝对路径仍指向原角色目录。

若只想移除本功能，可在确认不再使用后，将这两个 Profile 文件和 `agent-presets/slim-agents-for-codex/profiles/{bal,pro}` 移到归档目录。共享 Skills 可能仍被基础预设使用，应保留。

## 维护入口

- `src/core/presets.ts`：两套会话映射与新增 pro 模型预设。
- `src/core/profiles.ts`：Profile 生成、安装、备份、验证。
- `src/core/role-sources/`：共享角色指令，新增模型分配无需复制指令。
- `skill-sources/`：共享版本化 Skills。
- `scripts/verify-session-profiles.mjs`：无推理的 Codex 加载检查。

官方依据：[Profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles)、[配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)、[Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)。
