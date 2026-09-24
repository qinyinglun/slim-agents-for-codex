import { slimCodex202607RoleSource } from "./role-sources/slim-codex-2026-07/index.js";
import { slimCodex202607ZhRoleSource } from "./role-sources/slim-codex-2026-07-zh/index.js";
import { slimCodex202607ZhNoDesignerRoleSource } from "./role-sources/slim-codex-2026-07-zh-no-designer/index.js";
import type { Effort, Role, RoleSource } from "./role-sources/types.js";

export type { Effort, Role } from "./role-sources/types.js";

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export const managedSkillNames = ["slim-council", "slim-orchestration"] as const;

export interface Preset {
  id: string;
  adapter: "oh-my-opencode-slim";
  adapterSchemaVersion: 1 | 2;
  source: "alvinunreal/oh-my-opencode-slim";
  sourceVersion: string;
  created: string;
  status: "supported" | "deprecated";
  snapshotFormatVersion: 1;
  models: Record<string, { model: string; effort: Effort }>;
  mcpServers?: Record<string, McpServerConfig>;
  skillNames?: readonly string[];
}

const roleSources: Record<string, RoleSource> = {
  [slimCodex202607RoleSource.id]: slimCodex202607RoleSource,
  [slimCodex202607ZhRoleSource.id]: slimCodex202607ZhRoleSource,
  [slimCodex202607ZhNoDesignerRoleSource.id]: slimCodex202607ZhNoDesignerRoleSource,
};

const mapping = (pairs: Record<string, [string, Effort]>): Preset["models"] => Object.fromEntries(Object.entries(pairs).map(([name, [model, effort]]) => [name, { model, effort }]));

// Keep published model generations explicit. Never derive model IDs from a version string.
const modelProfiles = {
  "openai-5.6": mapping({
    orchestrator: ["gpt-5.6-terra", "high"],
    oracle: ["gpt-5.6-sol", "high"],
    librarian: ["gpt-5.6-luna", "low"],
    explorer: ["gpt-5.6-luna", "low"],
    designer: ["gpt-5.6-luna", "medium"],
    fixer: ["gpt-5.6-luna", "high"],
    council: ["gpt-5.6-sol", "high"],
  }),
  // Upstream OpenAI preset at alvinunreal/oh-my-opencode-slim@aab1e48 (2026-09-23).
  // Council is this Codex adapter's additional advisory role.
  "openai-6": mapping({
    orchestrator: ["gpt-6-sol", "high"],
    oracle: ["gpt-6-astra", "high"],
    librarian: ["gpt-6-luna", "low"],
    explorer: ["gpt-6-luna", "low"],
    designer: ["gpt-6-luna", "medium"],
    fixer: ["gpt-6-luna", "high"],
    council: ["gpt-6-astra", "high"],
  }),
} as const;

const withoutDesigner = (models: Preset["models"]): Preset["models"] => {
  const { designer: _designer, ...rest } = models;
  return rest;
};

const commonMcpServers: Record<string, McpServerConfig> = {
  context7: { command: "npx", args: ["-y", "@context7/context7-server"] },
};

function definePreset(id: string, sourceVersion: string, created: string, models: Preset["models"]): Preset {
  return {
    id,
    adapter: "oh-my-opencode-slim",
    adapterSchemaVersion: 2,
    source: "alvinunreal/oh-my-opencode-slim",
    sourceVersion,
    created,
    status: "supported",
    snapshotFormatVersion: 1,
    models,
    mcpServers: commonMcpServers,
    skillNames: managedSkillNames,
  };
}

export const presets: Record<string, Preset> = {
  "openai-5.6-en": definePreset("openai-5.6-en", "slim-codex-2026-07", "2026-07-14", modelProfiles["openai-5.6"]),
  "openai-5.6-zh": definePreset("openai-5.6-zh", "slim-codex-2026-07-zh", "2026-07-26", modelProfiles["openai-5.6"]),
  "openai-5.6-zh-nodesigner": definePreset("openai-5.6-zh-nodesigner", "slim-codex-2026-07-zh-no-designer", "2026-07-26", withoutDesigner(modelProfiles["openai-5.6"])),
  "openai-6-en": definePreset("openai-6-en", "slim-codex-2026-07", "2026-09-21", modelProfiles["openai-6"]),
  "openai-6-zh": definePreset("openai-6-zh", "slim-codex-2026-07-zh", "2026-09-21", modelProfiles["openai-6"]),
  "openai-6-zh-nodesigner": definePreset("openai-6-zh-nodesigner", "slim-codex-2026-07-zh-no-designer", "2026-09-21", withoutDesigner(modelProfiles["openai-6"])),
};

