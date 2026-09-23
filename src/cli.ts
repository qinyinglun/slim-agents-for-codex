#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { parse } from "smol-toml";
import { filesBelow, installPreset, previewInstall, skillsSourceDir, validateInstalledSkills } from "./core/installer.js";
import { aliases, generatePreset, managedRoleNames, presets, renderAliases } from "./core/presets.js";

export interface CliIo { log(line: string): void; confirm(question: string): Promise<boolean> }

const valueAfter = (args: string[], option: string, fallback?: string) => {
  const index = args.indexOf(option);
  return index >= 0 ? args[index + 1] : fallback;
};

async function writeGenerated(id: string, output: string) {
  const generated = generatePreset(id);
  const root = join(output, generated.preset.id);
  const agentsDirectory = join(root, "agents");
  await mkdir(agentsDirectory, { recursive: true });
  const active = new Set(generated.roleOrder);
  for (const file of await readdir(agentsDirectory)) {
    if (!file.endsWith(".toml")) continue;
    const name = file.slice(0, -".toml".length);
    if (managedRoleNames.includes(name) && !active.has(name)) await unlink(join(agentsDirectory, file));
  }
  for (const [name, content] of Object.entries(generated.agents)) await writeFile(join(agentsDirectory, `${name}.toml`), content, "utf8");
  await writeFile(join(root, "config.snippet.toml"), generated.snippet, "utf8");
  await writeFile(join(root, "manifest.json"), generated.manifest, "utf8");
  for (const name of generated.skillNames) {
    const src = skillsSourceDir(generated.preset.skillSourcePreset ?? generated.preset.id, name);
    const dst = join(root, "skills", name);
    if (src !== dst) await cp(src, dst, { recursive: true });
  }
  return root;
}

function generatedArtifacts(id: string, output: string) {
  const generated = generatePreset(id);
  const root = join(output, generated.preset.id);
  const artifacts = [
    ...generated.roleOrder.map((name) => ({ path: join(root, "agents", `${name}.toml`), content: generated.agents[name] })),
    { path: join(root, "config.snippet.toml"), content: generated.snippet },
    { path: join(root, "manifest.json"), content: generated.manifest },
  ];
  return { root, artifacts };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, stable(nested)]));
}

function matchesSemantically(actual: unknown, expected: unknown) {
  return JSON.stringify(stable(actual)) === JSON.stringify(stable(expected));
}

async function assertGeneratedArtifactsMatch(id: string, output: string) {
  const generated = generatePreset(id);
  const root = join(output, generated.preset.id);
  const agentsDirectory = join(root, "agents");
  let actualAgentFiles: string[];
  try {
    actualAgentFiles = (await readdir(agentsDirectory)).filter((name) => name.endsWith(".toml")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Missing generated artifact: ${agentsDirectory}`);
    throw error;
  }
  const expectedAgentFiles = generated.roleOrder.map((name) => `${name}.toml`).sort();
  if (JSON.stringify(actualAgentFiles) !== JSON.stringify(expectedAgentFiles)) throw new Error(`Agent files do not match preset snapshot: ${id}`);
  for (const name of generated.roleOrder) {
    const path = join(agentsDirectory, `${name}.toml`);
    let committed: string;
    try {
      committed = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Missing generated artifact: ${path}`);
      throw error;
    }
    if (committed !== generated.agents[name]) throw new Error(`Generated artifact drift: ${path}`);
  }
  const snippetPath = join(root, "config.snippet.toml");
  const manifestPath = join(root, "manifest.json");
  if ((await readFile(snippetPath, "utf8")) !== generated.snippet) throw new Error(`Generated artifact drift: ${snippetPath}`);
  if ((await readFile(manifestPath, "utf8")) !== generated.manifest) throw new Error(`Generated artifact drift: ${manifestPath}`);
  for (const skillName of generated.skillNames) {
    const src = skillsSourceDir(generated.preset.id, skillName);
    const dst = join(root, "skills", skillName);
    const srcFiles = await filesBelow(src);
    const dstFiles = await filesBelow(dst);
    if (JSON.stringify(srcFiles) !== JSON.stringify(dstFiles)) throw new Error(`Skill file drift: ${skillName}`);
    for (const file of srcFiles) {
      const srcContent = await readFile(join(src, file));
      const dstContent = await readFile(join(dst, file));
      if (!srcContent.equals(dstContent)) throw new Error(`Skill content drift: ${skillName}/${file.replaceAll("\\", "/")}`);
    }
  }
}

async function assertRoleDocument(name: string, expectedToml: string, actualTomlPath: string) {
  const actual = parse(await readFile(actualTomlPath, "utf8"));
  const expected = parse(expectedToml);
  if (!matchesSemantically(actual, expected)) throw new Error(`Role semantic drift: ${name}`);
}

