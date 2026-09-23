import { copyFile, cp, mkdir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePreset, managedRoleNames, managedSkillNames } from "./presets.js";

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function skillsSourceDir(presetId: string, skillName: string): string {
  return join(packageRoot(), "presets", presetId, "skills", skillName);
}

export interface InstallRequest { codexHome: string; preset: string; mode?: "install" | "switch"; skillsHome?: string }
export interface InstallPreview {
  request: InstallRequest;
  configPath: string;
  configExisted: boolean;
  backupPath?: string;
  archivePath: string;
  original: Buffer;
  updated: Buffer;
  files: Record<string, string>;
  existingManagedFiles: string[];
  inactiveManagedFiles: string[];
  skillsHome: string;
  existingManagedSkills: string[];
  installSkills: boolean;
  resolvedPreset: string;
  skillNames: readonly string[];
}

function configuredManagedRoles(text: string): string[] {
  return managedRoleNames.filter((name) => new RegExp(`^\\[agents\\.${name}\\]$`, "m").test(text));
}

function stripManagedSections(text: string, newline: string, managedMcpNames: readonly string[]): string {
  const managed = new Set(managedRoleNames);
  const managedMcps = new Set(managedMcpNames);
  const output: string[] = [];
  let skipping = false;
  for (const line of text.split(newline)) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (header) {
      const role = header[1].match(/^agents\.([^.]+)$/);
      const mcp = header[1].match(/^mcp_servers\.([^.]+)(?:\.|$)/);
      skipping = Boolean((role && managed.has(role[1])) || (mcp && managedMcps.has(mcp[1])));
    }
    if (!skipping) output.push(line);
  }
  return output.join(newline);
}

function updateConfig(text: string, newline: string, generated: ReturnType<typeof generatePreset>, mode: "install" | "switch"): string {
  const configured = configuredManagedRoles(text);
  if (mode === "install" && configured.length > 0) {
    throw new Error(`Existing role conflict: ${configured[0]}. Use switch-preset to archive and replace the managed Slim agents safely.`);
  }
  const editable = mode === "switch"
    ? stripManagedSections(text, newline, Object.keys(generated.preset.mcpServers ?? {}))
    : text;
  const headers = [...editable.matchAll(/^\[agents\]\s*$/gm)];
  if (headers.length > 1) throw new Error("Expected at most one [agents] table");
  const snippet = generated.snippet.replaceAll("\n", newline).replace(/[\r\n]+$/, "");
  if (headers.length === 0) {
    return editable.replace(/[\r\n]+$/, "") + newline.repeat(2) + snippet + newline;
  }
  if (headers[0].index === undefined) throw new Error("Invalid [agents] table");
  const sectionStart = headers[0].index + headers[0][0].length;
  const nextHeader = editable.slice(sectionStart).search(/^\[.+\]\s*$/m);
  const sectionEnd = nextHeader < 0 ? editable.length : sectionStart + nextHeader;
  const section = editable.slice(sectionStart, sectionEnd);
  if (!/^max_threads\s*=\s*6\s*$/m.test(section)) throw new Error("Expected max_threads = 6");
  if (!/^max_depth\s*=\s*[12]\s*$/m.test(section)) throw new Error("Expected max_depth = 1 or 2");
  const roleStart = snippet.indexOf(`[agents.`);
  if (roleStart < 0) throw new Error("Generated config snippet has no agent roles");
  const roles = snippet.slice(roleStart).replace(/[\r\n]+$/, "");
  const updated = editable.replace(/^max_depth\s*=\s*[12]\s*$/m, "max_depth = 2").replace(/[\r\n]+$/, "");
  return updated + newline.repeat(2) + roles + newline;
}

async function existingManagedAgentFiles(codexHome: string): Promise<string[]> {
  try {
    const files = await readdir(join(codexHome, "agents"));
    const managedFiles = new Set(managedRoleNames.map((name) => `${name}.toml`));
    return files.filter((name) => managedFiles.has(name)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function canonicalPath(path: string): Promise<string> {
  try {
    path = await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    path = resolve(path);
  }
  return process.platform === "win32" ? path.toLowerCase() : path;
}

async function sameLocation(left: string, right: string): Promise<boolean> {
  return await canonicalPath(left) === await canonicalPath(right);
}

async function existingManagedSkillDirectories(skillsHome: string, names: readonly string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const name of names) if (await pathExists(join(skillsHome, name))) existing.push(name);
  return existing;
}

export async function filesBelow(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(root, path));
    else files.push(relative(root, path));
  }
  return files.sort();
}

