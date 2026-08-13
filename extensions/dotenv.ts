import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { EXTENSION_METADATA } from "./extension-contract.mjs";

export const metadata = EXTENSION_METADATA.dotenv;

const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertPiApi(pi) {
  if (!pi || typeof pi.on !== "function") {
    throw new Error("Pi extension API is unavailable.");
  }
}

function parseRegularEnvironmentFile(envFile) {
  if (typeof envFile !== "string" || envFile.length === 0) {
    return null;
  }
  let descriptor;
  try {
    const leaf = lstatSync(envFile);
    if (!leaf.isFile() || leaf.isSymbolicLink()) {
      return null;
    }
    descriptor = openSync(envFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.isSymbolicLink()) {
      return null;
    }
    const values = parseEnv(readFileSync(descriptor, "utf8"));
    return Object.entries(values).every(([name, value]) => ENVIRONMENT_NAME.test(name) && typeof value === "string")
      ? values
      : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch {}
    }
  }
}

export function registerDotenv(pi, {
  environment = process.env,
  envFile = ".env",
} = {}) {
  assertPiApi(pi);
  if (!environment || typeof environment !== "object") {
    throw new Error("Dotenv extension input is invalid.");
  }

  pi.on("session_start", () => {
    const values = parseRegularEnvironmentFile(envFile);
    if (!values) {
      return;
    }
    for (const name of Object.keys(values).sort()) {
      if (!Object.hasOwn(environment, name)) {
        environment[name] = values[name];
      }
    }
  });
}

export default registerDotenv;
