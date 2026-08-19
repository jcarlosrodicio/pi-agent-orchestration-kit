#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function getInstallTarget({ homeDir = os.homedir(), binDir } = {}) {
  return path.join(binDir ?? path.join(homeDir, ".local", "bin"), "pi-switch");
}

export function installPiSwitch({
  homeDir = os.homedir(),
  binDir,
  moduleUrl = import.meta.url,
} = {}) {
  const target = getInstallTarget({ homeDir, binDir });
  const source = fileURLToPath(new URL("./pi-switch.mjs", moduleUrl));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    const stats = fs.lstatSync(target);
    if (!stats.isSymbolicLink()) {
      throw new Error("Refusing to replace an existing pi-switch file.");
    }
    if (fs.readlinkSync(target) === source) {
      return target;
    }
    throw new Error("Refusing to replace a conflicting pi-switch symlink.");
  } catch (cause) {
    if (cause?.code !== "ENOENT") {
      throw cause;
    }
  }
  fs.symlinkSync(source, target);
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const target = installPiSwitch({
    binDir: process.env.PI_SWITCH_BIN_DIR || undefined,
  });
  process.stdout.write(`Installed ${target}\n`);
}