export async function validateInstalledSkills(presetId: string, skillsHome: string, skillNames: readonly string[] = managedSkillNames): Promise<void> {
  for (const name of skillNames) {
    const source = skillsSourceDir(presetId, name);
    const target = join(skillsHome, name);
    let expectedFiles: string[];
    let actualFiles: string[];
    try {
      expectedFiles = await filesBelow(source);
      actualFiles = await filesBelow(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Missing installed Skill: ${name}`);
      throw error;
    }
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error(`Skill file drift: ${name}`);
    for (const file of expectedFiles) {
      const expected = await readFile(join(source, file));
      const actual = await readFile(join(target, file));
      if (!actual.equals(expected)) throw new Error(`Skill content drift: ${name}/${file.replaceAll("\\", "/")}`);
    }
  }
}

export async function previewInstall(request: InstallRequest): Promise<InstallPreview> {
  const configPath = join(request.codexHome, "config.toml");
  let configExisted = true;
  let original: Buffer;
  try {
    original = await readFile(configPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    configExisted = false;
    original = Buffer.from("[agents]\nmax_threads = 6\nmax_depth = 1\n", "utf8");
  }
  const bom = original.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const body = original.subarray(bom ? 3 : 0).toString("utf8");
  if (body.includes("\uFFFD")) throw new Error("Invalid UTF-8 replacement character");
  const newline = body.includes("\r\n") ? "\r\n" : "\n";
  const generated = generatePreset(request.preset);
  const mode = request.mode ?? "install";
  const updatedText = updateConfig(body, newline, generated, mode);
  const updated = Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(updatedText)]);
  const timestamp = Date.now();
  const existingManagedFiles = await existingManagedAgentFiles(request.codexHome);
  const activeFiles = new Set(Object.keys(generated.agents).map((name) => `${name}.toml`));
  const inactiveManagedFiles = existingManagedFiles.filter((name) => !activeFiles.has(name));
  const skillsHome = resolve(request.skillsHome ?? join(request.codexHome, "skills"));
  const resolvedId = generated.preset.id;
  const installSkills = !await sameLocation(skillsHome, skillsSourceDir(resolvedId, generated.skillNames[0]));
  for (const name of generated.skillNames) await readFile(join(skillsSourceDir(resolvedId, name), "SKILL.md"));
  const existingManagedSkills = installSkills ? await existingManagedSkillDirectories(skillsHome, generated.skillNames) : [];
  return {
    request,
    configPath,
    configExisted,
    backupPath: configExisted ? `${configPath}.backup-${timestamp}` : undefined,
    archivePath: join(request.codexHome, "agent-presets", "slim-agents-for-codex", `backup-${timestamp}`),
    original,
    updated,
    files: generated.agents,
    existingManagedFiles,
    inactiveManagedFiles,
    skillsHome,
    existingManagedSkills,
    installSkills,
    resolvedPreset: resolvedId,
    skillNames: generated.skillNames,
  };
}

export async function installPreset(preview: InstallPreview) {
  if (preview.backupPath) await copyFile(preview.configPath, preview.backupPath);
  const target = join(preview.request.codexHome, "agents");
  await mkdir(target, { recursive: true });
  if (preview.existingManagedFiles.length > 0) {
    await mkdir(preview.archivePath, { recursive: true });
    for (const file of preview.existingManagedFiles) await copyFile(join(target, file), join(preview.archivePath, file));
  }
  if (preview.existingManagedSkills.length > 0) {
    const archive = join(preview.archivePath, "skills");
    await mkdir(archive, { recursive: true });
    for (const name of preview.existingManagedSkills) await cp(join(preview.skillsHome, name), join(archive, name), { recursive: true });
  }
  for (const [name, content] of Object.entries(preview.files)) await writeFile(join(target, `${name}.toml`), content, "utf8");
  if (preview.installSkills) {
    await mkdir(preview.skillsHome, { recursive: true });
    for (const name of preview.skillNames) {
      await rm(join(preview.skillsHome, name), { recursive: true, force: true });
      await cp(skillsSourceDir(preview.resolvedPreset, name), join(preview.skillsHome, name), { recursive: true });
    }
  }
  const temp = `${preview.configPath}.tmp-${process.pid}`;
  await writeFile(temp, preview.updated);
  await rename(temp, preview.configPath);
  for (const file of preview.inactiveManagedFiles) await unlink(join(target, file));
  if (preview.backupPath) await stat(preview.backupPath);
  return { target, skillsHome: preview.skillsHome, backupPath: preview.backupPath, archivePath: preview.archivePath, preset: preview.resolvedPreset };
}
