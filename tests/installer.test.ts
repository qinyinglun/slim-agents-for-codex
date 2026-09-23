import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installPreset, previewInstall, skillsSourceDir } from "../src/core/installer.js";
import { runCli } from "../src/cli.js";

describe("safe installation", () => {
  it.runIf(process.platform === "win32")("treats case-only variants of the packaged Skill path as the same location", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-same-skills-"));

    const preview = await previewInstall({ codexHome: home, skillsHome: skillsSourceDir("openai-5.6-en", "slim-council").toUpperCase(), preset: "openai-5.6-en" });

    expect(preview.installSkills).toBe(false);
    expect(preview.existingManagedSkills).toEqual([]);
  });

  it("installs into a fresh Codex home without mutating during preview", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-codex-fresh-"));
    const configPath = join(home, "config.toml");

    const preview = await previewInstall({ codexHome: home, preset: "openai-5.6-en" });

    expect(preview.configExisted).toBe(false);
    expect(preview.backupPath).toBeUndefined();
    await expect(access(configPath)).rejects.toThrow();

    const result = await installPreset(preview);

    expect(result.backupPath).toBeUndefined();
    expect(await readFile(configPath, "utf8")).toContain("[agents.orchestrator]");
    expect(await readFile(configPath, "utf8")).toContain("max_depth = 2");
    expect(await readFile(join(home, "agents", "council.toml"), "utf8")).toContain('name = "council"');
  });

  it("installs and post-validates a fresh Codex home through the CLI", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-codex-fresh-cli-"));
    const skillsHome = join(home, "user-skills");
    const output: string[] = [];

    const code = await runCli(["install", "--preset", "openai-5.6-en", "--codex-home", home, "--skills-home", skillsHome, "--yes"], {
      log: (line) => output.push(line),
      confirm: async () => false,
    });

    expect(code).toBe(0);
    expect(output).toContain("backup: none (new config)");
    expect(output).toContain(`skills: ${skillsHome}`);
    expect(output).toContain(`valid installation: ${home} (7 roles)`);
    expect(output).toContain(`valid skills: ${skillsHome} (2 skills)`);
    expect(output).toContain(`installed openai-5.6-en at ${join(home, "agents")}`);
    expect(await readFile(join(skillsHome, "slim-council", "SKILL.md"), "utf8")).toBe(
      await readFile(join(process.cwd(), "presets", "openai-5.6-en", "skills", "slim-council", "SKILL.md"), "utf8"),
    );
    expect(await readFile(join(skillsHome, "slim-orchestration", "agents", "openai.yaml"), "utf8")).toBe(
      await readFile(join(process.cwd(), "presets", "openai-5.6-en", "skills", "slim-orchestration", "agents", "openai.yaml"), "utf8"),
    );
  });

  it("previews without writing and preserves unrelated config on apply", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-codex-"));
    await writeFile(join(home, "config.toml"), 'model = "existing"\r\n\r\n[agents]\r\nmax_threads = 6\r\nmax_depth = 1\r\n', "utf8");
    const preview = await previewInstall({ codexHome: home, preset: "openai-5.6-en" });
    expect(await readFile(join(home, "config.toml"), "utf8")).not.toContain("agents.explorer");
    await installPreset(preview);
    const installed = await readFile(join(home, "config.toml"), "utf8");
    expect(installed).toContain('model = "existing"');
    expect(installed).toContain("max_depth = 2");
    expect(installed.match(/^\[agents\]$/gm)).toHaveLength(1);
    expect(installed).toContain("[agents.explorer]");
    expect(installed).toContain('config_file = "agents/explorer.toml"');
    expect(await readFile(join(home, "agents", "explorer.toml"), "utf8")).toContain('name = "explorer"');
    expect(installed).toContain("\r\n");
  });

  it("adds an agents table to an existing Codex config that does not have one", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-existing-no-agents-"));
    const skillsHome = join(home, "skills");
    await writeFile(join(home, "config.toml"), 'model = "existing"\n\n[mcp_servers.example]\ncommand = "example"\n', "utf8");

    const preview = await previewInstall({ codexHome: home, skillsHome, preset: "openai-6-en" });
    await installPreset(preview);

    const installed = await readFile(join(home, "config.toml"), "utf8");
    expect(installed).toContain('model = "existing"');
    expect(installed).toContain("[mcp_servers.example]");
    expect(installed).toContain("[agents]");
    expect(installed).toContain("max_threads = 6");
    expect(installed).toContain("max_depth = 2");
    expect(installed).toContain("[agents.orchestrator]");
  });

  it("does not mutate live agents or Skills when the config backup cannot be created", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-backup-failure-"));
    const skillsHome = join(home, "skills");
    const configPath = join(home, "config.toml");
    await writeFile(configPath, "[agents]\nmax_threads = 6\nmax_depth = 1\n", "utf8");
    const preview = await previewInstall({ codexHome: home, skillsHome, preset: "openai-5.6-en" });
    await rm(configPath);

    await expect(installPreset(preview)).rejects.toThrow();

    await expect(access(join(home, "agents", "orchestrator.toml"))).rejects.toThrow();
    await expect(access(join(skillsHome, "slim-council", "SKILL.md"))).rejects.toThrow();
  });

  it("validates installed agent paths relative to config.toml", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-codex-"));
    const skillsHome = join(home, "skills");
    await writeFile(join(home, "config.toml"), "[agents]\nmax_threads = 6\nmax_depth = 1\n", "utf8");
    const preview = await previewInstall({ codexHome: home, skillsHome, preset: "openai-5.6-en" });
    await installPreset(preview);
    const output: string[] = [];

    await expect(runCli(["validate", "--codex-home", home], {
      log: () => undefined,
      confirm: async () => false,
    })).rejects.toThrow(/--skills-home/);

    const code = await runCli(["validate", "--preset", "openai-5.6-en", "--codex-home", home, "--skills-home", skillsHome], {
      log: (line) => output.push(line),
      confirm: async () => false,
    });

    expect(code).toBe(0);
    expect(output).toContain(`valid installation: ${home} (7 roles)`);
    expect(output).toContain(`valid skills: ${skillsHome} (2 skills)`);
    expect(await readFile(join(home, "config.toml"), "utf8")).not.toContain("[agents.observer]");
  });

  it("targets the current project's .codex directory with project scope", async () => {
    const project = await mkdtemp(join(tmpdir(), "slim-project-"));
    const codexHome = join(project, ".codex");
    await mkdir(codexHome);
    await writeFile(join(codexHome, "config.toml"), "[agents]\nmax_threads = 6\nmax_depth = 1\n", "utf8");
    const previousDirectory = process.cwd();
    const output: string[] = [];
    let resolvedCodexHome = codexHome;
    let resolvedSkillsHome = join(project, ".agents", "skills");

    try {
      process.chdir(project);
      resolvedCodexHome = join(process.cwd(), ".codex");
      resolvedSkillsHome = join(process.cwd(), ".agents", "skills");
      const code = await runCli(["install", "--scope", "project"], {
        log: (line) => output.push(line),
        confirm: async () => false,
      });
      expect(code).toBe(2);
    } finally {
      process.chdir(previousDirectory);
    }

    expect(output).toContain(`config: ${join(resolvedCodexHome, "config.toml")}`);
    expect(output).toContain(`skills: ${resolvedSkillsHome}`);
    await expect(access(join(project, ".agents", "skills"))).rejects.toThrow();
  });

  it("rejects an installed managed Skill whose packaged content has drifted", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-skill-validation-"));
    const skillsHome = join(home, "skills");

    await runCli(["install", "--preset", "openai-5.6-en", "--codex-home", home, "--skills-home", skillsHome, "--yes"], {
      log: () => undefined,
      confirm: async () => false,
    });
    await writeFile(join(skillsHome, "slim-council", "SKILL.md"), "drifted\n", "utf8");

    await expect(runCli(["validate", "--preset", "openai-5.6-en", "--codex-home", home, "--skills-home", skillsHome], {
      log: () => undefined,
      confirm: async () => false,
    })).rejects.toThrow(/slim-council|skill.*drift/i);
  });

  it("switches preset and archives inactive managed agents while preserving custom agents", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-switch-"));
    const skillsHome = join(home, "skills");
    await mkdir(join(home, "agents"));
    await writeFile(
      join(home, "config.toml"),
      '[agents]\nmax_threads = 6\nmax_depth = 1\n\n[agents.backend-advisor]\ndescription = "Unrelated custom advisor"\nconfig_file = "agents/backend-advisor.toml"\n',
      "utf8",
    );
    await writeFile(join(home, "agents", "backend-advisor.toml"), 'name = "backend-advisor"\ndescription = "Unrelated"\ndeveloper_instructions = "Advise"\n', "utf8");

    await installPreset(await previewInstall({ codexHome: home, skillsHome, preset: "openai-5.6-en" }));

    await expect(previewInstall({ codexHome: home, preset: "openai-5.6-en" })).rejects.toThrow(/Existing role conflict/);

    const preview = await previewInstall({ codexHome: home, preset: "openai-5.6-en", mode: "switch" });
    expect(preview.archivePath).toContain(join("agent-presets", "slim-agents-for-codex"));
    await installPreset(preview);

    const config = await readFile(join(home, "config.toml"), "utf8");
    expect(config.match(/^\[agents\.orchestrator\]$/gm)).toHaveLength(1);
    expect(config).toContain("[agents.backend-advisor]");
    expect(await readFile(join(home, "agents", "backend-advisor.toml"), "utf8")).toContain('name = "backend-advisor"');
    expect(await readFile(join(home, "agents", "orchestrator.toml"), "utf8")).toContain('name = "orchestrator"');
  });

  it("tells an existing installation to use the archival switch flow", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-upgrade-guidance-"));
    const skillsHome = join(home, "skills");
    await writeFile(join(home, "config.toml"), "[agents]\nmax_threads = 6\nmax_depth = 1\n", "utf8");
    await installPreset(await previewInstall({ codexHome: home, skillsHome, preset: "openai-5.6-en" }));

    await expect(runCli(["install", "--preset", "openai-6-en", "--codex-home", home, "--skills-home", skillsHome, "--yes"], {
      log: () => undefined,
      confirm: async () => true,
    })).rejects.toThrow(/switch-preset.*archive/i);
  });

  it("routes switch-preset through switch mode and post-validates", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-switch-cli-"));
    const skillsHome = join(home, "skills");
    await writeFile(join(home, "config.toml"), "[agents]\nmax_threads = 6\nmax_depth = 1\n", "utf8");
    await installPreset(await previewInstall({ codexHome: home, skillsHome, preset: "openai-5.6-en" }));
    const output: string[] = [];

    const code = await runCli(["switch-preset", "--preset", "openai-5.6-en", "--codex-home", home, "--skills-home", skillsHome, "--yes"], {
      log: (line) => output.push(line),
      confirm: async () => false,
    });

    expect(code).toBe(0);
    expect(output).toContain(`valid installation: ${home} (7 roles)`);
    expect(output.some((line) => line.startsWith("archive: "))).toBe(true);
  });

  it("archives replaced managed Skills and preserves unrelated Skills during a switch", async () => {
    const home = await mkdtemp(join(tmpdir(), "slim-switch-skills-"));
    const skillsHome = join(home, "skills");
    await writeFile(join(home, "config.toml"), "[agents]\nmax_threads = 6\nmax_depth = 1\n", "utf8");
    await runCli(["install", "--preset", "openai-5.6-en", "--codex-home", home, "--skills-home", skillsHome, "--yes"], {
      log: () => undefined,
      confirm: async () => false,
    });
    await writeFile(join(skillsHome, "slim-council", "local-note.txt"), "preserve in archive\n", "utf8");
    await mkdir(join(skillsHome, "unrelated-skill"));
    await writeFile(join(skillsHome, "unrelated-skill", "SKILL.md"), "unrelated\n", "utf8");

    const preview = await previewInstall({ codexHome: home, skillsHome, preset: "openai-5.6-en", mode: "switch" });
    expect(preview.existingManagedSkills).toEqual(["slim-council", "slim-orchestration"]);
    await installPreset(preview);

    expect(await readFile(join(preview.archivePath, "skills", "slim-council", "local-note.txt"), "utf8")).toBe("preserve in archive\n");
    await expect(access(join(skillsHome, "slim-council", "local-note.txt"))).rejects.toThrow();
    expect(await readFile(join(skillsHome, "unrelated-skill", "SKILL.md"), "utf8")).toBe("unrelated\n");
    expect(await readFile(join(skillsHome, "slim-council", "SKILL.md"), "utf8")).toBe(
      await readFile(join(process.cwd(), "presets", "openai-5.6-en", "skills", "slim-council", "SKILL.md"), "utf8"),
    );
  });
});
