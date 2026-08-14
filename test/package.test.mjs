import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import registerShellExportGuard, {
  metadata as shellExportGuardMetadata,
} from "../extensions/shell-export-guard.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("publishes a Pi package with the expected resource contract", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.name, "pi-agent-orchestration-kit");
  assert.deepEqual(packageJson.pi.extensions, ["./extensions/*.ts"]);
  assert.deepEqual(packageJson.pi.skills, ["./skills"]);
  assert.deepEqual(packageJson.pi.prompts, ["./prompts"]);
  assert.deepEqual(packageJson["pi-subagents"].agents, ["./agents"]);
  assert.deepEqual(packageJson["pi-subagents"].chains, ["./chains"]);
});

function createFakePi() {
  const handlers = new Map();
  return {
    handlers,
    on(name, handler) {
      handlers.set(name, handler);
    },
  };
}

test("shell export guard exposes metadata and blocks high-signal exports", async () => {
  assert.deepEqual(shellExportGuardMetadata, {
    apiVersion: 1,
    capability: "shell-export-guard",
    requiredEnv: [],
  });

  const pi = createFakePi();
  registerShellExportGuard(pi);
  const handler = pi.handlers.get("tool_call");
  assert.equal(typeof handler, "function");

  const sensitiveApiKeyName = ["OPENAI", "API_KEY"].join("_");
  const blocked = await handler({
    toolName: "bash",
    input: { command: `export ${sensitiveApiKeyName}=literal` },
  });
  assert.deepEqual(blocked, {
    block: true,
    reason: "[shell-export-guard:shell-export-sensitive-name] Sensitive shell export blocked by policy; use an explicit non-secret value or a scoped secret-aware tool.",
  });
  assert.equal(blocked.reason.includes(sensitiveApiKeyName), false);
  assert.equal(await handler({ toolName: "bash", input: { command: 'export PATH="$PATH:/tool/bin"' } }), undefined);
  assert.equal(await handler({ toolName: "read", input: { command: `export ${sensitiveApiKeyName}=literal` } }), undefined);
});
