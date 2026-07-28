import { cp, mkdir, mkdtemp, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "smol-toml";
import { skillsSourceDir } from "../src/core/installer.js";
import { generatePreset, presets, renderAliases, resolvePreset } from "../src/core/presets.js";
import { runCli } from "../src/cli.js";

async function copyPresetSnapshot(id: string, targetRoot: string) {
  await cp(join(process.cwd(), "presets", id), join(targetRoot, id), { recursive: true });
}

async function createCodexHomeFromPreset(id: string) {
  const home = await mkdtemp(join(tmpdir(), "slim-codex-home-"));
  const generated = generatePreset(id);
  await mkdir(join(home, "agents"), { recursive: true });
  const config = "[agents]\nmax_threads = 6\nmax_depth = 2\n\n" + generated.roleOrder.map((name) => `[agents.${name}]\ndescription = ${JSON.stringify(generated.roles[name].description)}\nconfig_file = ${JSON.stringify(`agents/${name}.toml`)}\n`).join("\n");
  await writeFile(join(home, "config.toml"), config, "utf8");
  for (const name of generated.roleOrder) await writeFile(join(home, "agents", `${name}.toml`), generated.agents[name], "utf8");
  return { home, generated };
}

describe("preset generation", () => {
  it("resolves latest to openai-5.6-en (7 roles)", () => {
    expect(resolvePreset("latest").id).toBe("openai-5.6-en");
    expect(resolvePreset("recommended").id).toBe("openai-5.6-en");
    expect(resolvePreset("openai-5.6-en").id).toBe("openai-5.6-en");
  });

  it("rejects unknown preset", () => {
    expect(() => resolvePreset("openai-5.5")).toThrow("Unknown preset");
    expect(resolvePreset("openai-5.6-en").id).toBe("openai-5.6-en");
    expect(resolvePreset("openai-5.6-zh").id).toBe("openai-5.6-zh");
  });

  it("generates seven Codex-native roles for en preset without observer or councillor", () => {
    const first = generatePreset("openai-5.6-en");
    const second = generatePreset("openai-5.6-en");
    expect(first).toEqual(second);
    expect(Object.keys(first.agents)).toHaveLength(7);
    expect(first.agents).not.toHaveProperty("observer");
    expect(first.agents).not.toHaveProperty("councillor");
    expect(first.snippet).not.toContain("[agents.observer]");
    expect(first.snippet).not.toContain("[agents.councillor]");
    expect(JSON.stringify(first)).not.toMatch(/councillor/i);
    expect(first.snippet).toContain("[agents.explorer]");
    expect(first.snippet).toContain('config_file = "agents/explorer.toml"');
    expect(first.agents.explorer).toContain('name = "explorer"');
    expect(first.agents.explorer).toContain('model = "gpt-5.6-luna"');
    expect(first.agents.explorer).not.toMatch(/task_id|council_session|Background Job Board/);
    expect(first.snippet).toContain("[agents.designer]");
  });

  it("generates seven Codex-native roles for zh preset (with designer)", () => {
    const zh = generatePreset("openai-5.6-zh");
    expect(Object.keys(zh.agents)).toHaveLength(7);
    expect(zh.agents).toHaveProperty("designer");
    expect(zh.agents).not.toHaveProperty("observer");
    expect(zh.agents).not.toHaveProperty("councillor");
    expect(zh.snippet).toContain("[agents.designer]");
    expect(zh.snippet).toContain("[agents.explorer]");
    expect(zh.snippet).toContain("[agents.fixer]");
  });

  it("generates six Codex-native roles for zh-nodesigner preset", () => {
    const zh = generatePreset("openai-5.6-zh-nodesigner");
    expect(Object.keys(zh.agents)).toHaveLength(6);
    expect(zh.agents).not.toHaveProperty("designer");
    expect(zh.agents).not.toHaveProperty("observer");
    expect(zh.agents).not.toHaveProperty("councillor");
    expect(zh.snippet).not.toContain("[agents.designer]");
    expect(zh.snippet).toContain("[agents.explorer]");
    expect(zh.snippet).toContain("[agents.fixer]");
  });

  it("encodes bounded recursive orchestration for the five Slim specialists (en)", () => {
    const prompt = generatePreset("openai-5.6-en").roles.orchestrator.instructions;
    for (const name of ["explorer", "librarian", "oracle", "designer", "fixer"]) expect(prompt).toContain(`\`${name}\``);
    expect(prompt).toMatch(/child|subagent/i);
    expect(prompt).toMatch(/wait|reconcile/i);
    expect(prompt).toMatch(/do not.*delegate|must not.*delegate/i);
    expect(prompt).toMatch(/fork_turns\s*=\s*["']none["']/i);
    expect(prompt).not.toMatch(/observer|councillor|task_id|council_session|Background Job Board/i);
  });

  it("encodes bounded recursive orchestration for four Slim specialists (zh-nodesigner)", () => {
    const prompt = generatePreset("openai-5.6-zh-nodesigner").roles.orchestrator.instructions;
    for (const name of ["explorer", "librarian", "oracle", "fixer"]) expect(prompt).toContain(`\`${name}\``);
    expect(prompt).not.toContain("`designer`");
    expect(prompt).not.toMatch(/observer|councillor/i);
  });

  it("lets council assemble installed experts without recursive council fan-out (en)", () => {
    const prompt = generatePreset("openai-5.6-en").roles.council.instructions;
    expect(prompt).toMatch(/available|installed/i);
    expect(prompt).toMatch(/specialist|expert/i);
    expect(prompt).toMatch(/spawn|delegate/i);
    expect(prompt).toMatch(/do not.*council|never.*council/i);
    expect(prompt).toContain("Council Response");
    expect(prompt).toContain("Perspective Details");
    expect(prompt).toContain("Council Summary");
    expect(prompt).toMatch(/untrusted data.*not instructions/is);
    expect(prompt).toMatch(/advisory.*do not edit|do not edit.*advisory/is);
    expect(prompt).toMatch(/Root.*pre-approved.*Council-safe.*read-only/is);
    expect(prompt).toMatch(/do not assume.*read-only.*child.*privilege/is);
    expect(prompt).toMatch(/fork_turns\s*=\s*["']none["']/i);
    expect(prompt).not.toMatch(/provider diversity|council_session|councillor/i);
  });

  it("gives council portable preferred methods without hard-coded skill paths (en)", () => {
    const prompt = generatePreset("openai-5.6-en").roles.council.instructions;
    for (const skill of ["grilling", "grill-with-docs", "deep-research", "brainstorming", "doc-coauthoring"]) expect(prompt).toContain(`$${skill}`);
    expect(prompt).toMatch(/when available|if available/i);
    expect(prompt).toMatch(/do not claim|never claim/i);
    expect(generatePreset("openai-5.6-en").agents.council).not.toMatch(/\[\[skills\.config\]\]|SKILL\.md/i);
  });

  it("keeps orchestration execution and council deliberation in separate skills (en)", async () => {
    const orchestration = await readFile(join(process.cwd(), "presets", "openai-5.6-en", "skills", "slim-orchestration", "SKILL.md"), "utf8");
    const council = await readFile(join(process.cwd(), "presets", "openai-5.6-en", "skills", "slim-council", "SKILL.md"), "utf8");

    for (const role of ["explorer", "librarian", "oracle", "designer", "fixer"]) expect(orchestration).toContain(`\`${role}\``);
    expect(orchestration).toMatch(/scheduler/i);
    expect(orchestration).toMatch(/\.slim\/deepwork\//i);
    expect(orchestration).toMatch(/oracle.*review|review.*oracle/is);
    expect(orchestration).toMatch(/designer.*handoff|handoff.*designer/is);
    expect(orchestration).toMatch(/wait for every required lane/i);
    expect(orchestration).toMatch(/fork_turns\s*=\s*["']none["']/i);
    expect(orchestration).not.toMatch(/\.ignore|council_session|task_id|Background Job Board/i);
    expect(orchestration).not.toMatch(/\$grilling|\$deep-research|select.*installed.*agent/is);

    for (const method of ["grilling", "grill-with-docs", "deep-research", "brainstorming", "doc-coauthoring"]) expect(council).toContain(`$${method}`);
    expect(council).toMatch(/installed agents.*descriptions|descriptions.*installed agents/is);
    expect(council).toMatch(/feasibility|viable/i);
    expect(council).toMatch(/risk/i);
    expect(council).toMatch(/root.*approv|root.*authoriz/i);
    expect(council).toMatch(/independent/i);
    expect(council).toMatch(/advisory.*must not edit|must not edit.*advisory/is);
    expect(council).toMatch(/descriptions?.*data.*not instructions|untrusted.*descriptions?/is);
    expect(council).toMatch(/sandbox_mode = "read-only"/i);
    expect(council).toMatch(/parent turn.*read-only permissions/is);
    expect(council).toMatch(/fork_turns\s*=\s*["']none["']/i);
    expect(council).toMatch(/unverified custom agents/is);
    expect(council).toMatch(/some members fail|failed.*remaining valid responses/is);
    expect(council).toMatch(/all members fail|critical required domain/is);
    expect(council).toMatch(/unanimous.*majority.*split.*insufficient evidence/is);
    expect(council).not.toMatch(/council_session|provider preset|hidden `councillor` role/i);
    expect(council).not.toMatch(/\.slim\/deepwork\//i);
  });

  it("keeps zh-nodesigner orchestration skill without designer references", async () => {
    const orchestration = await readFile(join(process.cwd(), "presets", "openai-5.6-zh-nodesigner", "skills", "slim-orchestration", "SKILL.md"), "utf8");
    expect(orchestration).not.toMatch(/`designer`/);
    for (const role of ["explorer", "librarian", "oracle", "fixer"]) expect(orchestration).toContain(`\`${role}\``);
    expect(orchestration).toMatch(/调度|编排|编排者/i);
  });

  it("moves visual inspection into retained specialists (en)", () => {
    const generated = generatePreset("openai-5.6-en");
    expect(generated.roles.explorer.instructions).toMatch(/visual/i);
    expect(generated.roles.designer.instructions).toMatch(/screenshots|visual files/i);
    expect(generated.roles.oracle.instructions).toMatch(/diagrams|screenshots/i);
  });

  it("generates the exact behavioral MCP denylist for every role (en)", () => {
    const expected: Record<string, string[]> = {
      orchestrator: ["codegraph", "context7", "exa", "grep"],
      oracle: ["context7", "grep"],
      librarian: ["codegraph"],
      explorer: ["context7", "exa", "grep"],
      designer: ["context7", "exa", "grep"],
      fixer: ["context7", "grep"],
      council: [],
    };
    const generated = generatePreset("openai-5.6-en");
    for (const [name, toml] of Object.entries(generated.agents)) {
      const document = parse(toml) as { developer_instructions: string; mcp_servers?: Record<string, unknown> };
      expect(Object.keys(document.mcp_servers ?? {})).toEqual([]);
      if (expected[name].length > 0) expect(document.developer_instructions).toContain(`MCP denylist: ${expected[name].join(", ")}.`);
      else expect(document.developer_instructions).not.toContain("MCP denylist:");
    }
    expect(generated.snippet).not.toContain("[mcp_servers.\"");
  });

  it("generates the exact behavioral MCP denylist for zh preset (with designer)", () => {
    const expected: Record<string, string[]> = {
      orchestrator: ["codegraph", "context7", "exa", "grep"],
      oracle: ["context7", "grep"],
      librarian: ["codegraph"],
      explorer: ["context7", "exa", "grep"],
      designer: ["context7", "exa", "grep"],
      fixer: ["context7", "grep"],
      council: [],
    };
    const generated = generatePreset("openai-5.6-zh");
    for (const [name, toml] of Object.entries(generated.agents)) {
      const document = parse(toml) as { developer_instructions: string; mcp_servers?: Record<string, unknown> };
      expect(Object.keys(document.mcp_servers ?? {})).toEqual([]);
      if (expected[name].length > 0) expect(document.developer_instructions).toContain(`MCP denylist: ${expected[name].join(", ")}.`);
      else expect(document.developer_instructions).not.toContain("MCP denylist:");
    }
  });

  it("generates the exact behavioral MCP denylist for zh-nodesigner preset", () => {
    const expected: Record<string, string[]> = {
      orchestrator: ["codegraph", "context7", "exa", "grep"],
      oracle: ["context7", "grep"],
      librarian: ["codegraph"],
      explorer: ["context7", "exa", "grep"],
      fixer: ["context7", "grep"],
      council: [],
    };
    const generated = generatePreset("openai-5.6-zh-nodesigner");
    expect(Object.keys(generated.agents)).toEqual(["orchestrator", "oracle", "librarian", "explorer", "fixer", "council"]);
    for (const [name, toml] of Object.entries(generated.agents)) {
      const document = parse(toml) as { developer_instructions: string; mcp_servers?: Record<string, unknown> };
      expect(Object.keys(document.mcp_servers ?? {})).toEqual([]);
      if (expected[name].length > 0) expect(document.developer_instructions).toContain(`MCP denylist: ${expected[name].join(", ")}.`);
      else expect(document.developer_instructions).not.toContain("MCP denylist:");
    }
  });

  it("omits transport-dependent MCP fragments from standalone role files (en)", () => {
    const generated = generatePreset("openai-5.6-en");
    for (const toml of Object.values(generated.agents)) {
      expect(toml).not.toContain("[mcp_servers.");
      expect(toml).not.toContain("slim-agents-disabled-mcp");
    }
  });

  it("includes MCP server definitions in config snippet (en)", () => {
    const generated = generatePreset("openai-5.6-en");
    expect(generated.snippet).toContain("[mcp_servers.context7]");
    expect(generated.snippet).toContain('command = "npx"');
    expect(generated.snippet).toContain('"@context7/context7-server"');
  });

  it("includes MCP server definitions in config snippet (zh)", () => {
    const generated = generatePreset("openai-5.6-zh");
    expect(generated.snippet).toContain("[mcp_servers.context7]");
    expect(generated.snippet).toContain('command = "npx"');
  });

  it("includes MCP server definitions in config snippet (zh-nodesigner)", () => {
    const generated = generatePreset("openai-5.6-zh-nodesigner");
    expect(generated.snippet).toContain("[mcp_servers.context7]");
    expect(generated.snippet).toContain('command = "npx"');
  });

  it("does not emit skills sections in config snippet (en)", () => {
    const generated = generatePreset("openai-5.6-en");
    expect(generated.snippet).not.toContain("[skills.");
  });

  it("keeps committed snapshots byte-equal to generated preset (en)", async () => {
    const generated = generatePreset("openai-5.6-en");
    const root = join(process.cwd(), "presets", "openai-5.6-en");
    const files = (await readdir(join(root, "agents"))).sort();
    expect(files).toEqual(generated.roleOrder.map((name) => `${name}.toml`).sort());
    expect(await readFile(join(root, "config.snippet.toml"), "utf8")).toBe(generated.snippet);
    expect(await readFile(join(root, "manifest.json"), "utf8")).toBe(generated.manifest);
    for (const name of generated.roleOrder) expect(await readFile(join(root, "agents", `${name}.toml`), "utf8")).toBe(generated.agents[name]);
  });

  it("keeps committed snapshots byte-equal to generated preset (zh, with designer)", async () => {
    const generated = generatePreset("openai-5.6-zh");
    const root = join(process.cwd(), "presets", "openai-5.6-zh");
    const files = (await readdir(join(root, "agents"))).sort();
    expect(files).toEqual(generated.roleOrder.map((name) => `${name}.toml`).sort());
    expect(await readFile(join(root, "config.snippet.toml"), "utf8")).toBe(generated.snippet);
    expect(await readFile(join(root, "manifest.json"), "utf8")).toBe(generated.manifest);
    for (const name of generated.roleOrder) expect(await readFile(join(root, "agents", `${name}.toml`), "utf8")).toBe(generated.agents[name]);
  });

  it("keeps committed snapshots byte-equal to generated preset (zh-nodesigner)", async () => {
    const generated = generatePreset("openai-5.6-zh-nodesigner");
    const root = join(process.cwd(), "presets", "openai-5.6-zh-nodesigner");
    const files = (await readdir(join(root, "agents"))).sort();
    expect(files).toEqual(generated.roleOrder.map((name) => `${name}.toml`).sort());
    expect(await readFile(join(root, "config.snippet.toml"), "utf8")).toBe(generated.snippet);
    expect(await readFile(join(root, "manifest.json"), "utf8")).toBe(generated.manifest);
    for (const name of generated.roleOrder) expect(await readFile(join(root, "agents", `${name}.toml`), "utf8")).toBe(generated.agents[name]);
  });

  it("keeps the committed aliases synchronized with the generator", async () => {
    expect(await readFile(join(process.cwd(), "presets", "aliases.json"), "utf8")).toBe(renderAliases());
  });
});

describe("CLI", () => {
  it("lists presets and aliases", async () => {
    const output: string[] = [];
    const code = await runCli(["list-presets"], { log: (line) => output.push(line), confirm: async () => false });
    expect(code).toBe(0);
    expect(output.join("\n")).toContain("openai-5.6-en (supported)");
    expect(output.join("\n")).toContain("openai-5.6-zh (supported)");
    expect(output.join("\n")).toContain("openai-5.6-zh-nodesigner (supported)");
    expect(output.join("\n")).toContain("latest -> openai-5.6-en");
  });

  it("validates the seven-role set against the en preset", async () => {
    const id = "openai-5.6-en";
    const output: string[] = [];
    const code = await runCli(["validate", "--preset", id, "--path", join(process.cwd(), "presets", id, "agents")], { log: (line) => output.push(line), confirm: async () => false });
    expect(code).toBe(0);
    expect(output).toContain(`valid: ${join(process.cwd(), "presets", id, "agents")} (7 roles)`);
  });

  it("validates the seven-role set against the zh preset", async () => {
    const id = "openai-5.6-zh";
    const output: string[] = [];
    const code = await runCli(["validate", "--preset", id, "--path", join(process.cwd(), "presets", id, "agents")], { log: (line) => output.push(line), confirm: async () => false });
    expect(code).toBe(0);
    expect(output).toContain(`valid: ${join(process.cwd(), "presets", id, "agents")} (7 roles)`);
  });

  it("validates the six-role set against the zh-nodesigner preset", async () => {
    const id = "openai-5.6-zh-nodesigner";
    const output: string[] = [];
    const code = await runCli(["validate", "--preset", id, "--path", join(process.cwd(), "presets", id, "agents")], { log: (line) => output.push(line), confirm: async () => false });
    expect(code).toBe(0);
    expect(output).toContain(`valid: ${join(process.cwd(), "presets", id, "agents")} (6 roles)`);
  });

  it("convert --check rejects a missing manifest without mutating files", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "slim-convert-check-"));
    await copyPresetSnapshot("openai-5.6-en", outputRoot);
    await unlink(join(outputRoot, "openai-5.6-en", "manifest.json"));
    const drifted = 'name = "explorer"\n# drift stays drifted when check fails\n';
    await writeFile(join(outputRoot, "openai-5.6-en", "agents", "explorer.toml"), drifted, "utf8");

    await expect(runCli(["convert", "--preset", "openai-5.6-en", "--output", outputRoot, "--check"], { log: () => undefined, confirm: async () => false })).rejects.toThrow(/manifest|drift|snapshot/i);
    await expect(readFile(join(outputRoot, "openai-5.6-en", "manifest.json"), "utf8")).rejects.toThrow();
    expect(await readFile(join(outputRoot, "openai-5.6-en", "agents", "explorer.toml"), "utf8")).toBe(drifted);
  });

  it("convert --check with --all covers aliases.json without recreating it", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "slim-convert-all-check-"));
    await copyPresetSnapshot("openai-5.6-en", outputRoot);
    await copyPresetSnapshot("openai-5.6-zh", outputRoot);
    await copyPresetSnapshot("openai-5.6-zh-nodesigner", outputRoot);

    await expect(runCli(["convert", "--all", "--output", outputRoot, "--check"], { log: () => undefined, confirm: async () => false })).rejects.toThrow(/aliases|snapshot|drift/i);
    await expect(readFile(join(outputRoot, "aliases.json"), "utf8")).rejects.toThrow();
  });

  it("convert --check rejects extra stale managed agent files without deleting them", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "slim-convert-extra-agent-"));
    await copyPresetSnapshot("openai-5.6-en", outputRoot);
    const staleObserver = join(outputRoot, "openai-5.6-en", "agents", "observer.toml");
    await writeFile(staleObserver, 'name = "observer"\n', "utf8");

    await expect(runCli(["convert", "--preset", "openai-5.6-en", "--output", outputRoot, "--check"], { log: () => undefined, confirm: async () => false })).rejects.toThrow(/agent files|observer|snapshot/i);
    expect(await readFile(staleObserver, "utf8")).toBe('name = "observer"\n');
  });

  it("convert generation removes stale managed roles but preserves unrelated TOMLs", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "slim-convert-clean-"));
    await copyPresetSnapshot("openai-5.6-en", outputRoot);
    const agentsPath = join(outputRoot, "openai-5.6-en", "agents");
    const staleExplorer = join(agentsPath, "explorer.toml.bak");
    await writeFile(staleExplorer, 'name = "explorer"\n', "utf8");
    const unrelated = join(agentsPath, "local-note.toml");
    await writeFile(unrelated, 'note = "preserve"\n', "utf8");

    expect(await runCli(["convert", "--preset", "openai-5.6-en", "--output", outputRoot], { log: () => undefined, confirm: async () => false })).toBe(0);

    expect(await readFile(staleExplorer, "utf8")).toBe('name = "explorer"\n');
    expect(await readFile(unrelated, "utf8")).toBe('note = "preserve"\n');
  });

  it("validate --path rejects semantic role drift beyond truthy fields", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "slim-validate-path-"));
    await copyPresetSnapshot("openai-5.6-en", outputRoot);
    const agentsPath = join(outputRoot, "openai-5.6-en", "agents");
    const original = await readFile(join(agentsPath, "explorer.toml"), "utf8");
    const drifted = original.replace('sandbox_mode = "read-only"', 'sandbox_mode = "danger-full-access"');
    expect(drifted).not.toBe(original);
    await writeFile(
      join(agentsPath, "explorer.toml"),
      drifted,
      "utf8",
    );

    await expect(runCli(["validate", "--preset", "openai-5.6-en", "--path", agentsPath], { log: () => undefined, confirm: async () => false })).rejects.toThrow(/explorer|invalid|drift|sandbox/i);
  });

  it("validate --codex-home rejects drifted installed role semantics", async () => {
    const { home } = await createCodexHomeFromPreset("openai-5.6-en");
    const original = await readFile(join(home, "agents", "oracle.toml"), "utf8");
    const drifted = original.replace('description = "Read-only strategic advisor for architecture, difficult debugging, risk, simplification, and code review."', 'description = "Drifted oracle description"');
    expect(drifted).not.toBe(original);
    await writeFile(
      join(home, "agents", "oracle.toml"),
      drifted,
      "utf8",
    );

    await expect(runCli(["validate", "--preset", "openai-5.6-en", "--codex-home", home, "--skills-home", skillsSourceDir("openai-5.6-en", "slim-council")], { log: () => undefined, confirm: async () => false })).rejects.toThrow(/oracle|invalid|drift|description/i);
  });
});

