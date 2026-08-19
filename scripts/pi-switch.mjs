#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";

export const AGENT_IDS = [
  "lead",
  "designer",
  "researcher",
  "specifier",
  "developer",
  "reviewer",
  "evaluator",
  "debugger",
  "evolver",
];

export function isDirectExecution({
  argvPath = process.argv[1],
  modulePath = fileURLToPath(import.meta.url),
} = {}) {
  if (!argvPath) {
    return false;
  }
  try {
    return fs.realpathSync(argvPath) === fs.realpathSync(modulePath);
  } catch {
    return path.resolve(argvPath) === path.resolve(modulePath);
  }
}

const ANSI = Object.freeze({
  eraseDown: "\u001b[0J",
  hideCursor: "\u001b[?25l",
  showCursor: "\u001b[?25h",
  reverse: "\u001b[7m",
  reset: "\u001b[0m",
  dim: "\u001b[2m",
});

const SETTINGS_FILE = "settings.json";
const SAFE_ERROR = "No se pudo iniciar pi-switch. Revisa la configuración de Pi y vuelve a intentarlo.";

function stripAnsi(value) {
  return String(value).replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function validateModelReference(value) {
  if (typeof value !== "string" || value.length === 0 || /\s/.test(value)) {
    throw new Error("modelRef must be a non-empty provider/model reference");
  }
  const slash = value.indexOf("/");
  if (slash <= 0 || slash === value.length - 1) {
    throw new Error("modelRef must have the form provider/model");
  }
  return value;
}

function splitModelReference(modelRef) {
  const reference = validateModelReference(modelRef);
  const slash = reference.indexOf("/");
  return {
    provider: reference.slice(0, slash),
    model: reference.slice(slash + 1),
  };
}

export function parsePiModelList(stdout) {
  if (typeof stdout !== "string") {
    throw new Error("Pi model output must be a string");
  }

  const models = [];
  const seen = new Set();
  for (const rawLine of stripAnsi(stdout).split(/\r?\n/)) {
    const columns = rawLine.trim().split(/\s+/);
    if (columns.length < 6 || columns[0] === "provider" || columns[0] === "No") {
      continue;
    }
    const provider = columns[0];
    const model = columns[1];
    if (!provider || provider.includes("/") || /\s/.test(provider) || !model || /\s/.test(model)) {
      continue;
    }
    const modelRef = `${provider}/${model}`;
    try {
      validateModelReference(modelRef);
    } catch {
      continue;
    }
    if (!seen.has(modelRef)) {
      seen.add(modelRef);
      models.push(modelRef);
    }
  }
  return models;
}

function modelReferenceFromSettings(settings) {
  const subagents = settings?.subagents;
  if (typeof subagents?.defaultModel === "string" && subagents.defaultModel.includes("/")) {
    return subagents.defaultModel;
  }
  if (typeof settings?.defaultModel === "string" && settings.defaultModel.includes("/")) {
    return settings.defaultModel;
  }
  if (typeof settings?.defaultProvider === "string" && typeof settings?.defaultModel === "string") {
    return `${settings.defaultProvider}/${settings.defaultModel}`;
  }
  return "unknown/unconfigured";
}

function agentModelReference(settings, agent) {
  const override = settings?.subagents?.agentOverrides?.[agent]?.model;
  if (typeof override === "string" && override.includes("/")) {
    return override;
  }
  return modelReferenceFromSettings(settings);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function ensureSubagents(settings) {
  if (!settings.subagents || typeof settings.subagents !== "object" || Array.isArray(settings.subagents)) {
    settings.subagents = {};
  }
  if (!settings.subagents.agentOverrides
    || typeof settings.subagents.agentOverrides !== "object"
    || Array.isArray(settings.subagents.agentOverrides)) {
    settings.subagents.agentOverrides = {};
  }
}

export function applyModelSelection(settings, { modelRef, targets = [] } = {}) {
  const { provider, model } = splitModelReference(modelRef);
  const updated = cloneJson(settings);
  ensureSubagents(updated);
  for (const target of targets) {
    if (target === "default") {
      updated.defaultProvider = provider;
      updated.defaultModel = model;
      updated.subagents.defaultModel = modelRef;
      continue;
    }
    if (!AGENT_IDS.includes(target)) {
      throw new Error("Unknown Pi agent target");
    }
    const current = updated.subagents.agentOverrides[target];
    const override = current && typeof current === "object" && !Array.isArray(current)
      ? { ...current }
      : {};
    override.model = modelRef;
    updated.subagents.agentOverrides[target] = override;
  }
  return updated;
}

export function readPiAssignments(settings, agentIds = AGENT_IDS) {
  return [
    { key: "default", label: "Default", modelRef: modelReferenceFromSettings(settings), kind: "default" },
    ...agentIds.map((agent) => ({
      key: agent,
      label: agent,
      modelRef: agentModelReference(settings, agent),
      kind: "agent",
    })),
  ];
}

function settingsPath({ homeDir = os.homedir(), env = process.env, settingsPath } = {}) {
  if (settingsPath) {
    return settingsPath;
  }
  const root = typeof env.PI_CODING_AGENT_DIR === "string" && env.PI_CODING_AGENT_DIR.length > 0
    ? env.PI_CODING_AGENT_DIR
    : path.join(homeDir, ".pi", "agent");
  return path.join(root, SETTINGS_FILE);
}

function readSettingsFile(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Pi settings must be an object");
    }
    return parsed;
  } catch (cause) {
    if (cause?.code === "ENOENT") {
      return {};
    }
    throw new Error("Pi settings.json is not valid JSON", { cause });
  }
}

