// Exercise the real `codex -p` loader against a local HTTP sink. No model is called.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import assert from "node:assert/strict";
import { parse } from "smol-toml";

const home = resolve(process.argv[2] ?? process.env.CODEX_HOME ?? join(homedir(), ".codex"));
for (const name of ["bal", "pro"]) {
  const expected = parse(await readFile(join(home, `${name}.config.toml`), "utf8"));
  let captured;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (req.url?.endsWith("/responses")) captured = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Slim configuration probe complete; no inference performed", type: "invalid_request_error" } }));
  });
  await new Promise(accept => server.listen(0, "127.0.0.1", accept));
  const port = server.address().port;
  const base = parse((await readFile(join(home, "config.toml"), "utf8").catch(() => "")).replace(/^\uFEFF/, ""));
  const args = ["--profile", name, "exec", "--ephemeral", "--skip-git-repo-check", "--color", "never",
    "-c", 'model_provider="slim_probe"',
    "-c", `model_providers.slim_probe={name="Slim local config probe",base_url="http://127.0.0.1:${port}/v1",wire_api="responses",env_key="SLIM_PROBE_API_KEY",request_max_retries=0,stream_max_retries=0}`,
    "-c", "features.apps=false", "-c", "features.plugins=false", "-c", "features.memories=false",
  ];
  const inlineToml = value => Array.isArray(value) ? `[${value.map(inlineToml).join(",")}]` : value && typeof value === "object"
    ? `{${Object.entries(value).map(([key, nested]) => `${JSON.stringify(key)}=${inlineToml(nested)}`).join(",")}}`
    : JSON.stringify(value);
  args.push("-c", `mcp_servers=${inlineToml(Object.fromEntries(Object.entries(base.mcp_servers ?? {}).map(([key, config]) => [key, { ...config, enabled: false }])))}`);
  args.push("Configuration probe. Do not execute tools.");
  const child = spawn("codex", args, {
    env: { ...process.env, CODEX_HOME: home, SLIM_PROBE_API_KEY: "local-probe-only", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostics = "";
  child.stdout.on("data", () => {});
  child.stderr.on("data", chunk => { diagnostics = (diagnostics + chunk).slice(-12000); });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 25000);
  try {
    await new Promise((accept, reject) => { child.on("error", reject); child.on("exit", accept); });
    assert.ok(captured, `${name}: Codex did not reach the local sink: ${diagnostics}`);
    assert.equal(captured.model, expected.model, `${name}: effective Root model; check project overrides`);
    assert.equal(captured.reasoning?.effort, expected.model_reasoning_effort, `${name}: effective Root effort`);
    const strings = value => typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
    const tools = strings(captured.input).join("\n");
    for (const [role, config] of Object.entries(expected.agents)) {
      if (typeof config !== "object") continue;
      const agent = parse(await readFile(config.config_file, "utf8"));
      const block = tools.match(new RegExp(`${role}: \\{\\n([\\s\\S]*?)\\n\\}`))?.[1];
      assert.ok(block, `${name}: missing agent ${role}`);
      assert.ok(block.includes(`model is set to \`${agent.model}\``), `${name}/${role}: wrong resolved model`);
      assert.ok(block.includes(`reasoning effort is set to \`${agent.model_reasoning_effort}\``), `${name}/${role}: wrong resolved effort`);
    }
    assert.ok(!tools.match(/(?:^|\n)designer: \{/), `${name}: unexpected designer; check global/project agents`);
    console.log(`${name}: native Profile selected ${captured.model}/high; all six role models/efforts verified; no inference`);
  } finally {
    clearTimeout(timeout);
    child.kill();
    server.closeAllConnections();
    await new Promise(accept => server.close(accept));
  }
}