export const aliases = { latest: "openai-6-en", recommended: "openai-6-en" } as const;
export const roles = slimCodex202607RoleSource.roles;
export const roleOrder = [...slimCodex202607RoleSource.roleOrder];
export const managedRoleNames = [...new Set(Object.values(roleSources).flatMap((source) => source.roleOrder))];

const disabledMcpsByRole: Record<string, readonly string[]> = {
  librarian: ["codegraph"],
  orchestrator: ["exa", "context7", "grep", "codegraph"],
  explorer: ["exa", "context7", "grep"],
  designer: ["exa", "context7", "grep"],
  oracle: ["context7", "grep"],
  fixer: ["context7", "grep"],
};

function sourceFor(preset: Preset): RoleSource {
  const source = roleSources[preset.sourceVersion];
  if (!source) throw new Error(`Unknown role source: ${preset.sourceVersion}`);
  return source;
}

export function resolvePreset(idOrAlias: string): Preset {
  const id = (aliases as Record<string, string>)[idOrAlias] ?? idOrAlias;
  const preset = presets[id];
  if (!preset) throw new Error(`Unknown preset: ${idOrAlias}`);
  const expected = [...sourceFor(preset).roleOrder].sort();
  const actual = Object.keys(preset.models).sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) throw new Error(`Preset ${id} must map exactly ${expected.length} roles from ${preset.sourceVersion}`);
  return preset;
}

const quote = (value: string) => JSON.stringify(value);
const multiline = (value: string) => `"""\n${value.replaceAll('"""', '\\"\\"\\"')}\n"""`;
const renderJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const renderMcpSection = (servers: Record<string, McpServerConfig>): string => {
  return '\n' + Object.entries(servers).map(([name, config]) => {
    const lines = [`[mcp_servers.${name}]`];
    lines.push(`command = ${quote(config.command)}`);
    if (config.args && config.args.length > 0) {
      const rendered = config.args.map((a) => quote(a)).join(", ");
      lines.push(`args = [${rendered}]`);
    }
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        lines.push(`${key} = ${quote(value)}`);
      }
    }
    return lines.join('\n');
  }).join('\n') + '\n';
};

export function renderAliases() {
  return renderJson(aliases);
}

export function generatePreset(idOrAlias: string) {
  const preset = resolvePreset(idOrAlias);
  const source = sourceFor(preset);
  const agents: Record<string, string> = {};
  for (const name of source.roleOrder) {
    const current = source.roles[name] as Role;
    const model = preset.models[name];
    const deniedMcps = [...(disabledMcpsByRole[name] ?? [])].sort();
    const mcpPolicy = deniedMcps.length > 0 ? `\n\nMCP denylist: ${deniedMcps.join(", ")}. Do not use these MCP servers in this role.` : "";
    agents[name] = `name = ${quote(current.name)}\ndescription = ${quote(current.description)}\nmodel = ${quote(model.model)}\nmodel_reasoning_effort = ${quote(model.effort)}\nsandbox_mode = ${quote(current.sandbox)}\ndeveloper_instructions = ${multiline(current.instructions + mcpPolicy)}\n`;
  }
  let snippet = `[agents]\nmax_concurrent_threads_per_session = 6\nmax_depth = 2\n\n` + source.roleOrder.map((name) => `[agents.${name}]\ndescription = ${quote(source.roles[name].description)}\nconfig_file = ${quote(`agents/${name}.toml`)}\n`).join("\n");
  if (preset.mcpServers && Object.keys(preset.mcpServers).length > 0) {
    snippet += renderMcpSection(preset.mcpServers);
  }
  const manifest = renderJson({
    id: preset.id,
    adapter: preset.adapter,
    adapterSchemaVersion: preset.adapterSchemaVersion,
    source: preset.source,
    sourceVersion: preset.sourceVersion,
    created: preset.created,
    status: preset.status,
    snapshotFormatVersion: preset.snapshotFormatVersion,
  });
  return { preset, roles: source.roles, roleOrder: [...source.roleOrder], agents, snippet, manifest, skillNames: [...(preset.skillNames ?? [])] };
}