function writeSettingsFile(filePath, settings) {
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(directory, { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, filePath);
  } catch (cause) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Best-effort cleanup after an interrupted atomic write.
    }
    throw new Error("No se pudo guardar la configuración de Pi.", { cause });
  }
  return settings;
}

function extractBinaryPath(stdout) {
  for (const candidate of String(stdout).split(/\r?\n/).map((line) => line.trim())) {
    if (path.isAbsolute(candidate) && !/[\u0000-\u001F\u007F]/.test(candidate)) {
      return candidate;
    }
  }
  throw new Error("Pi binary not found");
}

function resolvePiBinary({ signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("zsh", ["-lic", "whence -p pi"], {
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      child.kill("SIGTERM");
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("error", () => reject(new Error("Pi binary not found")));
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (aborted || code !== 0) {
        reject(new Error("Pi binary not found"));
        return;
      }
      try {
        resolve(extractBinaryPath(stdout));
      } catch {
        reject(new Error("Pi binary not found"));
      }
    });
  });
}

function runPiCommand(args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      child.kill("SIGTERM");
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", () => reject(new Error("Pi model catalog unavailable")));
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (aborted || code !== 0) {
        reject(new Error("Pi model catalog unavailable", { cause: stderr }));
        return;
      }
      resolve(stdout);
    });
  });
}

export function renderPiMainScreen({
  assignments = [],
  selectedAgents = new Set(),
  focusedIndex = 0,
  status = "",
  catalogFresh = false,
} = {}) {
  const lines = ["Pi Model Switcher", ""];
  if (status) {
    lines.push(`Status: ${status}`, "");
  }
  lines.push("Model assignments");
  for (const [index, assignment] of assignments.entries()) {
    const selected = assignment.key !== "default" && selectedAgents.has(assignment.key);
    const marker = selected ? "[x] " : "    ";
    const focus = index === focusedIndex ? "> " : "  ";
    lines.push(`${focus}${marker}${assignment.label.padEnd(12)} ${assignment.modelRef}`);
  }
  lines.push("");
  lines.push(selectedAgents.size > 0
    ? `Selected agents: ${[...selectedAgents].join(", ")}`
    : "Selected agents: none");
  lines.push(`Catalog: ${catalogFresh ? "current" : "Cargando modelos..."}`);
  lines.push("");
  lines.push(`${ANSI.dim}↑↓ mover  Enter seleccionar  Space marcar agente  / buscar  r refrescar${ANSI.reset}`);
  lines.push(`${ANSI.dim}s guardar  Esc volver/limpiar  q guardar y salir${ANSI.reset}`);
  return lines.join("\n");
}

function pickerWindow(models, focusedIndex, maxVisibleModels) {
  const limit = Math.max(1, Number.isInteger(maxVisibleModels) ? maxVisibleModels : 14);
  if (models.length <= limit) {
    return { models, hasBefore: false, hasAfter: false };
  }
  const safeIndex = Math.max(0, Math.min(focusedIndex, models.length - 1));
  const start = Math.min(
    Math.max(0, safeIndex - Math.floor(limit / 2)),
    models.length - limit,
  );
  return {
    models: models.slice(start, start + limit),
    hasBefore: start > 0,
    hasAfter: start + limit < models.length,
  };
}

export function renderPiModelPicker({
  targetLabel = "model",
  models = [],
  query = "",
  focusedIndex = 0,
  maxVisibleModels = 14,
} = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  const filtered = models.filter((modelRef) => modelRef.toLowerCase().includes(normalizedQuery));
  const visible = pickerWindow(filtered, focusedIndex, maxVisibleModels);
  const lines = [
    `Selecciona modelo Pi para ${targetLabel}`,
    `Buscar: ${query || "_"}`,
    "",
  ];
  if (visible.hasBefore) lines.push(`${ANSI.dim}↑ más modelos${ANSI.reset}`);
  for (const modelRef of visible.models) {
    const index = filtered.indexOf(modelRef);
    lines.push(`${index === focusedIndex ? `${ANSI.reverse}> ` : "  "}${modelRef}${index === focusedIndex ? ANSI.reset : ""}`);
  }
  if (visible.hasAfter) lines.push(`${ANSI.dim}↓ más modelos${ANSI.reset}`);
  if (filtered.length === 0) lines.push("No hay modelos Pi que coincidan.");
  lines.push("", `${ANSI.dim}Enter seleccionar  Esc volver  escribir buscar  Backspace borrar${ANSI.reset}`);
  return lines.join("\n");
}

