import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
