import { constants } from "node:fs";
import { lstat, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { EXTENSION_METADATA } from "./extension-contract.mjs";

export const metadata = EXTENSION_METADATA["open-design"];

export const OPEN_DESIGN_SCHEMA = Object.freeze({
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    nodes: {
      items: {
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: { type: "string" },
        },
        required: ["id", "type"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["name", "nodes"],
  type: "object",
});

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,127}$/;
const SAFE_NODE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const SAFE_RELATIVE_PATH = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]{0,255}\.json$/;

function invalidInput() {
  throw new Error("Open Design input is invalid.");
}

function assertPiApi(pi) {
  if (!pi || typeof pi.registerTool !== "function") {
    throw new Error("Pi extension API is unavailable.");
  }
}

function plainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactDataKeys(value, expected) {
  if (!plainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    return false;
  }
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index])
    && keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor && "value" in descriptor;
    });
}

function normalizeDesign(value) {
  if (!hasExactDataKeys(value, ["name", "nodes"]) || typeof value.name !== "string" || !SAFE_NAME.test(value.name) || !Array.isArray(value.nodes)) {
    invalidInput();
  }
  const nodes = value.nodes.map((node) => {
    if (!hasExactDataKeys(node, ["id", "type"]) || typeof node.id !== "string" || typeof node.type !== "string" || !SAFE_NODE_ID.test(node.id) || !SAFE_NODE_ID.test(node.type)) {
      invalidInput();
    }
    return { id: node.id, type: node.type };
  });
  return { name: value.name, nodes };
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function identity(pathname, details) {
  return { dev: details.dev, ino: details.ino, pathname };
}

function sameIdentity(saved, details) {
  return saved.dev === details.dev && saved.ino === details.ino;
}

async function workspaceRoot(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    invalidInput();
  }
  const resolved = path.resolve(root);
  let details;
  try {
    details = await lstat(resolved);
  } catch {
    invalidInput();
  }
  if (!details.isDirectory() || details.isSymbolicLink()) {
    invalidInput();
  }
  return identity(resolved, details);
}

async function ensureSafeParent(root, target) {
  const relativeParent = path.relative(root.pathname, path.dirname(target));
  const directories = [root];
  if (relativeParent === "" || relativeParent === ".") {
    return directories;
  }
  let current = root.pathname;
  for (const segment of relativeParent.split(path.sep)) {
    if (!segment || segment === "." || segment === "..") {
      invalidInput();
    }
    current = path.join(current, segment);
    let details;
    try {
      details = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        invalidInput();
      }
      try {
        await mkdir(current);
      } catch {
        invalidInput();
      }
      try {
        details = await lstat(current);
      } catch {
        invalidInput();
      }
    }
    if (!details.isDirectory() || details.isSymbolicLink()) {
      invalidInput();
    }
    directories.push(identity(current, details));
  }
  return directories;
}

async function revalidateDirectories(directories) {
  for (const directory of directories) {
    let details;
    try {
      details = await lstat(directory.pathname);
    } catch {
      invalidInput();
    }
    if (!details.isDirectory() || details.isSymbolicLink() || !sameIdentity(directory, details)) {
      invalidInput();
    }
  }
}

async function cleanupCreatedFile(target, directories, fileIdentity) {
  try {
    await revalidateDirectories(directories);
    const details = await lstat(target);
    if (details.isFile() && !details.isSymbolicLink() && sameIdentity(fileIdentity, details)) {
      await unlink(target);
    }
  } catch {
    // Cleanup must never race into an unverified parent or a replacement leaf.
  }
}

async function writeCreateOnly(target, content, directories) {
  await revalidateDirectories(directories);
  let handle;
  let fileIdentity;
  let failed = true;
  try {
    handle = await open(
      target,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    fileIdentity = identity(target, await handle.stat());
    await handle.writeFile(content, "utf8");
    await handle.sync();
    failed = false;
  } catch {
    invalidInput();
  } finally {
    await handle?.close().catch(() => {});
    if (failed && fileIdentity) {
      await cleanupCreatedFile(target, directories, fileIdentity);
    }
  }
}

export async function writeOpenDesign({ design, relativePath, workspaceRoot: configuredRoot } = {}) {
  if (typeof relativePath !== "string" || !SAFE_RELATIVE_PATH.test(relativePath) || relativePath.includes("\\")) {
    invalidInput();
  }
  const root = await workspaceRoot(configuredRoot);
  const target = path.resolve(root.pathname, ...relativePath.split("/"));
  if (!isInside(root.pathname, target)) {
    invalidInput();
  }
  const normalizedDesign = normalizeDesign(design);
  const directories = await ensureSafeParent(root, target);
  // Node lacks portable descriptor-relative rename/open APIs. Refusing overwrites plus O_EXCL|O_NOFOLLOW
  // prevents a leaf swap from being followed; only a fresh leaf may be created.
  await writeCreateOnly(target, `${JSON.stringify(normalizedDesign, null, 2)}\n`, directories);
  return { relativePath };
}

export function registerOpenDesign(pi, { workspaceRoot } = {}) {
  assertPiApi(pi);
  pi.registerTool({
    description: "Write a schema-validated Open Design document inside the configured workspace.",
    execute: async (input) => writeOpenDesign({ ...input, workspaceRoot }),
    name: "open_design",
    parameters: {
      additionalProperties: false,
      properties: {
        design: OPEN_DESIGN_SCHEMA,
        relativePath: { type: "string" },
      },
      required: ["relativePath", "design"],
      type: "object",
    },
  });
}

export default registerOpenDesign;
