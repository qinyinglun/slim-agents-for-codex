import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, lstat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "smol-toml";
import { generatePreset, managedRoleNames, sessionProfiles } from "./presets.js";
import { skillsSourceDir, validateInstalledSkills } from "./installer.js";

type ProfileName = keyof typeof sessionProfiles;
const marker = "# Managed by slim-agents-for-codex: session profile";

export function resolveProfile(name: string): ProfileName {
  if (!Object.hasOwn(sessionProfiles, name)) throw new Error(`Unknown session profile: ${name}. Choose bal or pro.`);
  return name as ProfileName;
}

export function generateProfile(name: string, codexHome: string) {
  const id = resolveProfile(name);
  const profile = sessionProfiles[id];
  const generated = generatePreset(profile.preset);
  const target = join(resolve(codexHome), "agent-presets", "slim-agents-for-codex", "profiles", id);
  const configPath = join(resolve(codexHome), `${id}.config.toml`);
  const config = `${marker}\n# preset: ${profile.preset}\nmodel = ${JSON.stringify(profile.model)}\nmodel_reasoning_effort = ${JSON.stringify(profile.effort)}\n\n[agents]\nenabled = true\nmax_concurrent_threads_per_session = 6\nmax_depth = 2\n\n` + generated.roleOrder.map(role =>
    `[agents.${role}]\ndescription = ${JSON.stringify(generated.roles[role].description)}\nconfig_file = ${JSON.stringify(join(target, "agents", `${role}.toml`))}\n`,
  ).join("\n");
  return { id, profile, generated, target, configPath, config };
}

async function exists(path: string) {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

async function regularPath(path: string, directory: boolean) {
  if (!await exists(path)) return;
  const info = await lstat(path);
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) throw new Error(`Refusing non-regular profile target: ${path}`);
}

export async function validateProfile(name: string, codexHome: string, skillsHome: string) {
  const expected = generateProfile(name, codexHome);
  const actual = parse(await readFile(expected.configPath, "utf8"));
  // Compare all fields, not just the root model: stale or extra roles must fail too.
  if (JSON.stringify(actual) !== JSON.stringify(parse(expected.config))) throw new Error(`Profile config drift: ${name}`);
  const files = (await readdir(join(expected.target, "agents"))).sort();
  if (JSON.stringify(files) !== JSON.stringify(expected.generated.roleOrder.map(role => `${role}.toml`).sort())) throw new Error(`Profile role set drift: ${name}`);
  for (const role of expected.generated.roleOrder) {
    if (await readFile(join(expected.target, "agents", `${role}.toml`), "utf8") !== expected.generated.agents[role]) throw new Error(`Profile role drift: ${name}/${role}`);
  }
  if (await readFile(join(expected.target, "manifest.json"), "utf8") !== expected.generated.manifest) throw new Error(`Profile manifest drift: ${name}`);
  await validateInstalledSkills(expected.profile.preset, skillsHome, expected.generated.skillNames);
  return expected;
}

export async function previewProfiles(codexHome: string, skillsHome: string, names: string[]) {
  const profiles = names.map(name => generateProfile(name, codexHome));
  const missingSkills: string[] = [];
  for (const item of profiles) {
    await regularPath(item.configPath, false);
    if (await exists(item.configPath) && !(await readFile(item.configPath, "utf8")).startsWith(marker + "\n")) {
      throw new Error(`Unmanaged profile conflict: ${item.configPath}. Rename it before installing Slim profiles.`);
    }
    await regularPath(item.target, true);
    if (await exists(item.target)) {
      const manifest = JSON.parse(await readFile(join(item.target, "manifest.json"), "utf8"));
      const previousPresets: readonly string[] = "previousPresets" in item.profile ? item.profile.previousPresets : [];
      if (manifest.id !== item.profile.preset && !previousPresets.includes(manifest.id)) throw new Error(`Unmanaged profile directory: ${item.target}`);
    }
    for (const skill of item.generated.skillNames) {
      await readFile(join(skillsSourceDir(item.profile.preset, skill), "SKILL.md"));
      if (await exists(join(skillsHome, skill))) {
        await validateInstalledSkills(item.profile.preset, skillsHome, [skill]);
      } else if (!missingSkills.includes(skill)) missingSkills.push(skill);
    }
  }
  // Do not silently promise an exact role set if the base enables a managed extra.
  const basePath = join(codexHome, "config.toml");
  if (await exists(basePath)) {
    const base = parse((await readFile(basePath, "utf8")).replace(/^\uFEFF/, ""));
    const agents = base.agents as Record<string, unknown> | undefined;
    for (const name of managedRoleNames) {
      if (agents?.[name] && !profiles[0].generated.roleOrder.includes(name)) throw new Error(`Base config enables extra Slim role: ${name}. Remove that declaration before installing no-designer profiles.`);
    }
  }
  return { profiles, codexHome: resolve(codexHome), skillsHome: resolve(skillsHome), missingSkills };
}

export async function installProfiles(preview: Awaited<ReturnType<typeof previewProfiles>>) {
  // Repeat all preflight checks after interactive confirmation.
  preview = await previewProfiles(preview.codexHome, preview.skillsHome, preview.profiles.map(item => item.id));
  await mkdir(preview.codexHome, { recursive: true });
  const staging = await mkdtemp(join(preview.codexHome, ".slim-profile-stage-"));
  const backups: string[] = [];
  const token = staging.slice(staging.lastIndexOf("-") + 1);
  try {
    // Stage and back up the entire selection before changing any profile.
    for (const item of preview.profiles) {
      const stage = join(staging, item.id);
      await mkdir(join(stage, "agents"), { recursive: true });
      for (const [role, content] of Object.entries(item.generated.agents)) await writeFile(join(stage, "agents", `${role}.toml`), content, "utf8");
      await writeFile(join(stage, "manifest.json"), item.generated.manifest, "utf8");
      await writeFile(join(staging, `${item.id}.config.toml`), item.config, "utf8");
      if (await exists(item.configPath)) {
        const backup = `${item.configPath}.backup-${Date.now()}-${token}`;
        await copyFile(item.configPath, backup);
        backups.push(backup);
      }
      if (await exists(item.target)) {
        const backup = `${item.target}.backup-${Date.now()}-${token}`;
        await cp(item.target, backup, { recursive: true });
        backups.push(backup);
      }
    }
    await mkdir(preview.skillsHome, { recursive: true });
    for (const skill of preview.missingSkills) {
      if (await exists(join(preview.skillsHome, skill))) throw new Error(`Skill conflict during installation: ${skill}`);
      await cp(skillsSourceDir(preview.profiles[0].profile.preset, skill), join(preview.skillsHome, skill), { recursive: true, errorOnExist: true, force: false });
    }
    for (const item of preview.profiles) {
      await mkdir(join(item.target, ".."), { recursive: true });
      // Only replace the exact, preflighted, backed-up managed profile directory.
      if (await exists(item.target)) await rm(item.target, { recursive: true });
      await rename(join(staging, item.id), item.target);
      await rename(join(staging, `${item.id}.config.toml`), item.configPath);
    }
    for (const item of preview.profiles) await validateProfile(item.id, preview.codexHome, preview.skillsHome);
  } catch (error) {
    throw new Error(`Profile installation failed: ${error instanceof Error ? error.message : String(error)}. Backups: ${backups.join(", ") || "none (new installation)"}. Re-run install-profiles after resolving the cause.`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return backups;
}