function moveIndex(index, delta, length) {
  if (length <= 0) return 0;
  return (index + delta + length) % length;
}

function keyName(key, sequence) {
  if (key?.ctrl && key.name === "c") return "ctrl-c";
  if (key?.name === "return" || key?.name === "enter") return "enter";
  if (key?.name === "escape") return "escape";
  if (key?.name === "space" || sequence === " ") return "space";
  if (sequence === "/") return "slash";
  return key?.name ?? sequence ?? "";
}

function renderFrame(screen, { first = false, previousLineCount = 0 } = {}) {
  if (first) return `${ANSI.hideCursor}${screen}`;
  const cursorUp = previousLineCount > 1 ? `\u001b[${previousLineCount - 1}A` : "";
  return `${cursorUp}\r${ANSI.eraseDown}${screen}`;
}

export async function runTerminalPiSwitcher({
  input = process.stdin,
  output = process.stdout,
  initialSettings = {},
  initialModels = [],
  refreshModels = async () => initialModels,
  saveSettings = async (settings) => settings,
  agentIds = AGENT_IDS,
} = {}) {
  if (!input || typeof input.on !== "function" || !output || typeof output.write !== "function") {
    throw new Error("Terminal input and output are required");
  }

  let settings = cloneJson(initialSettings);
  let models = [...initialModels];
  let catalogFresh = false;
  let screen = "main";
  let focusedIndex = 0;
  let pickerFocusedIndex = 0;
  let pickerQuery = "";
  let selectedAgents = new Set();
  let status = "Cargando modelos...";
  let dirty = false;
  let finished = false;
  let finalResult;
  let previousLineCount = 0;
  let terminalRestored = false;
  let refreshInFlight = false;
  let queue = Promise.resolve();
  const controller = new AbortController();
  const terminalHeight = Number(output.rows ?? input.rows) || 24;
  const maxVisibleModels = Math.max(4, terminalHeight - 14);

  const write = (chunk) => output.write(chunk);
  const assignments = () => readPiAssignments(settings, agentIds);
  const filteredModels = () => {
    const query = pickerQuery.trim().toLowerCase();
    return models.filter((modelRef) => modelRef.toLowerCase().includes(query));
  };
  const render = (first = false) => {
    if (finished) return;
    const frame = screen === "main"
      ? renderPiMainScreen({
        assignments: assignments(),
        selectedAgents,
        focusedIndex,
        status,
        catalogFresh,
      })
      : renderPiModelPicker({
        targetLabel: pickerTargetLabel,
        models,
        query: pickerQuery,
        focusedIndex: pickerFocusedIndex,
        maxVisibleModels,
      });
    write(renderFrame(frame, { first, previousLineCount }));
    previousLineCount = frame.split("\n").length;
  };

  let pickerTargetLabel = "model";
  const persist = async () => {
    settings = await saveSettings(settings);
    dirty = false;
    status = "Guardado.";
  };
  const finish = (result) => {
    finished = true;
    finalResult = result;
    controller.abort();
    return result;
  };
  const restore = () => {
    if (terminalRestored) return;
    terminalRestored = true;
    try {
      input.setRawMode?.(false);
      input.pause?.();
    } finally {
      write(`\n${ANSI.showCursor}\n`);
    }
  };
  const startRefresh = (first = false) => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    catalogFresh = false;
    status = "Cargando modelos...";
    render(first);
    Promise.resolve()
      .then(() => refreshModels({ signal: controller.signal }))
      .then((nextModels) => {
        if (finished) return;
        models = Array.isArray(nextModels) ? [...nextModels] : [];
        catalogFresh = true;
        status = "Catálogo listo.";
        refreshInFlight = false;
        render();
      })
      .catch(() => {
        if (finished) return;
        catalogFresh = false;
        status = "No se pudo actualizar el catálogo; la vista guardada sigue disponible.";
        refreshInFlight = false;
        render();
      });
  };

  emitKeypressEvents(input);
  input.setRawMode?.(true);
  input.resume?.();
  const onKeypress = (sequence, key = {}) => {
    const name = keyName(key, sequence);
    if (name === "ctrl-c") {
      finish({ status: "cancelled", settings });
      return;
    }
    if (screen === "main") {
      const rows = assignments();
      if (name === "up") focusedIndex = moveIndex(focusedIndex, -1, rows.length);
      else if (name === "down") focusedIndex = moveIndex(focusedIndex, 1, rows.length);
      else if (name === "space" && rows[focusedIndex]?.kind === "agent") {
        const agent = rows[focusedIndex].key;
        if (selectedAgents.has(agent)) selectedAgents.delete(agent);
        else selectedAgents.add(agent);
      } else if (name === "enter") {
        const row = rows[focusedIndex];
        if (row) {
          pickerTargetLabel = row.label;
          pickerFocusedIndex = Math.max(0, filteredModels().indexOf(row.modelRef));
          pickerQuery = "";
          screen = "picker";
        }
      } else if (name === "slash") {
        const row = rows[focusedIndex];
        if (row) {
          pickerTargetLabel = row.label;
          pickerFocusedIndex = Math.max(0, filteredModels().indexOf(row.modelRef));
          pickerQuery = "";
          screen = "picker";
        }
      } else if (name === "r") startRefresh();
      else if (name === "s") {
        queue = queue.then(() => persist()).catch(() => { status = "No se pudo guardar."; });
      } else if (name === "q") {
        if (!dirty) {
          finish({ status: "saved", settings });
          return;
        }
        queue = queue.then(async () => {
          await persist();
          finish({ status: "saved", settings });
        }).catch(() => finish({ status: "error", error: "No se pudo guardar la configuración de Pi." }));
      } else if (name === "escape") selectedAgents.clear();
    } else {
      const filtered = filteredModels();
      if (name === "up") pickerFocusedIndex = moveIndex(pickerFocusedIndex, -1, filtered.length);
      else if (name === "down") pickerFocusedIndex = moveIndex(pickerFocusedIndex, 1, filtered.length);
      else if (name === "enter" && filtered[pickerFocusedIndex]) {
        const rows = assignments();
        const row = rows[focusedIndex];
        const targets = row?.kind === "default"
          ? ["default"]
          : [...(selectedAgents.size > 0 ? selectedAgents : new Set([row.key]))];
        settings = applyModelSelection(settings, { modelRef: filtered[pickerFocusedIndex], targets });
        dirty = true;
        selectedAgents.clear();
        screen = "main";
        status = "Cambio pendiente de guardar.";
      } else if (name === "escape") {
        screen = "main";
        pickerQuery = "";
      } else if (name === "backspace") {
        pickerQuery = pickerQuery.slice(0, -1);
        pickerFocusedIndex = 0;
      } else if (name === "slash") {
        pickerQuery = "";
      } else if (typeof sequence === "string" && sequence.length === 1 && sequence >= " " && sequence <= "~") {
        pickerQuery += sequence;
        pickerFocusedIndex = 0;
      }
    }
    render();
  };
  input.on("keypress", onKeypress);
  startRefresh(true);

  return new Promise((resolve) => {
    const poll = () => {
      if (finished) {
        input.off?.("keypress", onKeypress);
        restore();
        resolve(finalResult);
      } else {
        setImmediate(poll);
      }
    };
    poll();
  });
}