describe("installer", () => {
  it("preserves unrelated config sections during install", async () => {
    const root = await mkdtemp(join(tmpdir(), "slim-install-extras-"));
    const codexHome = join(root, "codex");
    const skillsHome = join(root, "skills");
    await mkdir(join(codexHome, "agents"), { recursive: true });
    await mkdir(skillsHome, { recursive: true });

    const existingConfig = `model = "persistent-model"

[agents]
max_threads = 6
max_depth = 1

[agents.backend-advisor]
description = "Custom project agent"
config_file = "agents/backend-advisor.toml"
`;
    await writeFile(join(codexHome, "config.toml"), existingConfig, "utf8");
    await writeFile(join(codexHome, "agents", "backend-advisor.toml"), 'name = "backend-advisor"\n', "utf8");

    const output: string[] = [];
    const code = await runCli(["switch-preset", "--preset", "openai-5.6-en", "--codex-home", codexHome, "--skills-home", skillsHome, "--yes"], { log: (line) => output.push(line), confirm: async () => true });
    expect(code).toBe(0);

    const updated = await readFile(join(codexHome, "config.toml"), "utf8");
    expect(updated).toContain('model = "persistent-model"');
    expect(updated).toContain("[agents.backend-advisor]");
    expect(updated).toContain("[agents.orchestrator]");
    expect(updated).toContain("[mcp_servers.context7]");

    const agents = await readdir(join(codexHome, "agents"));
    expect(agents).toContain("backend-advisor.toml");
    expect(agents).toContain("orchestrator.toml");
    expect(agents).toContain("council.toml");
  });
});
