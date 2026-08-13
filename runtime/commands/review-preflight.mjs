#!/usr/bin/env node
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const STAGED_ASSET = "{{PI_HARNESS_ROOT}}/runtime/scripts/review-orchestrated-prepare.mjs";
const MAX_ARGUMENTS = 64;
const MAX_ARGUMENT_LENGTH = 4096;

export const runtimeContract = Object.freeze({
  command: "review-preflight",
  budget: "bounded",
  locks: "required",
  hashes: "required",
  gates: "human",
  idempotency: "required",
  reviewerAuthority: "final",
  guarantees: "Preserve preflight gates, locks, hashes, idempotency, and final reviewer authority.",
});

function validateArgv(args) {
  if (!Array.isArray(args) || args.length > MAX_ARGUMENTS) {
    throw new TypeError("Runtime binding arguments are invalid.");
  }
  for (const value of args) {
    if (typeof value !== "string" || value.includes(String.fromCharCode(0)) || value.length > MAX_ARGUMENT_LENGTH) {
      throw new TypeError("Runtime binding arguments are invalid.");
    }
  }
  return [...args];
}

async function execute(args, forwardSignals) {
  const argv = validateArgv(args);
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [STAGED_ASSET, ...argv], { stdio: "inherit" });
    let settled = false;
    const signalHandlers = new Map();
    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) {
        process.off(signal, handler);
      }
    };
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    if (forwardSignals) {
      for (const signal of ["SIGINT", "SIGTERM"]) {
        const handler = () => {
          if (!child.killed) child.kill(signal);
        };
        signalHandlers.set(signal, handler);
        process.on(signal, handler);
      }
    }
    child.once("error", (error) => {
      settle(reject, error);
    });
    child.once("exit", (code, signal) => {
      settle(resolveResult, Object.freeze({ exitCode: code ?? null, signal: signal ?? null }));
    });
  });
}

export async function run(args = process.argv.slice(2)) {
  return execute(args, false);
}

const invocationPath = process.argv[1]?.startsWith("file:")
  ? fileURLToPath(process.argv[1])
  : process.argv[1] && resolve(process.argv[1]);
const isDirectInvocation = (() => {
  try {
    return invocationPath && realpathSync(invocationPath) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isDirectInvocation) {
  execute(process.argv.slice(2), true).then(
    ({ exitCode, signal }) => {
      if (signal) process.kill(process.pid, signal);
      else process.exitCode = exitCode ?? 1;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