export function createPiSwitcher({
  homeDir = os.homedir(),
  env = process.env,
  settingsPath: injectedSettingsPath,
  resolveBinary = resolvePiBinary,
  runCommand = runPiCommand,
} = {}) {
  const filePath = settingsPath({ homeDir, env, settingsPath: injectedSettingsPath });
  const readSettings = () => readSettingsFile(filePath);
  const saveSettings = (settings) => writeSettingsFile(filePath, settings);
  const refreshModels = async ({ signal } = {}) => {
    const binary = extractBinaryPath(await resolveBinary({ signal }));
    return parsePiModelList(await runCommand([binary, "--list-models"], { signal }));
  };
  return {
    getSettingsPath: () => filePath,
    loadSettings: readSettings,
    saveSettings,
    refreshModels,
  };
}

export async function runInteractive(options = {}) {
  const switcher = createPiSwitcher(options);
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  if (options.useTui === false || input?.isTTY !== true || output?.isTTY !== true) {
    return { status: "error", error: "pi-switch necesita una terminal interactiva." };
  }
  try {
    return await runTerminalPiSwitcher({
      input,
      output,
      initialSettings: options.initialSettings ?? switcher.loadSettings(),
      initialModels: options.initialModels ?? [],
      refreshModels: options.refreshModels ?? switcher.refreshModels,
      saveSettings: options.saveSettings ?? switcher.saveSettings,
      agentIds: options.agentIds ?? AGENT_IDS,
    });
  } catch {
    return { status: "error", error: SAFE_ERROR };
  }
}

if (isDirectExecution()) {
  const result = await runInteractive();
  if (result.status === "error") {
    process.stderr.write(`${result.error}\n`);
    process.exitCode = 1;
  }
}