export async function runCli(args: string[], io: CliIo): Promise<number> {
  const command = args[0] ?? "help";
  if (command === "help" || command === "--help" || command === "-h") {
    io.log("slim-agents-codex <convert|install|validate|list-presets|switch-preset> [--skills-home PATH] [options]");
    return 0;
  }
  if (command === "list-presets") {
    for (const preset of Object.values(presets)) io.log(`${preset.id} (${preset.status})`);
    for (const [alias, id] of Object.entries(aliases)) io.log(`${alias} -> ${id}`);
    return 0;
  }
  if (command === "convert") {
    const output = resolve(valueAfter(args, "--output", "generated")!);
    const ids = args.includes("--all") ? Object.keys(presets) : [valueAfter(args, "--preset", "latest")!];
    if (args.includes("--check")) {
      for (const id of ids) await assertGeneratedArtifactsMatch(id, output);
      if (args.includes("--all")) {
        const aliasesPath = join(output, "aliases.json");
        let committed: string;
        try {
          committed = await readFile(aliasesPath, "utf8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Missing generated artifact: ${aliasesPath}`);
          throw error;
        }
        if (committed !== renderAliases()) throw new Error(`Generated artifact drift: ${aliasesPath}`);
      }
      for (const id of ids) io.log(`checked ${join(output, generatePreset(id).preset.id)}`);
      if (args.includes("--all")) io.log(`checked ${join(output, "aliases.json")}`);
      return 0;
    }
    for (const id of ids) io.log(`generated ${await writeGenerated(id, output)}`);
    if (args.includes("--all")) await writeFile(join(output, "aliases.json"), renderAliases(), "utf8");
    return 0;
  }
  if (command === "validate") {
    const generated = generatePreset(valueAfter(args, "--preset", "latest")!);
    const codexHomeOption = valueAfter(args, "--codex-home");
    if (codexHomeOption) {
      const skillsHomeOption = valueAfter(args, "--skills-home");
      if (!skillsHomeOption) throw new Error("--skills-home is required with --codex-home so managed Skills are validated");
      const codexHome = resolve(codexHomeOption);
      const configPath = join(codexHome, "config.toml");
      const config = parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
      const agents = config.agents as Record<string, unknown> | undefined;
      const configuredManagedRoles = managedRoleNames.filter((name) => agents?.[name] !== undefined).sort();
      const expectedManagedRoles = [...generated.roleOrder].sort();
      if (JSON.stringify(configuredManagedRoles) !== JSON.stringify(expectedManagedRoles)) throw new Error(`Installed managed roles do not match preset: ${generated.preset.id}`);
      for (const name of generated.roleOrder) {
        const role = agents?.[name] as Record<string, unknown> | undefined;
        const configFile = role?.config_file;
        if (typeof configFile !== "string") throw new Error(`Missing config_file for role: ${name}`);
        if (configFile.replaceAll("\\", "/") !== `agents/${name}.toml`) throw new Error(`Invalid config_file for role: ${name}`);
        await assertRoleDocument(name, generated.agents[name], resolve(dirname(configPath), configFile));
      }
      io.log(`valid installation: ${codexHome} (${generated.roleOrder.length} roles)`);
      const skillsHome = resolve(skillsHomeOption);
      await validateInstalledSkills(generated.preset.id, skillsHome, generated.skillNames);
      io.log(`valid skills: ${skillsHome} (${generated.skillNames.length} skills)`);
      return 0;
    }
    const directory = resolve(valueAfter(args, "--path", `presets/${generated.preset.id}/agents`)!);
    const files = (await readdir(directory)).filter((name) => name.endsWith(".toml")).sort();
    const expectedFiles = generated.roleOrder.map((name) => `${name}.toml`).sort();
    if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) throw new Error(`Agent files do not match preset: ${generated.preset.id}`);
    for (const name of generated.roleOrder) await assertRoleDocument(name, generated.agents[name], join(directory, `${name}.toml`));
    io.log(`valid: ${directory} (${generated.roleOrder.length} roles)`);
    return 0;
  }
  if (command === "install" || command === "switch-preset") {
    const preset = valueAfter(args, "--preset", "latest")!;
    const scope = valueAfter(args, "--scope");
    if (scope && scope !== "global" && scope !== "project") throw new Error(`Invalid scope: ${scope}`);
    const defaultHome = scope === "project" ? join(process.cwd(), ".codex") : process.env.CODEX_HOME ?? join(homedir(), ".codex");
    const defaultSkillsHome = scope === "project" ? join(process.cwd(), ".agents", "skills") : join(homedir(), ".agents", "skills");
    const codexHome = resolve(valueAfter(args, "--codex-home", defaultHome)!);
    const skillsHome = resolve(valueAfter(args, "--skills-home", defaultSkillsHome)!);
    const preview = await previewInstall({ codexHome, skillsHome, preset, mode: command === "switch-preset" ? "switch" : "install" });
    io.log(`preset: ${preset} -> ${preview.resolvedPreset}`);
    io.log(`config: ${preview.configPath}`);
    io.log(`skills: ${preview.skillsHome}`);
    io.log(`backup: ${preview.backupPath ?? "none (new config)"}`);
    if (preview.existingManagedFiles.length > 0 || preview.existingManagedSkills.length > 0) io.log(`archive: ${preview.archivePath}`);
    if (!args.includes("--yes") && !(await io.confirm("Apply these changes?"))) {
      io.log("cancelled; no files changed");
      return 2;
    }
    const result = await installPreset(preview);
    try {
      await runCli(["validate", "--codex-home", codexHome, "--skills-home", result.skillsHome, "--preset", result.preset], io);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const configRecovery = result.backupPath ? `Restore config from ${result.backupPath}` : `Remove newly created config ${preview.configPath}`;
      throw new Error(`Post-install validation failed: ${message}. ${configRecovery} and restore managed agents or skills from ${result.archivePath}`);
    }
    io.log(`installed ${result.preset} at ${result.target}`);
    return 0;
  }
  io.log(`unknown command: ${command}`);
  return 1;
}

async function main() {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.exitCode = await runCli(process.argv.slice(2), {
      log: console.log,
      confirm: async (question) => (await readline.question(`${question} [y/N] `)).trim().toLowerCase() === "y",
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    readline.close();
  }
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) void main();
