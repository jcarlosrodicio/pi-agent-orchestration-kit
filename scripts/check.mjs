import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checker = path.resolve(fileURLToPath(import.meta.url));
const required = ["agents", "chains", "extensions", "prompts", "roles", "skills", "runtime"];
const requiredFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "LICENSE",
  "NOTICE.md",
  ".gitattributes",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  ".github/workflows/check.yml",
];
const forbidden = [
  ["/", "Users", "/"].join(""), ["/", "home", "/"].join(""),
  ["nan", "web", "search"].join("-"), [["sear", "xng"].join(""), "local"].join("-"),
  ["memory", ["q", "drant"].join("")].join("-"), ["project", "memory", ["q", "drant"].join("")].join("-"),
  ["NAN", "API_KEY"].join("_"), ["QDRANT", "API_KEY"].join("_"),
  ["SEARXNG", "URL"].join("_"), ["juan", "canas"].join(""), ["syno", "logy"].join(""),
];

for (const relative of required) {
  const stats = await lstat(path.join(root, relative));
  if (!stats.isDirectory()) throw new Error(`required package directory is not a directory: ${relative}`);
  await readdir(path.join(root, relative));
}

for (const relative of requiredFiles) {
  const stats = await lstat(path.join(root, relative));
  if (!stats.isFile()) throw new Error(`required package file is not a regular file: ${relative}`);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageJson.private !== false) throw new Error("public package must explicitly set private=false");
if (packageJson.license !== "Apache-2.0") throw new Error("public package must use the Apache-2.0 license");
if (packageJson.engines?.node !== ">=22") throw new Error("public package must require Node.js >=22");
const expectedResources = {
  "pi.extensions": ["./extensions/*.ts"],
  "pi.skills": ["./skills"],
  "pi.prompts": ["./prompts"],
  "pi-subagents.agents": ["./agents"],
  "pi-subagents.chains": ["./chains"],
};
for (const [key, expected] of Object.entries(expectedResources)) {
  const [section, field] = key.split(".");
  const actual = packageJson[section]?.[field];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`package resource declaration drift: ${key}`);
  }
}

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    const stats = await lstat(full);
    if (stats.isSymbolicLink()) throw new Error(`public package cannot contain symlinks: ${path.relative(root, full)}`);
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue;
      await walk(full);
    }
    else if (stats.isFile()) files.push(full);
    else throw new Error(`public package contains a non-regular file: ${path.relative(root, full)}`);
  }
}
await walk(root);

for (const file of files) {
  if (file.includes(`${path.sep}.git${path.sep}`)) continue;
  if (path.resolve(file) === checker) continue;
  const content = await readFile(file, "utf8");
  for (const marker of forbidden) {
    if (content.includes(marker)) {
      throw new Error(`public package contains forbidden marker: ${marker}`);
    }
  }
}

console.log(`checked ${files.length} public package files`);
