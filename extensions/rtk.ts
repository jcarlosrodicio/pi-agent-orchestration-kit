import { EXTENSION_METADATA } from "./extension-contract.mjs";

export const metadata = EXTENSION_METADATA.rtk;

export const RTK_COMMAND_ALLOWLIST = Object.freeze(["git", "rg"]);
const GIT_VERBS = new Set(["diff", "log", "show", "status"]);
const GIT_FLAGS = Object.freeze({
  diff: new Set(["--cached", "--name-only", "--name-status", "--stat", "--staged", "-U0", "-U1", "-U3"]),
  log: new Set(["--decorate", "--name-only", "--no-decorate", "--oneline", "--stat"]),
  show: new Set(["--name-only", "--no-patch", "--stat"]),
  status: new Set(["--branch", "--porcelain=v1", "--porcelain=v2", "--short", "--untracked-files=all", "--untracked-files=no", "--untracked-files=normal"]),
});
const RG_SEARCH_FLAGS = new Set(["--fixed-strings", "--ignore-case", "--line-number"]);
const SAFE_GIT_REFERENCE = /^(?:HEAD(?:~[0-9]+)?|[a-f0-9]{7,64})$/i;
const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._@/:-]{0,255}$/;

function assertPiApi(pi) {
  if (!pi || typeof pi.registerTool !== "function") {
    throw new Error("Pi extension API is unavailable.");
  }
}

function validInput(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === 2
    && Object.hasOwn(value, "command")
    && Object.hasOwn(value, "args")
    && typeof value.command === "string"
    && Array.isArray(value.args)
    && Object.keys(value.args).length === value.args.length
    && value.args.every((argument) => typeof argument === "string" && argument.length > 0 && argument.length <= 256 && !/[\0\r\n]/.test(argument));
}

function validGit(value) {
  const [verb, ...argumentsList] = value.args;
  if (!GIT_VERBS.has(verb)) {
    return false;
  }
  for (const argument of argumentsList) {
    if (GIT_FLAGS[verb].has(argument)) {
      continue;
    }
    if (verb !== "status" && SAFE_GIT_REFERENCE.test(argument)) {
      continue;
    }
    return false;
  }
  return true;
}

function validRelativePath(value) {
  return SAFE_RELATIVE_PATH.test(value) && !value.includes("\\");
}

function validRg(value) {
  const argumentsList = value.args;
  if (argumentsList[0] === "--files") {
    if (argumentsList.length === 1) return true;
    if (argumentsList.length === 2) return validRelativePath(argumentsList[1]);
    return argumentsList.length === 4
      && argumentsList[1] === "--glob"
      && validRelativePath(argumentsList[2])
      && validRelativePath(argumentsList[3]);
  }
  let index = 0;
  while (RG_SEARCH_FLAGS.has(argumentsList[index])) {
    index += 1;
  }
  const pattern = argumentsList[index];
  if (typeof pattern !== "string" || pattern.startsWith("-")) {
    return false;
  }
  index += 1;
  return index === argumentsList.length || argumentsList.slice(index).every(validRelativePath);
}

export function transformRtkCommand(value) {
  if (!validInput(value) || !RTK_COMMAND_ALLOWLIST.includes(value.command) || (value.command === "git" ? !validGit(value) : !validRg(value))) {
    throw new Error("RTK command is not allowed.");
  }
  return { args: [...value.args], command: value.command };
}

export function registerRtk(pi) {
  assertPiApi(pi);
  pi.registerTool({
    description: "Validate a literal allowlisted command without invoking a shell.",
    execute: async (input) => transformRtkCommand(input),
    name: "rtk",
    parameters: {
      additionalProperties: false,
      properties: {
        args: { items: { type: "string" }, type: "array" },
        command: { enum: [...RTK_COMMAND_ALLOWLIST], type: "string" },
      },
      required: ["command", "args"],
      type: "object",
    },
  });
}

export default registerRtk;
