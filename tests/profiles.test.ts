import { mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { generatePreset, sessionProfiles } from "../src/core/presets.js";
import { generateProfile } from "../src/core/profiles.js";

const io = { log: (_line: string) => undefined, confirm: async () => false };
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "slim-profiles-"));
  const skillsHome = join(home, "shared-skills");
  const original = Buffer.from('\ufeffmodel = "gpt-6-astra"\r\n[mcp_servers.local]\r\ncommand = "example"\r\n');
  await writeFile(join(home, "config.toml"), original);
  await mkdir(join(home, "agents"));
  await writeFile(join(home, "agents", "fixer.toml"), "# existing global agent\n");
  return { home, skillsHome, original, args: ["--codex-home", home, "--skills-home", skillsHome] };
}

describe("GPT-6 session profiles", () => {
  it.skipIf(process.platform === "win32")("runs the installed CLI through its global bin symlink", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-bin-link-"));
    const bin = join(home, "slim-agents-codex");
    const bundle = join(home, "cli.mjs");
    await promisify(execFile)("bun", ["build", join(process.cwd(), "src", "cli.ts"), "--target=node", "--outfile", bundle]);
    await symlink(bundle, bin);
    const result = await promisify(execFile)(process.execPath, [bin, "--help"]);
    expect(result.stdout).toContain("install-profiles");
  });

  it("adds a quality preset without changing historical GPT-6 model mappings", () => {
    const bal = generatePreset("openai-6-zh-nodesigner");
    const pro = generatePreset("openai-6-pro-zh-nodesigner");
    expect(pro.roleOrder).toEqual(bal.roleOrder);
    expect(pro.roleOrder).toHaveLength(6);
    expect(pro.preset.sourceVersion).toBe(bal.preset.sourceVersion);
    for (const role of pro.roleOrder) {
      expect(pro.roles[role]).toEqual(bal.roles[role]);
      expect(pro.preset.models[role]).toEqual(role === "fixer" ? { model: "gpt-6.1-sol", effort: "high" } : bal.preset.models[role]);
    }
    expect(bal.preset.models.fixer.model).toBe("gpt-6-luna");
  });

  it("uses Terra/high only for the current bal Fixer, preserving historical presets and pro", () => {
    const bal = generatePreset(sessionProfiles.bal.preset);
    const historical = generatePreset("openai-6-zh-nodesigner");
    expect(bal.preset.id).toBe("openai-6.1-bal-zh-nodesigner");
    expect(bal.preset.models.fixer).toEqual({ model: "gpt-6.1-terra", effort: "high" });
    for (const role of bal.roleOrder) {
      expect(bal.roles[role]).toEqual(historical.roles[role]);
      if (role !== "fixer") expect(bal.preset.models[role]).toEqual(historical.preset.models[role]);
    }
    expect(historical.preset.models.fixer.model).toBe("gpt-6-luna");
    expect(generatePreset(sessionProfiles.pro.preset).preset.models.fixer.model).toBe("gpt-6.1-sol");
  });

  it("installs two independent profiles, preserves base/autodiscovered agents and shares Skills", async () => {
    const f = await fixture();
    expect(await runCli(["install-profiles", ...f.args, "--yes"], io)).toBe(0);
    expect(await readFile(join(f.home, "config.toml"))).toEqual(f.original);
    expect(await readFile(join(f.home, "agents", "fixer.toml"), "utf8")).toBe("# existing global agent\n");
    for (const name of ["bal", "pro"]) {
      const config = parse(await readFile(join(f.home, `${name}.config.toml`), "utf8")) as any;
      expect(config.model).toBe(name === "bal" ? "gpt-6.1-sol" : "gpt-6-astra");
      expect(config.model_reasoning_effort).toBe("high");
      expect(config.agents.max_depth).toBe(2);
      expect(config.agents.designer).toBeUndefined();
      const rolePath = config.agents.fixer.config_file;
      expect(rolePath.replaceAll("\\", "/")).toContain(`/agent-presets/slim-agents-for-codex/profiles/${name}/agents/fixer.toml`);
      const role = parse(await readFile(rolePath, "utf8"));
      expect(role.model).toBe(name === "bal" ? "gpt-6.1-terra" : "gpt-6.1-sol");
      expect(await runCli(["validate", "--profile", name, ...f.args], io)).toBe(0);
    }
    expect((await readdir(f.skillsHome)).sort()).toEqual(["slim-council", "slim-orchestration"]);
  });

  it("cancels before writing anything", async () => {
    const f = await fixture();
    expect(await runCli(["install-profiles", ...f.args], io)).toBe(2);
    await expect(readFile(join(f.home, "bal.config.toml"))).rejects.toThrow();
    expect(await readFile(join(f.home, "config.toml"))).toEqual(f.original);
  });

  it("upgrades an older managed bal with backups while leaving pro and the base untouched", async () => {
    const f = await fixture();
    await runCli(["install-profiles", ...f.args, "--yes"], io);
    const bal = generateProfile("bal", f.home);
    const old = generatePreset("openai-6-zh-nodesigner");
    const manifestPath = join(bal.target, "manifest.json");
    const fixerPath = join(bal.target, "agents", "fixer.toml");
    await writeFile(manifestPath, old.manifest);
    await writeFile(fixerPath, old.agents.fixer);
    const pro = generateProfile("pro", f.home);
    const proConfig = await readFile(pro.configPath);
    const proFixer = await readFile(join(pro.target, "agents", "fixer.toml"));

    expect(await runCli(["install-profiles", ...f.args, "--profile", "bal", "--yes"], io)).toBe(0);
    expect(parse(await readFile(fixerPath, "utf8")).model).toBe("gpt-6.1-terra");
    const backups = (await readdir(join(bal.target, ".."))).filter(name => name.startsWith("bal.backup-"));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(bal.target, "..", backups[0], "agents", "fixer.toml"), "utf8")).toBe(old.agents.fixer);
    expect(await readFile(pro.configPath)).toEqual(proConfig);
    expect(await readFile(join(pro.target, "agents", "fixer.toml"))).toEqual(proFixer);
    expect(await readFile(join(f.home, "config.toml"))).toEqual(f.original);
  });

  it("preflights both profiles and refuses to overwrite a foreign profile", async () => {
    const f = await fixture();
    await writeFile(join(f.home, "pro.config.toml"), 'model = "custom"\n');
    await expect(runCli(["install-profiles", ...f.args, "--yes"], io)).rejects.toThrow(/unmanaged.*profile/i);
    await expect(readFile(join(f.home, "bal.config.toml"))).rejects.toThrow();
    expect(await readFile(join(f.home, "pro.config.toml"), "utf8")).toBe('model = "custom"\n');
  });

  it("backs up an existing managed profile before updating and catches role drift", async () => {
    const f = await fixture();
    await runCli(["install-profiles", ...f.args, "--yes"], io);
    const original = await readFile(join(f.home, "pro.config.toml"));
    await runCli(["install-profiles", ...f.args, "--profile", "pro", "--yes"], io);
    const backups = (await readdir(f.home)).filter(name => name.startsWith("pro.config.toml.backup-"));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(f.home, backups[0]))).toEqual(original);
    const config = parse(original.toString("utf8")) as any;
    await writeFile(config.agents.fixer.config_file, 'name = "fixer"\nmodel = "wrong"\n');
    await expect(runCli(["validate", "--profile", "pro", ...f.args], io)).rejects.toThrow(/drift/i);
    expect(await runCli(["validate", "--profile", "bal", ...f.args], io)).toBe(0);
  });

  it("rejects invalid profile names and project scope", async () => {
    const f = await fixture();
    await expect(runCli(["install-profiles", ...f.args, "--profile", "../../custom", "--yes"], io)).rejects.toThrow(/unknown.*profile/i);
    await expect(runCli(["install-profiles", ...f.args, "--scope", "project", "--yes"], io)).rejects.toThrow(/global|scope/i);
  });

  it("does not replace divergent shared Skills", async () => {
    const f = await fixture();
    await mkdir(join(f.skillsHome, "slim-council"), { recursive: true });
    await writeFile(join(f.skillsHome, "slim-council", "SKILL.md"), "user edits\n");
    await expect(runCli(["install-profiles", ...f.args, "--yes"], io)).rejects.toThrow(/skill.*drift|skill.*conflict/i);
    await expect(readFile(join(f.home, "bal.config.toml"))).rejects.toThrow();
    expect(await readFile(join(f.skillsHome, "slim-council", "SKILL.md"), "utf8")).toBe("user edits\n");
  });
});
