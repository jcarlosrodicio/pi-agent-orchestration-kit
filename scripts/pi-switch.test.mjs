import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import test from "node:test";

import {
  AGENT_IDS,
  applyModelSelection,
  isDirectExecution,
  parsePiModelList,
  renderPiModelPicker,
  renderPiMainScreen,
  runTerminalPiSwitcher,
} from "./pi-switch.mjs";
import {
  getInstallTarget,
  installPiSwitch,
} from "./install-pi-switch.mjs";

const AGENTS = [...AGENT_IDS];

function createTuiInput() {
  const input = new EventEmitter();
  input.isTTY = true;
  input.setRawMode = () => {};
  input.resume = () => {};
  input.pause = () => {};
  return input;
}

function emitKey(input, name, sequence = name) {
  input.emit("keypress", sequence, { name, sequence, ctrl: name === "c" });
}

function nextTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("parses exactly the models exposed by pi --list-models", () => {
  const models = parsePiModelList([
    "provider        model                                               context  max-out  thinking  images",
    "nan             deepseek-v4-flash-0731                            512K     64K       yes       no",
    "openai          gpt-5.6-sol                                         400K     64K       yes       yes",
    "nan             deepseek-v4-flash-0731                            512K     64K       yes       no",
    "not a model row",
  ].join("\n"));

  assert.deepEqual(models, [
    "nan/deepseek-v4-flash-0731",
    "openai/gpt-5.6-sol",
  ]);
});

test("applies one Pi model to the default and selected agent overrides", () => {
  const settings = {
    defaultProvider: "nan",
    defaultModel: "old-model",
    unrelated: true,
    subagents: {
      defaultModel: "nan/old-model",
      agentScope: "both",
      agentOverrides: {
        lead: { model: "nan/lead-old", temperature: 0.1 },
      },
    },
  };

  const updated = applyModelSelection(settings, {
    modelRef: "openai/gpt-5.6-sol",
    targets: ["default", "lead", "developer"],
  });

  assert.equal(updated.defaultProvider, "openai");
  assert.equal(updated.defaultModel, "gpt-5.6-sol");
  assert.equal(updated.subagents.defaultModel, "openai/gpt-5.6-sol");
  assert.deepEqual(updated.subagents.agentOverrides.lead, {
    model: "openai/gpt-5.6-sol",
    temperature: 0.1,
  });
  assert.deepEqual(updated.subagents.agentOverrides.developer, {
    model: "openai/gpt-5.6-sol",
  });
  assert.equal(updated.unrelated, true);
});

test("renders a bounded Pi model picker from its own catalog", () => {
  const picker = renderPiModelPicker({
    targetLabel: "lead",
    models: Array.from({ length: 12 }, (_, index) => `nan/model-${index}`),
    focusedIndex: 8,
    maxVisibleModels: 5,
  });

  assert.match(picker, /↑ más modelos/);
  assert.match(picker, /↓ más modelos/);
  assert.match(picker, /nan\/model-8/);
  assert.doesNotMatch(picker, /nan\/model-0/);
});

test("renders Pi assignments without OpenCode-only small model rows", () => {
  const screen = renderPiMainScreen({
    assignments: [
      { key: "default", label: "Default", modelRef: "nan/deepseek-v4-flash-0731" },
      ...AGENTS.map((agent) => ({ key: agent, label: agent, modelRef: "nan/deepseek-v4-flash-0731" })),
    ],
    selectedAgents: new Set(["lead"]),
    focusedIndex: 1,
    status: "Catálogo listo.",
  });

  assert.match(screen, /Pi Model Switcher/);
  assert.match(screen, /Selected agents: lead/);
  assert.match(screen, /> \[x\] lead/);
  assert.doesNotMatch(screen, /Small\/title/);
});

test("installer creates a pi-switch symlink in the user bin directory", () => {
  const root = new URL("./", import.meta.url).pathname;
  const targetDir = `${root}..test-pi-switch-bin-${process.pid}`;
  const source = new URL("./pi-switch.mjs", import.meta.url).pathname;
  try {
    const target = installPiSwitch({ binDir: targetDir, moduleUrl: import.meta.url });
    assert.equal(target, getInstallTarget({ binDir: targetDir }));
    assert.equal(fs.readlinkSync(target), source);
    assert.notEqual(fs.statSync(source).mode & 0o111, 0, "pi-switch entrypoint must be executable");
  } finally {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});

test("direct execution helper follows the installed pi-switch symlink", () => {
  const root = new URL("./", import.meta.url).pathname;
  const link = `${root}..test-pi-switch-link-${process.pid}`;
  const source = new URL("./pi-switch.mjs", import.meta.url).pathname;
  try {
    fs.symlinkSync(source, link);
    assert.equal(isDirectExecution({ argvPath: link, modulePath: source }), true);
  } finally {
    fs.rmSync(link, { force: true });
  }
});

test("Pi TUI changes the default model and persists settings on q", async () => {
  const input = createTuiInput();
  const output = { isTTY: true, rows: 30, writes: [], write(chunk) { this.writes.push(String(chunk)); } };
  const saved = [];
  const running = runTerminalPiSwitcher({
    input,
    output,
    initialSettings: {
      defaultProvider: "nan",
      defaultModel: "model-a",
      subagents: { defaultModel: "nan/model-a", agentOverrides: {} },
    },
    initialModels: ["nan/model-a", "openai/model-b"],
    refreshModels: async () => ["nan/model-a", "openai/model-b"],
    saveSettings: async (settings) => {
      saved.push(settings);
      return settings;
    },
  });

  await nextTick();
  emitKey(input, "return", "\r");
  await nextTick();
  emitKey(input, "down");
  emitKey(input, "return", "\r");
  await nextTick();
  emitKey(input, "q");
  const result = await running;

  assert.equal(result.status, "saved");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].defaultProvider, "openai");
  assert.equal(saved[0].defaultModel, "model-b");
  assert.equal(saved[0].subagents.defaultModel, "openai/model-b");
  assert.match(output.writes.join(""), /Cargando modelos/);
});

test("Pi search treats shortcut letters as query text", async () => {
  const input = createTuiInput();
  const output = { isTTY: true, rows: 30, writes: [], write(chunk) { this.writes.push(String(chunk)); } };
  const running = runTerminalPiSwitcher({
    input,
    output,
    initialSettings: {
      defaultProvider: "nan",
      defaultModel: "model-a",
      subagents: { defaultModel: "nan/model-a", agentOverrides: {} },
    },
    initialModels: ["nan/model-a", "openai/model-b"],
    refreshModels: async () => ["nan/model-a", "openai/model-b"],
    saveSettings: async (settings) => settings,
  });

  await nextTick();
  emitKey(input, "/", "/");
  emitKey(input, "q");
  emitKey(input, "r");
  emitKey(input, "s");
  await nextTick();
  assert.match(output.writes.join(""), /Buscar: qrs/);
  emitKey(input, "escape");
  await nextTick();
  emitKey(input, "q");
  const result = await running;
  assert.equal(result.status, "saved");
});
